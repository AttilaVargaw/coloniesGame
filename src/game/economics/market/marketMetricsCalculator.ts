import { Goods, basePrices, NON_CUMULATING_GOODS } from "@game/data/Goods";
import { GoodMarketMetrics, calculateImbalance } from "./marketTypes";

export interface MarketMetricsInput {
    tick: number;
    entityId: string;
    openingInventory: Partial<Record<keyof Goods, number>>;
    goodsProduction: Partial<Record<keyof Goods, number>>;
    nonCumulativeFlow: {
        productionAvailable: Partial<Record<keyof Goods, number>>;
        fulfilledDemand: Partial<Record<keyof Goods, number>>;
    };
    householdDesiredDemand: Partial<Record<keyof Goods, number>>;
    sectorDesiredDemand: Partial<Record<keyof Goods, number>>;
    capitalDesiredDemand: Partial<Record<keyof Goods, number>>;
    householdFulfilledDemand: Partial<Record<keyof Goods, number>>;
    sectorFulfilledDemand: Partial<Record<keyof Goods, number>>;
    capitalFulfilledDemand: Partial<Record<keyof Goods, number>>;
    oldPrices: Partial<Record<keyof Goods, number>>;
}

export function marketMetricsCalculator(input: MarketMetricsInput): GoodMarketMetrics[] {
    const { oldPrices, ...rest } = input;

    const allGoods = new Set<keyof Goods>([
        ...Object.keys(basePrices) as (keyof Goods)[],
        ...Object.keys(rest.openingInventory) as (keyof Goods)[],
        ...Object.keys(rest.goodsProduction) as (keyof Goods)[],
        ...Object.keys(rest.householdDesiredDemand) as (keyof Goods)[],
        ...Object.keys(rest.sectorDesiredDemand) as (keyof Goods)[],
        ...Object.keys(rest.capitalDesiredDemand) as (keyof Goods)[],
    ]);

    for (const good of allGoods) {
        const price = oldPrices[good];
        if (price === undefined) {
            throw new Error(`Missing price for ${good} in oldPrices - must be initialized before calculation`);
        }
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error(`Invalid price for ${good}: ${price}`);
        }
    }

    const desiredDemandByGood = new Map<keyof Goods, number>();
    for (const [good, qty] of Object.entries(rest.householdDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.sectorDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.capitalDesiredDemand)) {
        const key = good as keyof Goods;
        desiredDemandByGood.set(key, (desiredDemandByGood.get(key) ?? 0) + qty);
    }

    const fulfilledDemandByGood = new Map<keyof Goods, number>();
    for (const [good, qty] of Object.entries(rest.householdFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.sectorFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }
    for (const [good, qty] of Object.entries(rest.capitalFulfilledDemand)) {
        const key = good as keyof Goods;
        fulfilledDemandByGood.set(key, (fulfilledDemandByGood.get(key) ?? 0) + qty);
    }

    const metrics: GoodMarketMetrics[] = [];

    for (const good of allGoods) {
        const isNonCumulative = NON_CUMULATING_GOODS.has(good);
        
        if (isNonCumulative) {
            const productionAvailable = rest.nonCumulativeFlow.productionAvailable[good] ?? 0;
            const fulfilledDemand = rest.nonCumulativeFlow.fulfilledDemand[good] ?? 0;
            const desiredDemand = desiredDemandByGood.get(good) ?? 0;
            
            const availableSupply = productionAvailable;
            const unmetDemand = Math.max(0, desiredDemand - fulfilledDemand);
            const imbalance = calculateImbalance(desiredDemand, availableSupply);
            const supplyDemandRatio = desiredDemand > 0 ? availableSupply / desiredDemand : Infinity;
            const shortageRatio = desiredDemand > 0 ? Math.max(0, (desiredDemand - availableSupply) / desiredDemand) : 0;
            const surplusRatio = availableSupply > 0 ? Math.max(0, (availableSupply - desiredDemand) / availableSupply) : 0;

            metrics.push({
                good,
                openingPrice: oldPrices[good]!,
                closingPrice: 0,
                openingInventory: 0,
                productionAvailable,
                availableSupply,
                desiredDemand,
                fulfilledDemand,
                unmetDemand,
                supplyDemandRatio,
                shortageRatio,
                surplusRatio,
                imbalance,
                tradedQuantity: fulfilledDemand,
            });
        } else {
            const openingInventory = rest.openingInventory[good] ?? 0;
            const productionAvailable = rest.goodsProduction[good] ?? 0;
            const availableSupply = openingInventory + productionAvailable;
            const desiredDemand = desiredDemandByGood.get(good) ?? 0;
            const fulfilledDemand = fulfilledDemandByGood.get(good) ?? 0;
            const unmetDemand = Math.max(0, desiredDemand - fulfilledDemand);

            const imbalance = calculateImbalance(desiredDemand, availableSupply);
            const supplyDemandRatio = desiredDemand > 0 ? availableSupply / desiredDemand : Infinity;
            const shortageRatio = desiredDemand > 0 ? Math.max(0, (desiredDemand - availableSupply) / desiredDemand) : 0;
            const surplusRatio = availableSupply > 0 ? Math.max(0, (availableSupply - desiredDemand) / availableSupply) : 0;

            metrics.push({
                good,
                openingPrice: oldPrices[good]!,
                closingPrice: 0,
                openingInventory,
                productionAvailable,
                availableSupply,
                desiredDemand,
                fulfilledDemand,
                unmetDemand,
                supplyDemandRatio,
                shortageRatio,
                surplusRatio,
                imbalance,
                tradedQuantity: fulfilledDemand,
            });
        }
    }

    return metrics;
}