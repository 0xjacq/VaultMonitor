/**
 * Enhanced Polymarket WebSocket Client
 * 
 * Uses polymarket-websocket-client for real-time orderbook and price data
 * Falls back to REST API for historical data
 */

import { ClobMarketClient } from 'polymarket-websocket-client';
import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface PolymarketWebSocketClientConfig {
    restApiUrl?: string;
    autoConnect?: boolean;
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
 * Enhanced Polymarket client with WebSocket support
 */
export class PolymarketWebSocketClient {
    private wsClient: ClobMarketClient;
    private circuitBreaker: CircuitBreaker;
    private restApiUrl: string;
    private marketDataCache = new Map<string, MarketData>();
    private priceChangeCallbacks: Array<(assetId: string, price: number, change: number) => void> = [];
    private connected = false;

    constructor(config: PolymarketWebSocketClientConfig = {}) {
        this.restApiUrl = config.restApiUrl || 'https://gamma-api.polymarket.com';

        // Initialize WebSocket client
        this.wsClient = new ClobMarketClient();

        // Initialize circuit breaker for REST API fallback
        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };
        this.circuitBreaker = new CircuitBreaker(cbConfig, 'PolymarketWS');

        // Set up WebSocket event listeners
        this.setupEventListeners();

        // Auto-connect if configured
        if (config.autoConnect !== false) {
            this.connect().catch(err => {
                console.error('[PolymarketWSClient] Auto-connect failed:', err);
            });
        }
    }

    private setupEventListeners() {
        // Listen to orderbook updates
        this.wsClient.onBook((event) => {
            const marketData: MarketData = {
                assetId: event.asset_id,
                price: this.calculateMidPrice(event.bids, event.asks),
                bids: event.bids,
                asks: event.asks,
                timestamp: Date.now()
            };

            // Check for price changes
            const previousData = this.marketDataCache.get(event.asset_id);
            if (previousData) {
                const priceChange = marketData.price - previousData.price;
                if (Math.abs(priceChange) > 0.0001) {
                    this.notifyPriceChange(event.asset_id, marketData.price, priceChange);
                }
            }

            this.marketDataCache.set(event.asset_id, marketData);
        });

        // Listen to last trade price updates
        this.wsClient.onLastTradePrice((event) => {
            const existingData = this.marketDataCache.get(event.asset_id);
            if (existingData) {
                existingData.lastTradePrice = parseFloat(event.price);
                existingData.lastTradeSize = parseFloat(event.size);
                existingData.timestamp = Date.now();
            }
        });

        // Listen to price change events
        this.wsClient.onPriceChange((event) => {
            for (const change of event.price_changes) {
                const assetId = change.asset_id;
                const newPrice = parseFloat(change.price);

                const existingData = this.marketDataCache.get(assetId);
                const priceChange = existingData ? newPrice - existingData.price : 0;

                if (Math.abs(priceChange) > 0.0001) {
                    this.notifyPriceChange(assetId, newPrice, priceChange);
                }
            }
        });
    }

    /**
     * Connect to WebSocket
     */
    async connect(): Promise<void> {
        try {
            await this.wsClient.connect();
            this.connected = true;
            console.log('[PolymarketWSClient] Connected to WebSocket');
        } catch (err) {
            console.error('[PolymarketWSClient] Connection failed:', err);
            this.connected = false;
            throw err;
        }
    }

    /**
     * Subscribe to asset IDs for real-time updates
     * 
     * @param assetIds Array of asset IDs to subscribe to
     */
    subscribe(assetIds: string[]): void {
        if (!this.connected) {
            throw new Error('Not connected. Call connect() first.');
        }
        this.wsClient.subscribe(assetIds);
        console.log(`[PolymarketWSClient] Subscribed to ${assetIds.length} assets`);
    }

    /**
     * Unsubscribe from asset IDs
     */
    unsubscribe(assetIds: string[]): void {
        this.wsClient.unsubscribe(assetIds);
    }

    /**
     * Get current market data for an asset
     * Returns cached WebSocket data if available, otherwise fetches via REST
     */
    async getMarketData(assetId: string): Promise<MarketData | null> {
        // Try cache first (WebSocket data)
        const cached = this.marketDataCache.get(assetId);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return cached;
        }

        // Fallback to REST API
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
        this.wsClient.disconnect();
        this.connected = false;
        this.marketDataCache.clear();
        console.log('[PolymarketWSClient] Disconnected');
    }

    // Private helper methods

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
        return this.circuitBreaker.execute(async (): Promise<MarketData | null> => {
            // This would need the actual REST endpoint for orderbook
            // For now, return null as fallback
            console.warn(`[PolymarketWSClient] No cached data for ${assetId}, REST fallback not implemented`);
            return null;
        });
    }
}
