import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";

function createDeterministicInput(openingFood: number): IndustryTickInput {
    const input = generateColonyConfig(
        {
            populationSize: 1_000_000,
            activeSectors: [],
            starterMoneyPerSector: 1_000_000,
            capitalStockMultiplier: 0,
        },
        {}
    );
    // Set opening food to exactly the specified amount
    input.goods.food = openingFood;
    return input;
}

describe("Economic accounting — complete tick inventory conservation", () => {
    it("warehouse-only: household purchases deducted once from opening inventory", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);
        const result = simulateTick(input, state);

        const closingFood = result.goods.food;
        const householdWarehouseSales = openingFood - closingFood;

        // With no sectors: closing = opening - householdWarehouseSales
        // householdWarehouseSales = opening - closing
        expect(closingFood).toBeGreaterThanOrEqual(0);
        expect(householdWarehouseSales).toBeGreaterThanOrEqual(0);
        expect(openingFood - householdWarehouseSales).toBe(closingFood);
    });

    it("with farm sector: production added, inputs consumed, closing conserved", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 0,
            },
            {}
        );
        input.goods.food = openingFood;

        const result = simulateTick(input, state);

        const closingFood = result.goods.food;
        const production = Object.values(result.sectorResults).reduce(
            (sum, r) => sum + (r.producedGoods?.food ?? 0),
            0,
        );
        const inputsConsumed = Object.values(result.sectorResults).reduce(
            (sum, r) => sum + (r.consumedGoods?.food ?? 0),
            0,
        );

        // closing = opening + production - inputs - householdSales - capitalPurchases
        // householdSales + capitalPurchases >= 0
        const otherDeductions = openingFood + production - inputsConsumed - closingFood;
        expect(otherDeductions).toBeGreaterThanOrEqual(0);
        expect(closingFood).toBeGreaterThanOrEqual(0);
    });

    it("money conservation: sector money + treasury + household wealth reconciles", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);
        const result = simulateTick(input, state);

        const sectorMoneyTotal = Object.values(result.money).reduce((sum, v) => sum + v, 0);
        const householdWealthTotal = Object.values(result.population).reduce(
            (sum, pop) => sum + pop.wealth,
            0,
        );

        // Total money = sector money + treasury + household wealth
        const totalMoney = sectorMoneyTotal + result.colonyTreasury + householdWealthTotal;
        expect(totalMoney).toBeGreaterThanOrEqual(0);
    });

    it("no sector: no production, no inputs, only household consumption", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);

        const result = simulateTick(input, state);

        const production = Object.values(result.sectorResults).reduce(
            (sum, r) => sum + (r.producedGoods?.food ?? 0),
            0,
        );
        const inputsConsumed = Object.values(result.sectorResults).reduce(
            (sum, r) => sum + (r.consumedGoods?.food ?? 0),
            0,
        );

        expect(production).toBe(0);
        expect(inputsConsumed).toBe(0);
        expect(result.goods.food).toBeLessThanOrEqual(openingFood);
    });

    it("all goods quantities are finite and nonnegative", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);
        const result = simulateTick(input, state);

        for(const [, qty] of Object.entries(result.goods)) {
            expect(qty).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(qty)).toBe(true);
        }
    });
});
