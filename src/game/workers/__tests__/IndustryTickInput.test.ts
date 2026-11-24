import { describe, it, expect } from "vitest";
import { IndustryTickInput, PriceSnapshot, validatePriceSnapshot } from "../IndustryTickInput";
import { Goods } from "@game/data/Goods";

describe("IndustryTickInput", () => {
    it("includes PriceSnapshot with entity/tick identity", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        const input: IndustryTickInput = {
            entityId: "test",
            activeSectors: new Set(),
            goods: {} as any,
            population: {} as any,
            techMultipliers: {} as any,
            capitalStock: {} as any,
            money: {} as any,
            settlementType: "colony",
            allowedSectors: undefined,
            workerEfficiencyMultipliers: {} as any,
            materialRequirementMultipliers: {} as any,
            capitalMultipliers: {} as any,
            selectedMethod: {} as any,
            colonyTreasury: 0,
            sectorInvestment: {} as any,
            activeLaws: new Set(),
            tick: 1,
            prices,
            producerInventories: undefined,
            governanceCapacity: 0,
            totalGovernanceDemand: 0,
        };
        
        expect(input.prices.entityId).toBe("test-colony");
        expect(input.prices.sourceTick).toBe(1);
        expect(input.prices.effectiveTick).toBe(2);
        expect(input.prices.prices.energy).toBe(25);
    });

    it("rejects partial price record", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25 } as any,
        };
        
        expect(() => validatePriceSnapshot(prices, "test-colony", 2)).toThrow("Invalid or missing price");
    });

    it("rejects zero/negative price", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 0, food: 30 } as any,
        };
        
        expect(() => validatePriceSnapshot(prices, "test-colony", 2)).toThrow("Invalid or missing price");
    });
    
    it("rejects mismatched entityId", () => {
        const prices: PriceSnapshot = {
            entityId: "wrong-entity",
            sourceTick: 1,
            effectiveTick: 2,
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        expect(() => validatePriceSnapshot(prices, "test", 2)).toThrow("Entity ID mismatch");
    });
    
    it("rejects mismatched effectiveTick", () => {
        const prices: PriceSnapshot = {
            entityId: "test-colony",
            sourceTick: 1,
            effectiveTick: 5,
            prices: { energy: 25, food: 30 } as Readonly<Record<keyof Goods, number>>,
        };
        
        expect(() => validatePriceSnapshot(prices, "test-colony", 2)).toThrow("Effective tick mismatch");
    });
});