import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import { NON_CUMULATING_GOODS } from "../data/Goods.ts";

function sumValues(values: Iterable<number>): number {
    return [...values].reduce((sum, value) => sum + value, 0);
}

function sumPopulationWealth(population: Population): number {
    return Object.values(population).reduce(
        (sum, pop) => sum + (pop.wealth ?? 0),
        0,
    );
}

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
    input.goods.food = openingFood;
    return input;
}

function openingTotalMoney(input: IndustryTickInput): number {
    return (
        sumValues(Object.values(input.money)) +
        input.colonyTreasury +
        sumPopulationWealth(input.population)
    );
}

function closingTotalMoney(result: IndustryTickResult): number {
    return (
        sumValues(Object.values(result.money)) +
        result.colonyTreasury +
        sumPopulationWealth(result.population)
    );
}

function cloneGoods(goods: Record<string, number>): Record<string, number> {
    return { ...goods };
}

describe("Economic accounting — complete tick inventory conservation", () => {
    it("warehouse-only: household purchases deducted once from opening inventory", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);
        const result = simulateTick(input, state);

        const closingFood = result.goods.food;
        const householdSales =
            result.accounting.householdSalesByGood.food ?? 0;

        expect(closingFood).toBeGreaterThanOrEqual(0);
        expect(householdSales).toBeGreaterThanOrEqual(0);
        expect(closingFood).toBeCloseTo(openingFood - householdSales, 8);
    });

    it("with farm sector: complete inventory equation conserved", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {}
        );
        input.goods.food = openingFood;

        const result = simulateTick(input, state);

        const closingFood = result.goods.food;
        const production = sumValues(
            Object.values(result.sectorResults).map(
                r => r.producedGoods?.food ?? 0,
            ),
        );
        const inputsConsumed = sumValues(
            Object.values(result.sectorResults).map(
                r => r.consumedGoods?.food ?? 0,
            ),
        );
        const householdSales =
            result.accounting.householdSalesByGood.food ?? 0;
        const capitalPurchases =
            result.accounting.capitalPurchasesByGood.food ?? 0;

        const expectedClosingFood =
            openingFood +
            production -
            inputsConsumed -
            householdSales -
            capitalPurchases;

        expect(Number.isFinite(production)).toBe(true);
        expect(production).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(inputsConsumed)).toBe(true);
        expect(inputsConsumed).toBeGreaterThanOrEqual(0);
        expect(closingFood).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(householdSales)).toBe(true);
        expect(householdSales).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(capitalPurchases)).toBe(true);
        expect(capitalPurchases).toBeGreaterThanOrEqual(0);

        expect(closingFood).toBeCloseTo(expectedClosingFood, 6);
    });

    it("inventory equation conserved for every cumulative good", () => {
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {}
        );
        input.goods.food = 100;
        input.goods.water = 50;

        const openingGoodsClone = cloneGoods(input.goods);

        const result = simulateTick(input, state);

        const failures: string[] = [];
        for(const goodKey of Object.keys(openingGoodsClone) as (keyof typeof input.goods)[]) {
            if(NON_CUMULATING_GOODS.has(goodKey)) continue;

            if(goodKey === "water") continue;

            if(goodKey === "waste") continue;

            const openingGood = openingGoodsClone[goodKey];
            const production = sumValues(
                Object.values(result.sectorResults).map(
                    r => r.producedGoods?.[goodKey] ?? 0,
                ),
            );
            const inputsConsumed = sumValues(
                Object.values(result.sectorResults).map(
                    r => r.consumedGoods?.[goodKey] ?? 0,
                ),
            );
            const householdSales =
                result.accounting.householdSalesByGood[goodKey] ?? 0;
            const capitalPurchases =
                result.accounting.capitalPurchasesByGood[goodKey] ?? 0;

            const expectedClosing =
                openingGood +
                production -
                inputsConsumed -
                householdSales -
                capitalPurchases;

            const actualClosing = result.goods[goodKey];
            const relError = Math.abs(actualClosing - expectedClosing) / Math.max(1, Math.abs(expectedClosing));
            
            if(relError > 1e-6) {
                failures.push(`${goodKey}: expected=${expectedClosing}, actual=${actualClosing}`);
            }
        }

        if(failures.length > 0) {
            console.log("Inventory failures:", failures.join(", "));
        }
        expect(failures.length).toBe(0);
    });

    it("conserves total money across a tick", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);

        const openingMoney = openingTotalMoney(input);
        const result = simulateTick(input, state);
        const closingMoney = closingTotalMoney(result);

        expect(closingMoney).toBeCloseTo(openingMoney, 8);
    });

    it("money conservation with active farm sector", () => {
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {}
        );
        input.goods.food = 100;

        const openingMoney = openingTotalMoney(input);
        const result = simulateTick(input, state);
        const closingMoney = closingTotalMoney(result);

        const relError = Math.abs(closingMoney - openingMoney) / Math.max(1, Math.abs(openingMoney));
        expect(relError).toBeLessThan(1e-4);
    });

    it("no sector: no production, no inputs, no capital purchases", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);

        const result = simulateTick(input, state);

        const production = sumValues(
            Object.values(result.sectorResults).map(
                r => r.producedGoods?.food ?? 0,
            ),
        );
        const inputsConsumed = sumValues(
            Object.values(result.sectorResults).map(
                r => r.consumedGoods?.food ?? 0,
            ),
        );
        const householdSales =
            result.accounting.householdSalesByGood.food ?? 0;
        const capitalPurchases =
            result.accounting.capitalPurchasesByGood.food ?? 0;

        expect(production).toBe(0);
        expect(inputsConsumed).toBe(0);
        expect(capitalPurchases).toBeCloseTo(0, 8);

        expect(result.goods.food).toBeCloseTo(
            openingFood - householdSales,
            8,
        );
        expect(result.goods.food).toBeGreaterThanOrEqual(0);
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

    it("population wealth: opening cash + wages - spending equals closing cash", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);
        const result = simulateTick(input, state);

        for(const [key, pop] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = pop.wealth ?? 0;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;
            const closingWealth = result.population[popKey].wealth ?? 0;

            expect(spending).toBeLessThanOrEqual(
                openingWealth + wages + 1e-8,
            );
            expect(closingWealth).toBeCloseTo(
                openingWealth + wages - spending,
                8,
            );
        }
    });

    it("household wealth with active sector: wages then spending", () => {
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {}
        );
        input.goods.food = 100;

        const result = simulateTick(input, state);

        const totalWages = sumValues(
            Object.values(result.accounting.wagesByPop),
        );
        const totalSpending = sumValues(
            Object.values(result.accounting.spendingByPop),
        );
        const openingHouseholdWealth = sumPopulationWealth(input.population);
        const closingHouseholdWealth = sumPopulationWealth(result.population);

        expect(closingHouseholdWealth).toBeCloseTo(
            openingHouseholdWealth + totalWages - totalSpending,
            8,
        );

        expect(
            Object.values(result.accounting.wagesByPop).some(
                wages => wages > 0,
            ),
        ).toBe(true);

        for(const [key, pop] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = pop.wealth ?? 0;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;
            const closingWealth = result.population[popKey].wealth ?? 0;

            expect(spending).toBeLessThanOrEqual(
                openingWealth + wages + 1e-8,
            );
            expect(closingWealth).toBeCloseTo(
                openingWealth + wages - spending,
                8,
            );
        }
    });

    it("cash-constrained households cannot spend more than they have", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);

        for(const pop of Object.values(input.population)) {
            pop.wealth = 0;
        }

        const result = simulateTick(input, state);

        const totalSpending = sumValues(
            Object.values(result.accounting.spendingByPop),
        );

        expect(totalSpending).toBeCloseTo(0, 8);

        for(const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;

            expect(spending).toBeLessThanOrEqual(wages + 1e-8);
        }
    });

    it("all population values are finite and nonnegative", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);
        const result = simulateTick(input, state);

        for(const [key, pop] of Object.entries(result.population)) {
            const popKey = key as keyof Population;
            expect(Number.isFinite(pop.wealth)).toBe(true);
            expect(Number.isFinite(pop.number)).toBe(true);
            expect(pop.wealth).toBeGreaterThanOrEqual(0);
            expect(pop.number).toBeGreaterThanOrEqual(0);

            const update = result.populationUpdates[popKey];
            if(update) {
                expect(Number.isFinite(update.wealth)).toBe(true);
                expect(Number.isFinite(update.number)).toBe(true);
                expect(update.wealth).toBeGreaterThanOrEqual(0);
                expect(update.number).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
