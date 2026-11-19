import { describe, it, expect } from "vitest";
import { marketMetricsCalculator } from "../marketMetricsCalculator";
import { Goods, basePrices, NON_CUMULATING_GOODS } from "@game/data/Goods";

function createMockInput() {
    const allPrices: Partial<Record<keyof Goods, number>> = {};
    for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
        allPrices[key] = basePrices[key];
    }
    // Override specific prices
    allPrices.energy = 20;
    allPrices.food = 30;
    allPrices.machinery = 500;

    return {
        tick: 1,
        entityId: "test-entity",
        openingInventory: { energy: 200, food: 500 } as Partial<Record<keyof Goods, number>>,
        goodsProduction: { energy: 50, food: 100 } as Partial<Record<keyof Goods, number>>,
        nonCumulativeFlow: {
            productionAvailable: { energy: 50 } as Partial<Record<keyof Goods, number>>,
            fulfilledDemand: { energy: 40 } as Partial<Record<keyof Goods, number>>,
        },
        householdDesiredDemand: { energy: 120, food: 200 } as Partial<Record<keyof Goods, number>>,
        sectorDesiredDemand: { energy: 100 } as Partial<Record<keyof Goods, number>>,
        capitalDesiredDemand: { machinery: 10 } as Partial<Record<keyof Goods, number>>,
        householdFulfilledDemand: { energy: 50, food: 100 } as Partial<Record<keyof Goods, number>>,
        sectorFulfilledDemand: { energy: 80 } as Partial<Record<keyof Goods, number>>,
        capitalFulfilledDemand: { machinery: 10 } as Partial<Record<keyof Goods, number>>,
        oldPrices: allPrices,
    };
}

describe("marketMetricsCalculator", () => {
    it("computes cumulative good metrics correctly", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        const energy = metrics.find(m => m.good === "energy");
        expect(energy).toBeDefined();
        // Energy is non-cumulative, so openingInventory = 0
        expect(energy!.openingInventory).toBe(0);
        expect(energy!.productionAvailable).toBe(50);
        expect(energy!.availableSupply).toBe(50); // only productionAvailable for non-cumulative
        expect(energy!.desiredDemand).toBe(220);
        // For non-cumulative, fulfilledDemand comes from nonCumulativeFlow.fulfilledDemand
        expect(energy!.fulfilledDemand).toBe(40);
        expect(energy!.unmetDemand).toBe(180); // 220 - 40
        expect(energy!.imbalance).toBeLessThanOrEqual(1);
        expect(energy!.imbalance).toBeGreaterThanOrEqual(-1);
    });

    it("handles zero demand", () => {
        const input = createMockInput();
        input.householdDesiredDemand = {};
        input.sectorDesiredDemand = {};
        input.capitalDesiredDemand = {};
        input.householdFulfilledDemand = {};
        input.sectorFulfilledDemand = {};
        input.capitalFulfilledDemand = {};

        const metrics = marketMetricsCalculator(input);

        const tourism = metrics.find(m => m.good === "tourism");
        expect(tourism!.desiredDemand).toBe(0);
        expect(tourism!.fulfilledDemand).toBe(0);
        expect(tourism!.imbalance).toBe(0);
    });

    it("handles zero supply with positive demand", () => {
        const input = createMockInput();
        input.openingInventory = {};
        input.goodsProduction = {};
        input.nonCumulativeFlow = { productionAvailable: {}, fulfilledDemand: {} };

        const metrics = marketMetricsCalculator(input);

        const energy = metrics.find(m => m.good === "energy");
        expect(energy!.availableSupply).toBe(0);
        expect(energy!.desiredDemand).toBeGreaterThan(0);
        expect(energy!.imbalance).toBe(1);
    });

    it("non-cumulative goods use flow execution results", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        for (const good of NON_CUMULATING_GOODS) {
            const m = metrics.find(m => m.good === good);
            expect(m).toBeDefined();
            expect(m!.availableSupply).toBe(m!.productionAvailable);
            expect(m!.openingInventory).toBe(0);
        }
    });

    it("sector desired demand uses full scale (actualScale=1)", () => {
        const input = createMockInput();
        input.sectorDesiredDemand = { energy: 100 };
        const metrics = marketMetricsCalculator(input);
        const energy = metrics.find(m => m.good === "energy");
        expect(energy!.desiredDemand).toBe(220);
    });

    it("non-cumulative flow uses actual flow execution", () => {
        const input = createMockInput();
        const metrics = marketMetricsCalculator(input);

        for (const good of NON_CUMULATING_GOODS) {
            const m = metrics.find(m => m.good === good);
            expect(m!.availableSupply).toBe(m!.productionAvailable);
            expect(m!.openingInventory).toBe(0);
        }
    });

    it("throws on missing oldPrices", () => {
        const input = createMockInput();
        input.oldPrices = { energy: 20 };
        expect(() => marketMetricsCalculator(input)).toThrow("Missing price for food");
    });

    it("throws on invalid oldPrices (zero/negative)", () => {
        const input = createMockInput();
        // tourism is non-cumulative, use it to test
        input.oldPrices = { ...input.oldPrices, tourism: 0 };
        expect(() => marketMetricsCalculator(input)).toThrow("Invalid price for tourism");
    });
});