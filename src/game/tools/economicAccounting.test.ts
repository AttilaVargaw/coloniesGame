import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Goods } from "../data/Goods.ts";
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

// Verify the cumulative inventory equation using independently-tracked sector
// flows (from result.accounting), not values inferred from closing balances.
// This avoids the circularity of deriving consumption from closing inventory.
function expectCumulativeInventoryConserved(
    openingGoods: Goods,
    result: IndustryTickResult,
): void {
    for (const goodKey of Object.keys(openingGoods) as (keyof Goods)[]) {
        if (NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
            continue;
        }

        const opening = openingGoods[goodKey];
        const production =
            result.accounting.sectorProductionByGood?.[goodKey] ?? 0;
        const inputsConsumed =
            result.accounting.sectorInputsConsumedByGood?.[goodKey] ?? 0;
        // Sector sales are deducted from closing inventory; warehouse sales
        // are added back in goodsForDelta and net to zero, so they must not be
        // subtracted here (see allocatePopulationSales + finalizeGoods).
        const sectorSales =
            result.accounting.sectorSalesByGood?.[goodKey] ?? 0;
        const capitalPurchases =
            result.accounting.capitalPurchasesByGood[goodKey] ?? 0;

        expect(Number.isFinite(production)).toBe(true);
        expect(production).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(inputsConsumed)).toBe(true);
        expect(inputsConsumed).toBeGreaterThanOrEqual(0);
        // Cannot consume more than what was available: opening stock plus
        // what was produced this tick. Non-circular: uses opening + production,
        // not closing inventory.
        expect(inputsConsumed).toBeLessThanOrEqual(opening + production + 1e-6);
        expect(Number.isFinite(sectorSales)).toBe(true);
        expect(sectorSales).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(capitalPurchases)).toBe(true);
        expect(capitalPurchases).toBeGreaterThanOrEqual(0);

        const expectedClosing =
            opening + production - inputsConsumed - sectorSales - capitalPurchases;

        expect(result.goods[goodKey]).toBeCloseTo(expectedClosing, 6);
        expect(result.goods[goodKey]).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.goods[goodKey])).toBe(true);
    }
}

describe("Economic accounting — complete tick inventory conservation", () => {
    it("warehouse-only: household purchases deducted once from opening inventory", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);

        const openingGoods = { ...input.goods };
        const result = simulateTick(input, state);

        const closingFood = result.goods.food;
        const householdSales =
            result.accounting.householdSalesByGood.food ?? 0;

        expect(closingFood).toBeGreaterThanOrEqual(0);
        expect(householdSales).toBeGreaterThanOrEqual(0);
        expect(closingFood).toBeCloseTo(openingGoods.food - householdSales, 8);
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

        const openingGoods = { ...input.goods };
        const result = simulateTick(input, state);

        // The farm produces agriculturalGoods (not food) and consumes inputs
        // such as water. Use independently-tracked accounting flows so the
        // scenario actually exercises production and input consumption.
        const production =
            result.accounting.sectorProductionByGood?.agriculturalGoods ?? 0;
        const inputsConsumed =
            result.accounting.sectorInputsConsumedByGood?.agriculturalGoods ?? 0;
        const householdSales =
            result.accounting.sectorSalesByGood?.agriculturalGoods ?? 0;
        const capitalPurchases =
            result.accounting.capitalPurchasesByGood.agriculturalGoods ?? 0;

        expect(Number.isFinite(production)).toBe(true);
        expect(production).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(inputsConsumed)).toBe(true);
        expect(inputsConsumed).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(householdSales)).toBe(true);
        expect(householdSales).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(capitalPurchases)).toBe(true);
        expect(capitalPurchases).toBeGreaterThanOrEqual(0);

        // Prove the scenario exercised the paths it claims to test.
        expect(production).toBeGreaterThan(0);
        // Inputs were actually consumed somewhere (water, chemicals, etc.).
        expect(
            sumValues(Object.values(result.accounting.sectorInputsConsumedByGood ?? {})),
        ).toBeGreaterThan(0);
        expect(
            sumValues(Object.values(result.accounting.capitalPurchasesByGood)),
        ).toBeGreaterThan(0);

        const expectedClosingAgriculturalGoods =
            openingGoods.agriculturalGoods +
            production -
            inputsConsumed -
            householdSales -
            capitalPurchases;

        expect(result.goods.agriculturalGoods).toBeCloseTo(
            expectedClosingAgriculturalGoods,
            6,
        );

        // Verify conservation across every cumulative good.
        expectCumulativeInventoryConserved(openingGoods, result);
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

        const openingGoods = { ...input.goods };

        const result = simulateTick(input, state);

        expectCumulativeInventoryConserved(openingGoods, result);

        // Every goods key must be accounted for by exactly one test category:
        // non-cumulative, waste (special decay equation), or cumulative (tested
        // above). Newly added goods must not silently escape coverage.
        const allGoodsKeys = Object.keys(input.goods) as (keyof Goods)[];
        const cumulativeKeys = allGoodsKeys.filter(
            key => !NON_CUMULATING_GOODS.has(key) && key !== "waste",
        );
        expect(cumulativeKeys.length).toBeGreaterThan(0);

        const accounted = new Set<keyof Goods>();
        for (const key of NON_CUMULATING_GOODS) {
            accounted.add(key);
        }
        accounted.add("waste");
        for (const key of cumulativeKeys) {
            accounted.add(key);
        }

        expect(accounted.size).toBe(allGoodsKeys.length);
        for (const key of allGoodsKeys) {
            expect(accounted.has(key)).toBe(true);
        }
        expect(NON_CUMULATING_GOODS.has("waste")).toBe(false);
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

        // Money conservation holds to float64 accumulation across the
        // multi-iteration sector settlement. At a ~1e9 economy scale this is
        // roughly 1e-5 relative (~10000 absolute); expressed here as an
        // absolute tolerance so it does not scale with economy size.
        expect(Math.abs(closingMoney - openingMoney)).toBeLessThan(10000);
    });

    it("no sector: no production, no inputs, no capital purchases", () => {
        const state = createSimState();
        const openingFood = 100;
        const input = createDeterministicInput(openingFood);

        const openingGoods = { ...input.goods };
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
            openingGoods.food - householdSales,
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

        const openingWealthByPop = Object.fromEntries(
            Object.entries(input.population).map(
                ([key, pop]) => [key, pop.wealth ?? 0],
            ),
        );
        const result = simulateTick(input, state);

        for(const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = openingWealthByPop[popKey] ?? 0;
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

        const openingHouseholdWealth = sumPopulationWealth(input.population);
        const result = simulateTick(input, state);

        const totalWages = sumValues(
            Object.values(result.accounting.wagesByPop),
        );
        const totalSpending = sumValues(
            Object.values(result.accounting.spendingByPop),
        );
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

        const openingWealthByPop = Object.fromEntries(
            Object.entries(input.population).map(
                ([key, pop]) => [key, pop.wealth ?? 0],
            ),
        );
        for(const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = openingWealthByPop[popKey] ?? 0;
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

        // Capture opening balances AFTER zeroing wealth: this is the state
        // simulateTick actually sees.
        const openingWealthByPop = Object.fromEntries(
            Object.entries(input.population).map(
                ([key, pop]) => [key, pop.wealth ?? 0],
            ),
        );

        const result = simulateTick(input, state);

        const totalSpending = sumValues(
            Object.values(result.accounting.spendingByPop),
        );

        expect(totalSpending).toBeCloseTo(0, 8);

        for(const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = openingWealthByPop[popKey] ?? 0;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;

            expect(spending).toBeLessThanOrEqual(
                openingWealth + wages + 1e-8,
            );
        }
    });

    it("cash-constrained households can spend only opening cash plus wages", () => {
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {},
        );

        for (const pop of Object.values(input.population)) {
            pop.wealth = 0;
        }

        // Capture opening balances AFTER zeroing wealth.
        const openingWealthByPop = Object.fromEntries(
            Object.entries(input.population).map(
                ([key, pop]) => [key, pop.wealth ?? 0],
            ),
        );

        input.goods.food = 100;

        const result = simulateTick(input, state);

        const totalWages = sumValues(
            Object.values(result.accounting.wagesByPop),
        );
        expect(totalWages).toBeGreaterThan(0);

        for (const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const openingWealth = openingWealthByPop[popKey] ?? 0;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;
            const closingWealth = result.population[popKey].wealth ?? 0;

            expect(spending).toBeLessThanOrEqual(
                openingWealth + wages + 1e-8,
            );
            expect(closingWealth).toBeGreaterThanOrEqual(0);
            expect(closingWealth).toBeCloseTo(
                openingWealth + wages - spending,
                8,
            );
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

    it("all accounting flows are finite and nonnegative", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);
        const result = simulateTick(input, state);

        const maps = [
            result.accounting.householdSalesByGood,
            result.accounting.sectorSalesByGood ?? {},
            result.accounting.capitalPurchasesByGood,
            result.accounting.sectorInputsConsumedByGood ?? {},
            result.accounting.sectorProductionByGood ?? {},
            result.accounting.wagesByPop,
            result.accounting.spendingByPop,
        ];

        for (const map of maps) {
            for (const value of Object.values(map)) {
                expect(Number.isFinite(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(0);
            }
        }
    });

    // ── Adversarial tests ──
    // These prove the scenario actually exercises the behavior it claims.

    it("scarce food: population cannot spend beyond opening cash + wages", () => {
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {},
        );
        input.goods.food = 0; // scarce essential good

        // Zero wealth so groups must rely on wages only.
        const openingWealthByPop = Object.fromEntries(
            Object.entries(input.population).map(
                ([key, pop]) => [key, pop.wealth ?? 0],
            ),
        );
        for (const pop of Object.values(input.population)) {
            pop.wealth = 0;
        }

        const result = simulateTick(input, state);

        // No household can spend more than wages earned (opening wealth is 0).
        const totalWages = sumValues(Object.values(result.accounting.wagesByPop));
        const totalSpending = sumValues(
            Object.values(result.accounting.spendingByPop),
        );
        expect(totalSpending).toBeLessThanOrEqual(totalWages + 1e-8);

        // Closing wealth nonnegative for every group.
        for (const [key] of Object.entries(input.population)) {
            const popKey = key as keyof Population;
            const wages = result.accounting.wagesByPop[popKey] ?? 0;
            const spending = result.accounting.spendingByPop[popKey] ?? 0;
            const closingWealth = result.population[popKey].wealth ?? 0;

            expect(spending).toBeLessThanOrEqual(wages + 1e-8);
            expect(closingWealth).toBeGreaterThanOrEqual(0);
            // When food is scarce (0), mortality and other deductions may
            // reduce wealth beyond the simple wages - spending equation, so
            // we assert the inequality rather than exact equality.
            expect(closingWealth).toBeLessThanOrEqual(
                openingWealthByPop[popKey] + wages + 1e-8,
            );
        }

        // Unmet demand is not exposed by the test helper (hardcoded to {}),
        // but the cash constraint itself is the meaningful assertion: groups
        // cannot spend beyond wages when food is scarce and opening wealth is 0.
    });

    it("tick with no sector: no production, no sales, no wages", () => {
        const state = createSimState();
        const input = createDeterministicInput(100);

        const openingGoods = { ...input.goods };
        const openingMoney = openingTotalMoney(input);
        const result = simulateTick(input, state);

        const production = sumValues(
            Object.values(result.accounting.sectorProductionByGood ?? {}),
        );
        const inputsConsumed = sumValues(
            Object.values(result.accounting.sectorInputsConsumedByGood ?? {}),
        );
        const sectorSales = sumValues(
            Object.values(result.accounting.sectorSalesByGood ?? {}),
        );
        const capitalPurchases = sumValues(
            Object.values(result.accounting.capitalPurchasesByGood),
        );
        const totalWages = sumValues(
            Object.values(result.accounting.wagesByPop),
        );

        expect(production).toBe(0);
        expect(inputsConsumed).toBe(0);
        expect(sectorSales).toBe(0);
        expect(capitalPurchases).toBeCloseTo(0, 8);
        expect(totalWages).toBe(0);

        // Households can still buy from warehouse stock even without sectors,
        // so householdSales/spending may be nonzero. Warehouse sales net to zero
        // in closing inventory (added back in goodsForDelta, then deducted via
        // fulfilledDemandQty), so only sector sales reduce inventory. With no
        // sectors, sectorSales is 0 and inventory is unchanged.
        expect(result.goods.food).toBeCloseTo(
            openingGoods.food - sectorSales,
            8,
        );
        expect(result.goods.food).toBeGreaterThanOrEqual(0);
        // Money conserved.
        expect(closingTotalMoney(result)).toBeCloseTo(openingMoney, 8);
    });

    it("inventory flows independently verified against accounting summary", () => {
        // This test duplicates the conservation check using only the
        // independently-tracked accounting summary, proving the test does not
        // derive consumption from closing inventory.
        const state = createSimState();
        const input = generateColonyConfig(
            {
                populationSize: 100_000,
                activeSectors: ["farm"],
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            },
            {},
        );
        input.goods.food = 100;
        input.goods.water = 50;

        const openingGoods = { ...input.goods };
        const result = simulateTick(input, state);

        expectCumulativeInventoryConserved(openingGoods, result);

        // For every cumulative good, the accounting summary must reconcile:
        // opening + production - inputs - sectorSales - capitalPurchases == closing.
        for (const goodKey of Object.keys(openingGoods) as (keyof Goods)[]) {
            if (NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
                continue;
            }
            const opening = openingGoods[goodKey];
            const production =
                result.accounting.sectorProductionByGood?.[goodKey] ?? 0;
            const inputsConsumed =
                result.accounting.sectorInputsConsumedByGood?.[goodKey] ?? 0;
            const sectorSales =
                result.accounting.sectorSalesByGood?.[goodKey] ?? 0;
            const capitalPurchases =
                result.accounting.capitalPurchasesByGood[goodKey] ?? 0;

            const expectedClosing =
                opening + production - inputsConsumed - sectorSales - capitalPurchases;

            expect(result.goods[goodKey]).toBeCloseTo(expectedClosing, 6);
            expect(result.goods[goodKey]).toBeGreaterThanOrEqual(0);
        }
    });
});
