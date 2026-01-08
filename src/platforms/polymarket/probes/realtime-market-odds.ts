/**
 * Real-Time Market Odds Probe (Polymarket Platform)
 * 
 * Uses WebSocket for real-time probability updates
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PolymarketWebSocketClient } from '../services/polymarket-websocket-client';

export interface RealtimeMarketOddsProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        assetId: string;       // CLOB asset ID for WebSocket
        marketSlug?: string;   // Market slug for metadata (optional)
        outcome: 'yes' | 'no';
    };
    rules?: any[];
}

/**
 * Real-Time Market Odds Probe - WebSocket-based
 * 
 * Facts generated:
 * - polymarket.probability - Current probability from WebSocket
 * - polymarket.bidPrice - Best bid price
 * - polymarket.askPrice - Best ask price
 * - polymarket.spread - Bid-ask spread
 * - polymarket.lastTradePrice - Most recent trade price
 */
export class RealtimeMarketOddsProbe extends BaseProbe<RealtimeMarketOddsProbeConfig> {
    private lastPrice?: number;

    constructor(
        id: string,
        config: RealtimeMarketOddsProbeConfig,
        private readonly wsClient: PolymarketWebSocketClient
    ) {
        super(id, config);

        // Subscribe to asset on initialization
        if (wsClient.isConnected()) {
            wsClient.subscribe([config.config.assetId]);
        }

        // Listen for price changes
        wsClient.onPriceChange((assetId, price, change) => {
            if (assetId === config.config.assetId) {
                console.log(`[${this.id}] Price change: ${price.toFixed(4)} (${change > 0 ? '+' : ''}${(change * 100).toFixed(2)}%)`);
            }
        });
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { assetId, outcome } = this.config.config;

        try {
            // Get real-time market data from WebSocket
            const marketData = await this.wsClient.getMarketData(assetId);

            if (!marketData) {
                // No data available yet
                setFact(facts, 'polymarket.status', 'no_data');
                setFact(facts, 'polymarket.probability', null);
                return facts;
            }

            // Use mid price as probability
            const probability = marketData.price;
            setFact(facts, 'polymarket.probability', probability);
            setFact(facts, 'polymarket.probabilityPercent', probability * 100);

            // Extract bid/ask data
            if (marketData.bids.length > 0) {
                const bestBid = parseFloat(marketData.bids[0].price);
                setFact(facts, 'polymarket.bidPrice', bestBid);
                setFact(facts, 'polymarket.bidSize', parseFloat(marketData.bids[0].size));
            }

            if (marketData.asks.length > 0) {
                const bestAsk = parseFloat(marketData.asks[0].price);
                setFact(facts, 'polymarket.askPrice', bestAsk);
                setFact(facts, 'polymarket.askSize', parseFloat(marketData.asks[0].size));
            }

            // Calculate spread
            if (marketData.bids.length > 0 && marketData.asks.length > 0) {
                const spread = parseFloat(marketData.asks[0].price) - parseFloat(marketData.bids[0].price);
                setFact(facts, 'polymarket.spread', spread);
                setFact(facts, 'polymarket.spreadPercent', spread * 100);
            }

            // Last trade data
            if (marketData.lastTradePrice) {
                setFact(facts, 'polymarket.lastTradePrice', marketData.lastTradePrice);
            }
            if (marketData.lastTradeSize) {
                setFact(facts, 'polymarket.lastTradeSize', marketData.lastTradeSize);
            }

            // Calculate price change from previous collect
            if (this.lastPrice !== undefined) {
                const priceChange = probability - this.lastPrice;
                setFact(facts, 'polymarket.priceChange', priceChange);
                setFact(facts, 'polymarket.priceChangePercent', priceChange * 100);
            }

            // Update last price
            this.lastPrice = probability;

            // Market info
            setFact(facts, 'polymarket.assetId', assetId);
            setFact(facts, 'polymarket.outcome', outcome);
            setFact(facts, 'polymarket.dataSource', 'websocket');
            setFact(facts, 'polymarket.dataAge', Date.now() - marketData.timestamp);
            setFact(facts, 'polymarket.status', 'success');

        } catch (err) {
            console.error(`[RealtimeMarketOddsProbe:${this.id}] Failed:`, err);
            setFact(facts, 'polymarket.status', 'error');
            setFact(facts, 'polymarket.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'polymarket.probability', null);
        }

        return facts;
    }
}
