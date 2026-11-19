import type { Goods } from "@game/data/Goods";
import type { SectorBid } from "@game/workers/SectorBid";
import type { InputPaymentBreakdown } from "@game/workers/industryTickHelpers";
import type { PurchaseProvenance } from "@game/workers/industryTickHelpers";

export interface GoodMarketMetrics {
    good: keyof Goods;
    openingPrice: number;
    closingPrice: number;
    openingInventory: number;
    productionAvailable: number;
    availableSupply: number;
    desiredDemand: number;
    fulfilledDemand: number;
    unmetDemand: number;
    supplyDemandRatio: number;
    shortageRatio: number;
    surplusRatio: number;
    imbalance: number;
    tradedQuantity: number;
}

export interface NonCumulativeMarketFlow {
    productionAvailable: number;
    desiredDemand: number;
    fulfilledDemand: number;
    unmetDemand: number;
}

export interface MarketMetricsSnapshot {
    tick: number;
    entityId: string;
    goods: Partial<Record<keyof Goods, GoodMarketMetrics>>;
}

export interface MarketDemandSnapshot {
    household: Partial<Record<keyof Goods, number>>;
    sectors: Record<string, Partial<Record<keyof Goods, number>>>;
    capital: Partial<Record<keyof Goods, number>>;
}

export interface HouseholdMarketDemand {
    desiredByGood: Partial<Record<keyof Goods, number>>;
    fulfilledByGood: Partial<Record<keyof Goods, number>>;
}

export interface SectorDesiredDemand {
    sectorId: string;
    goods: Partial<Record<keyof Goods, number>>;
}

export interface CapitalDesiredDemand {
    goods: Partial<Record<keyof Goods, number>>;
}

export interface PriceAdjustmentConfig {
    sensitivity: number;
    maxIncreasePerTick: number;
    maxDecreasePerTick: number;
    minPriceMultiplier: number;
    maxPriceMultiplier: number;
}

export const DEFAULT_PRICE_CONFIG: PriceAdjustmentConfig = {
    sensitivity: 0.15,
    maxIncreasePerTick: 0.10,
    maxDecreasePerTick: 0.10,
    minPriceMultiplier: 0.1,
    maxPriceMultiplier: 10.0,
};

export function validateConfig(config: PriceAdjustmentConfig): void {
    const values = [
        config.sensitivity,
        config.maxIncreasePerTick,
        config.maxDecreasePerTick,
        config.minPriceMultiplier,
        config.maxPriceMultiplier,
    ];

    if (!values.every(Number.isFinite)) {
        throw new Error("Price adjustment config must contain finite values");
    }

    if (config.sensitivity < 0) throw new Error("sensitivity must be >= 0");
    if (config.maxIncreasePerTick < 0 || config.maxIncreasePerTick >= 1) {
        throw new Error("maxIncreasePerTick must be in [0, 1)");
    }
    if (config.maxDecreasePerTick < 0 || config.maxDecreasePerTick >= 1) {
        throw new Error("maxDecreasePerTick must be in [0, 1)");
    }
    if (config.minPriceMultiplier <= 0) {
        throw new Error("minPriceMultiplier must be > 0");
    }
    if (config.maxPriceMultiplier < config.minPriceMultiplier) {
        throw new Error("maxPriceMultiplier must be >= minPriceMultiplier");
    }
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function calculateImbalance(demand: number, supply: number): number {
    if (!Number.isFinite(demand) || demand < 0) {
        throw new Error(`Invalid demand: ${demand}`);
    }
    if (!Number.isFinite(supply) || supply < 0) {
        throw new Error(`Invalid supply: ${supply}`);
    }
    return (demand - supply) / Math.max(demand, supply, 1);
}