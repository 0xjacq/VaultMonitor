/**
 * Polymarket WebSocket Client
 *
 * Direct native WebSocket implementation for Polymarket CLOB Market channel.
 * Provides real-time orderbook and price data with auto-reconnection.
 */

import { CircuitBreaker } from '../../../core/circuit-breaker';
import { PolymarketApiClient } from './polymarket-api-client';

const DEFAULT_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const DEFAULT_HEARTBEAT_INTERVAL = 10000;
const DEFAULT_MAX_RECONNECT_DELAY = 60000;
const INITIAL_RECONNECT_DELAY = 1000;
const CACHE_TTL = 60000;

export interface PolymarketWebSocketClientConfig {
    wsUrl?: string;
    restApiUrl?: string;
    autoConnect?: boolean;
    heartbeatInterval?: number;
    maxReconnectDelay?: number;
    apiClient?: PolymarketApiClient;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

export interface MarketData {
    assetId: string;
    price: number;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    lastTradePrice?: number;
    lastTradeSize?: number;
    timestamp: number;
}

/**
 * Polymarket WebSocket client using native WebSocket
 */
export class PolymarketWebSocketClient {
    private ws: WebSocket | null = null;
    private wsUrl: string;
    private circuitBreaker: CircuitBreaker;
    private restApiUrl: string;
    private apiClient: PolymarketApiClient | null;
    private marketDataCache = new Map<string, MarketData>();
    private priceChangeCallbacks: Array<(assetId: string, price: number, change: number) => void> = [];
    private connected = false;
    private subscribedAssets = new Set<string>();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay: number = INITIAL_RECONNECT_DELAY;
    private maxReconnectDelay: number;
    private heartbeatInterval: number;
    private intentionalDisconnect = false;

    constructor(config: PolymarketWebSocketClientConfig = {}) {
        this.wsUrl = config.wsUrl || DEFAULT_WS_URL;
        this.restApiUrl = config.restApiUrl || 'https://gamma-api.polymarket.com';
        this.apiClient = config.apiClient || null;
        this.heartbeatInterval = config.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
        this.maxReconnectDelay = config.maxReconnectDelay || DEFAULT_MAX_RECONNECT_DELAY;

        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };
        this.circuitBreaker = new CircuitBreaker(cbConfig, 'PolymarketWS');

        if (config.autoConnect !== false) {
            this.connect().catch(err => {
                console.error('[PolymarketWSClient] Auto-connect failed:', err);
            });
        }
    }

    /**
     * Connect to WebSocket
     */
    async connect(): Promise<void> {
        this.intentionalDisconnect = false;

        return new Promise<void>((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsUrl);

                const onOpen = () => {
                    this.connected = true;
                    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
                    console.log('[PolymarketWSClient] Connected to WebSocket');
                    this.startHeartbeat();
                    this.resubscribeAll();
                    cleanup();
                    resolve();
                };

                const onError = (event: Event) => {
                    console.error('[PolymarketWSClient] Connection error');
                    cleanup();
                    reject(new Error('WebSocket connection failed'));
                };

                const cleanup = () => {
                    this.ws?.removeEventListener('open', onOpen);
                    this.ws?.removeEventListener('error', onError);
                    if (this.ws) {
                        this.ws.addEventListener('message', (event) => this.handleMessage(event));
                        this.ws.addEventListener('close', () => this.handleClose());
                        this.ws.addEventListener('error', () => this.handleError());
                    }
                };

                this.ws.addEventListener('open', onOpen);
                this.ws.addEventListener('error', onError);
            } catch (err) {
                this.connected = false;
                reject(err);
            }
        });
    }

    /**
     * Subscribe to asset IDs for real-time updates
     */
    subscribe(assetIds: string[]): void {
        for (const id of assetIds) {
            this.subscribedAssets.add(id);
        }

        if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                assets_ids: assetIds,
                type: 'market'
            }));
            console.log(`[PolymarketWSClient] Subscribed to ${assetIds.length} assets`);
        }
    }

    /**
     * Unsubscribe from asset IDs
     */
    unsubscribe(assetIds: string[]): void {
        for (const id of assetIds) {
            this.subscribedAssets.delete(id);
        }

        if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                operation: 'unsubscribe',
                assets_ids: assetIds
            }));
        }
    }

    /**
     * Get current market data for an asset
     * Returns cached WebSocket data if available, otherwise fetches via REST
     */
    async getMarketData(assetId: string): Promise<MarketData | null> {
        const cached = this.marketDataCache.get(assetId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached;
        }

        return this.fetchMarketDataRest(assetId);
    }

    /**
     * Get market data by slug (REST API only)
     */
    async getMarketBySlug(slug: string): Promise<any> {
        return this.circuitBreaker.execute(async () => {
            const response = await fetch(`${this.restApiUrl}/markets/${slug}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        });
    }

    /**
     * Register callback for price changes
     */
    onPriceChange(callback: (assetId: string, price: number, change: number) => void): void {
        this.priceChangeCallbacks.push(callback);
    }

    /**
     * Get all cached market data
     */
    getAllMarketData(): Map<string, MarketData> {
        return new Map(this.marketDataCache);
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Check if healthy (circuit breaker)
     */
    isHealthy(): boolean {
        return this.circuitBreaker.isHealthy();
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        this.intentionalDisconnect = true;
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000);
            this.ws = null;
        }

        this.connected = false;
        this.marketDataCache.clear();
        console.log('[PolymarketWSClient] Disconnected');
    }

    // --- Private methods ---

    private handleMessage(event: MessageEvent): void {
        const data = typeof event.data === 'string' ? event.data : String(event.data);

        if (data === 'PONG') {
            return;
        }

        try {
            const messages: any[] = JSON.parse(data);

            for (const msg of Array.isArray(messages) ? messages : [messages]) {
                const eventType = msg.event_type;

                if (eventType === 'book') {
                    this.handleBookEvent(msg);
                } else if (eventType === 'price_change') {
                    this.handlePriceChangeEvent(msg);
                } else if (eventType === 'last_trade_price') {
                    this.handleLastTradePriceEvent(msg);
                }
            }
        } catch (err) {
            console.error('[PolymarketWSClient] Failed to parse message:', err);
        }
    }

    private handleBookEvent(event: any): void {
        const marketData: MarketData = {
            assetId: event.asset_id,
            price: this.calculateMidPrice(event.bids || [], event.asks || []),
            bids: event.bids || [],
            asks: event.asks || [],
            timestamp: Date.now()
        };

        const previousData = this.marketDataCache.get(event.asset_id);
        if (previousData) {
            marketData.lastTradePrice = previousData.lastTradePrice;
            marketData.lastTradeSize = previousData.lastTradeSize;

            const priceChange = marketData.price - previousData.price;
            if (Math.abs(priceChange) > 0.0001) {
                this.notifyPriceChange(event.asset_id, marketData.price, priceChange);
            }
        }

        this.marketDataCache.set(event.asset_id, marketData);
    }

    private handlePriceChangeEvent(event: any): void {
        const changes = event.price_changes || event.changes || [];
        for (const change of changes) {
            const assetId = change.asset_id;
            const newPrice = parseFloat(change.price);

            const existingData = this.marketDataCache.get(assetId);
            const priceChange = existingData ? newPrice - existingData.price : 0;

            if (Math.abs(priceChange) > 0.0001) {
                this.notifyPriceChange(assetId, newPrice, priceChange);
            }
        }
    }

    private handleLastTradePriceEvent(event: any): void {
        const existingData = this.marketDataCache.get(event.asset_id);
        if (existingData) {
            existingData.lastTradePrice = parseFloat(event.price);
            existingData.lastTradeSize = parseFloat(event.size);
            existingData.timestamp = Date.now();
        }
    }

    private handleClose(): void {
        this.connected = false;
        this.stopHeartbeat();

        if (!this.intentionalDisconnect) {
            console.warn('[PolymarketWSClient] Connection closed, scheduling reconnect');
            this.scheduleReconnect();
        }
    }

    private handleError(): void {
        console.error('[PolymarketWSClient] WebSocket error');
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send('PING');
            }
        }, this.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.intentionalDisconnect) {
            return;
        }

        console.log(`[PolymarketWSClient] Reconnecting in ${this.reconnectDelay}ms`);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;

            try {
                await this.connect();
            } catch {
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
                this.scheduleReconnect();
            }
        }, this.reconnectDelay);
    }

    private resubscribeAll(): void {
        if (this.subscribedAssets.size > 0) {
            const assetIds = Array.from(this.subscribedAssets);
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    assets_ids: assetIds,
                    type: 'market'
                }));
                console.log(`[PolymarketWSClient] Resubscribed to ${assetIds.length} assets`);
            }
        }
    }

    private calculateMidPrice(
        bids: Array<{ price: string; size: string }>,
        asks: Array<{ price: string; size: string }>
    ): number {
        if (bids.length === 0 || asks.length === 0) return 0;

        const bestBid = parseFloat(bids[0].price);
        const bestAsk = parseFloat(asks[0].price);

        return (bestBid + bestAsk) / 2;
    }

    private notifyPriceChange(assetId: string, price: number, change: number): void {
        for (const callback of this.priceChangeCallbacks) {
            try {
                callback(assetId, price, change);
            } catch (err) {
                console.error('[PolymarketWSClient] Price change callback error:', err);
            }
        }
    }

    private async fetchMarketDataRest(assetId: string): Promise<MarketData | null> {
        if (!this.apiClient) {
            console.warn(`[PolymarketWSClient] No cached data for ${assetId}, no API client for REST fallback`);
            return null;
        }

        return this.circuitBreaker.execute(async (): Promise<MarketData | null> => {
            const orderbook = await this.apiClient!.getOrderbook(assetId);
            const bids = orderbook.bids || [];
            const asks = orderbook.asks || [];

            const marketData: MarketData = {
                assetId,
                price: this.calculateMidPrice(bids, asks),
                bids,
                asks,
                timestamp: Date.now()
            };

            this.marketDataCache.set(assetId, marketData);
            return marketData;
        });
    }
}
