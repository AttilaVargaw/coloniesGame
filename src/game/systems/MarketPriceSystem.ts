import { System } from "@engine/systems/system";
import { Engine } from "@engine/core/engine";
import { IndustryTickCompletedEvent, IndustryTickCompletedData } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { MarketPricesUpdatedEvent } from "@/engine/lib/events/MarketPricesUpdatedEvent";
import { basePrices } from "@game/data/Goods";
import { marketMetricsCalculator, MarketMetricsInput } from "@game/economics/market/marketMetricsCalculator";
import { calculateAllNewPrices, DEFAULT_PRICE_CONFIG } from "@game/economics/market/priceAdjustmentCalculator";
import { validatePrices } from "@game/workers/industryTickHelpers";
import { IndustryComponent } from "@game/components/industryComponent";
import { Goods } from "@game/data/Goods";
import { SectorBid } from "@game/workers/SectorBid";

interface CommittedMarketPrices {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

interface PriceMemoryState {
    version: number;
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Record<keyof Goods, number>;
}

enum MarketPriceStatus {
    OK = "ok",
    FAILED_CALCULATION = "failed_calculation",
    FAILED_VALIDATION = "failed_validation",
    STALE_EVENT = "stale_event",
}

interface MarketPriceStateEntry {
    status: MarketPriceStatus;
    committed?: CommittedMarketPrices;
    error?: string;
}

export class MarketPriceSystem extends System {
    private priceMemory = new Map<string, MarketPriceStateEntry>();
    private config = DEFAULT_PRICE_CONFIG;

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        return this;
    }

    removeFromEngine(): this {
        if (this.engine) {
            this.engine.unsubscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        }
        return super.removeFromEngine();
    }

    getPriceSnapshot(entityId: string, expectedTick: number): Readonly<Record<keyof Goods, number>> {
        const entry = this.priceMemory.get(entityId);
        if (!entry || !entry.committed) {
            if (expectedTick === 1) return { ...basePrices };
            throw new Error(`Prices for tick ${expectedTick} not committed (no prices for ${entityId})`);
        }
        
        const committedEffectiveTick = entry.committed.effectiveTick;
        
        if (committedEffectiveTick < expectedTick) {
            throw new Error(`Prices for tick ${expectedTick} not committed (last effective: ${committedEffectiveTick})`);
        }
        
        return entry.committed.prices;
    }

    getCommittedPrices(entityId: string): CommittedMarketPrices | undefined {
        const entry = this.priceMemory.get(entityId);
        return entry?.committed;
    }

    private handleTickCompleted = (data: IndustryTickCompletedData) => {
        const entityId = data.entity.id;
        
        // Reject stale/duplicate/skipped events - EXACT equality check required
        const entry = this.priceMemory.get(entityId);
        const expectedSourceTick = entry?.committed?.sourceTick ?? 0;
        const expectedCompletionTick = expectedSourceTick + 1;
        
        if (data.tick !== expectedCompletionTick) {
            // Record failure status but don't mutate live prices
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.STALE_EVENT,
                error: `Unexpected market price update for ${entityId}: expected tick ${expectedCompletionTick}, received ${data.tick}`
            });
            return; // Silent ignore - do not throw, do not update prices
        }
        
        const oldPrices = entry?.committed?.prices ?? { ...basePrices };
        
        try {
            // Calculate metrics
            const metrics = this.calculateMetrics(data, oldPrices);
            
            // Calculate new prices
            const newPrices = this.calculateNewPrices(metrics, oldPrices);
            
            // Validate all prices
            validatePrices(newPrices);
            
            // Commit atomically - single CommittedMarketPrices object
            const committed: CommittedMarketPrices = {
                entityId,
                sourceTick: data.tick,
                effectiveTick: data.tick + 1,
                prices: newPrices,
            };
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.OK,
                committed,
            });
            
            // Notify UI
            this.engine!.dispatchEvent(
                new MarketPricesUpdatedEvent({
                    entity: data.entity,
                    tick: data.tick,
                    prices: newPrices,
                })
            );
        } catch (error) {
            // Record failure - prices remain at previous committed state
            this.priceMemory.set(entityId, {
                status: MarketPriceStatus.FAILED_CALCULATION,
                committed: entry?.committed,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            // Re-throw for logging but don't corrupt state
            throw error;
        }
    };

    private calculateMetrics(data: IndustryTickCompletedData, oldPrices: Record<keyof Goods, number>): any[] {
        // Build explicit MarketMetricsInput from completed event data
        // sectorBids are not stored on IndustryComponent; they're created per-tick in the worker
        // For now, use empty array - sector demand will come from accounting data
        const sectorBids: SectorBid[] = [];
        
        const input: MarketMetricsInput = {
            tick: data.tick,
            entityId: data.entity.id,
            openingInventory: (data.metrics as any).goods ?? {},
            goodsProduction: data.metrics.goodsProduction ?? {},
            nonCumulativeFlow: {
                productionAvailable: (data.metrics as any).nonCumulativeProduction ?? {},
                fulfilledDemand: (data.metrics as any).nonCumulativeFulfilled ?? {},
            },
            householdDesiredDemand: (data.metrics as any).householdDesiredDemand ?? {},
            sectorDesiredDemand: sectorBids.length > 0 ? this.sumSectorIdealDemand(sectorBids) : {},
            capitalDesiredDemand: (data.metrics as any).capitalDesiredDemand ?? {},
            householdFulfilledDemand: data.metrics.accounting.householdSalesByGood ?? {},
            sectorFulfilledDemand: this.flattenSectorPurchases(data.metrics.accounting.sectorInputsPurchasedBySector),
            capitalFulfilledDemand: data.metrics.accounting.capitalPurchasesByGood ?? {},
            oldPrices,
        };
        
        try {
            return marketMetricsCalculator(input);
        } catch (error) {
            // Return empty metrics on calculation failure - prices will remain unchanged
            console.warn(`Market metrics calculation failed for ${data.entity.id}:`, error);
            return [];
        }
    }

    private sumSectorIdealDemand(bids: SectorBid[]): Partial<Record<keyof Goods, number>> {
        const result: Partial<Record<keyof Goods, number>> = {};
        for (const bid of bids) {
            for (const [good, demand] of Object.entries(bid.idealGoodsDemand)) {
                const key = good as keyof Goods;
                result[key] = (result[key] ?? 0) + demand;
            }
        }
        return result;
    }

    private flattenSectorPurchases(purchases: IndustryTickCompletedData["metrics"]["accounting"]["sectorInputsPurchasedBySector"]): Partial<Record<keyof Goods, number>> {
        const result: Partial<Record<keyof Goods, number>> = {};
        for (const [, goods] of Object.entries(purchases)) {
            for (const [good, qty] of Object.entries(goods)) {
                const key = good as keyof Goods;
                result[key] = (result[key] ?? 0) + qty;
            }
        }
        return result;
    }

    private calculateNewPrices(metrics: any[], oldPrices: Record<keyof Goods, number>): Record<keyof Goods, number> {
        const calcMetrics = metrics.map(m => ({
            good: m.good as keyof Goods,
            imbalance: m.imbalance,
            openingPrice: m.openingPrice,
            basePrice: basePrices[m.good as keyof Goods],
        }));
        return calculateAllNewPrices(calcMetrics, oldPrices, this.config);
    }

    // Serialization for save/load
    serialize(): PriceMemoryState[] {
        const result: PriceMemoryState[] = [];
        for (const [, entry] of this.priceMemory) {
            if (entry.committed) {
                result.push({
                    version: 1,
                    entityId: entry.committed.entityId,
                    sourceTick: entry.committed.sourceTick,
                    effectiveTick: entry.committed.effectiveTick,
                    prices: { ...entry.committed.prices },
                });
            }
        }
        return result;
    }

    // Deserialization: VALIDATE FIRST, then mutate
    deserialize(state: PriceMemoryState[]): void {
        // Phase 1: Validate ALL entries before any mutation
        const validatedEntries: Array<{ entityId: string; committed: CommittedMarketPrices }> = [];
        
        for (const s of state) {
            // Validate schema version
            if (s.version !== 1) {
                throw new Error(`Unsupported price memory schema version: ${s.version}`);
            }
            // Validate required fields
            if (!Number.isInteger(s.sourceTick) || s.sourceTick < 0) {
                throw new Error(`Invalid sourceTick: ${s.sourceTick}`);
            }
            if (s.effectiveTick !== s.sourceTick + 1) {
                throw new Error(`effectiveTick must equal sourceTick + 1: ${s.effectiveTick} !== ${s.sourceTick} + 1`);
            }
            // Validate all prices
            for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
                const value = s.prices[key];
                if (!Number.isFinite(value) || value <= 0) {
                    throw new Error(`Invalid price for ${key}: ${value}`);
                }
            }
            validatedEntries.push({
                entityId: s.entityId,
                committed: {
                    entityId: s.entityId,
                    sourceTick: s.sourceTick,
                    effectiveTick: s.effectiveTick,
                    prices: s.prices,
                },
            });
        }
        
        // Phase 2: Apply all validated entries atomically
        for (const entry of validatedEntries) {
            this.priceMemory.set(entry.entityId, {
                status: MarketPriceStatus.OK,
                committed: entry.committed,
            });
        }
    }
}