import { describe, it, expect } from "vitest";
import { PriceAdjustmentConfig, validateConfig, MarketDemandSnapshot, SectorDesiredDemand } from "../priceAdjustmentConfig";
import { Goods } from "@game/data/Goods";
import { calculateImbalance, NonCumulativeMarketFlow } from "../marketTypes";

describe("PriceAdjustmentConfig", () => {
    it("validates valid config", () => {
        const config: PriceAdjustmentConfig = {
            sensitivity: 0.15,
            maxIncreasePerTick: 0.10,
            maxDecreasePerTick: 0.10,
            minPriceMultiplier: 0.1,
            maxPriceMultiplier: 10.0,
        };
        expect(() => validateConfig(config)).not.toThrow();
    });

    it("rejects negative sensitivity", () => {
        const config = { sensitivity: -0.1, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("sensitivity must be >= 0");
    });

    it("rejects maxIncreasePerTick >= 1", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 1.0, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("maxIncreasePerTick must be in [0, 1)");
    });

    it("rejects minPriceMultiplier <= 0", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("minPriceMultiplier must be > 0");
    });

    it("rejects maxPriceMultiplier < minPriceMultiplier", () => {
        const config = { sensitivity: 0.15, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.5, maxPriceMultiplier: 0.1 };
        expect(() => validateConfig(config)).toThrow("maxPriceMultiplier must be >= minPriceMultiplier");
    });

    it("rejects NaN/Infinity values", () => {
        const config = { sensitivity: NaN, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 };
        expect(() => validateConfig(config)).toThrow("Price adjustment config must contain finite values");
    });
});

describe("MarketDemandSnapshot", () => {
    it("has household, sectors, capital demand maps", () => {
        const snapshot: MarketDemandSnapshot = {
            household: { energy: 100 },
            sectors: { powerPlant: { energy: 80 } },
            capital: { machinery: 10 },
        };
        expect(snapshot.household.energy).toBe(100);
        expect(snapshot.sectors.powerPlant?.energy).toBe(80);
        expect(snapshot.capital.machinery).toBe(10);
    });
});

describe("SectorDesiredDemand", () => {
    it("captures sector demand at full scale before constraints", () => {
        const demand: SectorDesiredDemand = {
            sectorId: "powerPlant",
            goods: { energy: 100, water: 20 },
        };
        expect(demand.sectorId).toBe("powerPlant");
        expect(demand.goods.energy).toBe(100);
    });
});

describe("calculateImbalance", () => {
    it("imbalance formula produces -1 to 1", () => {
        expect(calculateImbalance(10, 0)).toBe(1);
        expect(calculateImbalance(0, 10)).toBe(-1);
        expect(calculateImbalance(5, 5)).toBe(0);
    });

    it("throws on negative demand", () => {
        expect(() => calculateImbalance(-1, 10)).toThrow("Invalid demand");
    });

    it("throws on negative supply", () => {
        expect(() => calculateImbalance(10, -1)).toThrow("Invalid supply");
    });
});

describe("NonCumulativeMarketFlow", () => {
    it("has separate production/fulfillment from cumulative", () => {
        const flow: NonCumulativeMarketFlow = {
            productionAvailable: 50,
            desiredDemand: 80,
            fulfilledDemand: 40,
            unmetDemand: 40,
        };
        expect(flow.unmetDemand).toBe(40);
    });
});