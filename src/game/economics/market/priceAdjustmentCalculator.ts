import { Goods } from "@game/data/Goods";
import { basePrices } from "@game/data/Goods";
import { PriceAdjustmentConfig, DEFAULT_PRICE_CONFIG, validateConfig, clamp } from "./marketTypes";

export { DEFAULT_PRICE_CONFIG } from "./marketTypes";

export function calculateNewPrice(
    oldPrice: number,
    basePrice: number,
    imbalance: number,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): number {
    validateConfig(config);

    if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
        throw new Error(`Invalid oldPrice: ${oldPrice}`);
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Invalid basePrice: ${basePrice}`);
    }
    if (!Number.isFinite(imbalance) || Math.abs(imbalance) > 1) {
        throw new Error(`Invalid imbalance: ${imbalance}`);
    }

    const rawAdjustment = imbalance * config.sensitivity;
    const clampedAdjustment = clamp(
        rawAdjustment,
        -config.maxDecreasePerTick,
        config.maxIncreasePerTick
    );

    const newPrice = oldPrice * (1 + clampedAdjustment);
    const floor = basePrice * config.minPriceMultiplier;
    const ceiling = basePrice * config.maxPriceMultiplier;

    return clamp(newPrice, floor, ceiling);
}

export function calculateAllNewPrices(
    metrics: Array<{
        good: keyof Goods;
        imbalance: number;
        openingPrice: number;
        basePrice: number;
    }>,
    oldPrices: Partial<Record<keyof Goods, number>>,
    config: PriceAdjustmentConfig = DEFAULT_PRICE_CONFIG
): Record<keyof Goods, number> {
    validateConfig(config);

    const newPrices: Partial<Record<keyof Goods, number>> = {};

    for (const m of metrics) {
        const oldPrice = oldPrices[m.good];
        if (oldPrice === undefined) {
            throw new Error(`Missing price for ${m.good} in oldPrices - must be initialized before calculation`);
        }
        if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
            throw new Error(`Invalid price for ${m.good}: ${oldPrice}`);
        }
        newPrices[m.good] = calculateNewPrice(oldPrice, m.basePrice, m.imbalance, config);
    }

    const result: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        result[key] = newPrices[key] ?? basePrices[key];
    }

    return result;
}