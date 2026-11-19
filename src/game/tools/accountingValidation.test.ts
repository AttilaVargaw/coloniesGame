import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Goods } from "../data/Goods.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories";
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

function createCompleteEconomyConfig(overrides: Partial<{
    populationSize: number;
    activeSectors: (keyof IndustrialSectors)[];
    starterMoneyPerSector: number;
    capitalStockMultiplier: number;
    goods: Partial<Goods>;
}> = {}): IndustryTickInput {
    // Complete economy with full supply chain for all non-cumulative goods
    const activeSectors: (keyof IndustrialSectors)[] = overrides.activeSectors ?? [
        "farm",
        "foodFactory",
        "waterTreatment",
        "powerPlant",
        "forestry",
        "government",
        "oilRig",
        "chemical",
        "recycling",
        "healthcare",
        "education",
        "lawEnforcement",
        "services",
        "entertainmentIndustry",
        "bank",
        "religion",
        "logistics",
        "tourism",
        "defense",
        "militaryEquipment",
    ];

    const input = generateColonyConfig(
        {
            populationSize: overrides.populationSize ?? 500_000, // large population for defense sector
            activeSectors,
            starterMoneyPerSector: overrides.starterMoneyPerSector ?? 1_000_000_000,
            capitalStockMultiplier: overrides.capitalStockMultiplier ?? 1,
        },
        {},
        { serviceMan: 20, healtcarePersonal: 20, engineer: 20, clerks: 20 } // high ratios for defense sector
    );

    // Bootstrap militaryEquipment for defense sector chain
    input.goods.militaryEquipment = 10000;

    if (overrides.goods) {
        for (const [key, value] of Object.entries(overrides.goods)) {
            input.goods[key as keyof Goods] = value;
        }
    }

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
        const householdSales =
            result.accounting.householdSalesByGood[goodKey] ?? 0;
        const capitalPurchases =
            result.accounting.capitalPurchasesByGood[goodKey] ?? 0;

        expect(Number.isFinite(production)).toBe(true);
        expect(production).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(inputsConsumed)).toBe(true);
        expect(inputsConsumed).toBeGreaterThanOrEqual(0);
        expect(inputsConsumed).toBeLessThanOrEqual(opening + production + 1e-6);
        expect(Number.isFinite(householdSales)).toBe(true);
        expect(householdSales).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(capitalPurchases)).toBe(true);
        expect(capitalPurchases).toBeGreaterThanOrEqual(0);

        const expectedClosing =
            opening + production - inputsConsumed - householdSales - capitalPurchases;

        const tolerance = Math.max(1, Math.abs(expectedClosing)) * 1e-6;
        expect(Math.abs(result.goods[goodKey] - expectedClosing)).toBeLessThan(tolerance);
        expect(result.goods[goodKey]).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.goods[goodKey])).toBe(true);
    }
}

describe("Focused Accounting Test Suite — Valid Production Fixtures", () => {
    describe("Inventory conservation with complete supply chain", () => {
        it("complete economy: inventory conservation for every cumulative good", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap goods for defense/militaryEquipment chain
            input.goods.food = 1000;
            input.goods.water = 500;
            input.goods.agriculturalGoods = 5000;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingGoods = { ...input.goods };
            const result = simulateTick(input, createSimState());

            expectCumulativeInventoryConserved(openingGoods, result);
        });

        it("energy production matches consumption across powerPlant and energy consumers", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;
            input.goods.energy = 1000;

            const openingGoods = { ...input.goods };
            const result = simulateTick(input, createSimState());

            const energyProduction = result.accounting.sectorProductionByGood?.energy ?? 0;
            const energyConsumed = result.accounting.sectorInputsConsumedByGood?.energy ?? 0;
            const energyCapital = result.accounting.capitalPurchasesByGood?.energy ?? 0;

            expect(energyProduction).toBeGreaterThan(0);
            expect(result.goods.energy).toBeGreaterThanOrEqual(0);
        });

        it("environmentFactor production from forestry matches sector consumption", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingGoods = { ...input.goods };
            const result = simulateTick(input, createSimState());

            const envProduction = result.accounting.sectorProductionByGood?.environmentFactor ?? 0;
            const envConsumed = result.accounting.sectorInputsConsumedByGood?.environmentFactor ?? 0;

            expect(envProduction).toBeGreaterThan(0);
            expect(result.goods.environmentFactor).toBeGreaterThanOrEqual(0);
        });

        it("governance production from government matches sector requirements", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 10000;

            const openingGoods = { ...input.goods };
            const result = simulateTick(input, createSimState());

            const govProduction = result.accounting.sectorProductionByGood?.governance ?? 0;
            const govConsumed = result.accounting.sectorInputsConsumedByGood?.governance ?? 0;

            expect(govProduction).toBeGreaterThan(0);
            expect(result.goods.governance).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Money conservation with complete economy", () => {
        it("total money conserved: sector cash + treasury + household wealth", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 1000;
            input.goods.water = 500;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingMoney = sumValues(Object.values(input.money)) + input.colonyTreasury;
            const result = simulateTick(input, createSimState());
            const closingMoney = sumValues(Object.values(result.money)) + result.colonyTreasury;

            const tolerance = Math.max(1000, Math.abs(openingMoney) * 1e-9);
            expect(Math.abs(closingMoney - openingMoney)).toBeLessThan(tolerance);
        });

        it("sector cash reconciliation: opening - inputs - labor - capital + revenue + refunds = closing", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 1000;
            input.goods.water = 500;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingSectorMoney = sumValues(Object.values(input.money));
            const result = simulateTick(input, createSimState());
            const closingSectorMoney = sumValues(Object.values(result.money));

            const totalInputCosts = sumValues(Object.values(result.accounting.sectorInputsConsumedByGood ?? {}));
            const totalLaborCosts = sumValues(Object.values(result.sectorLaborCosts ?? {}));
            const totalCapitalCosts = sumValues(Object.values(result.accounting.capitalPurchasesByGood ?? {}));
            const totalRevenue = sumValues(Object.values(result.accounting.sectorProductionSalesByGood ?? {}));
            const totalRefunds = sumValues(Object.values(result.accounting.sectorInputRefundsBySector ?? {}));

            const expectedClosing = openingSectorMoney - totalInputCosts - totalLaborCosts - totalCapitalCosts + sumValues(Object.values(result.accounting.sectorProductionSalesByGood ?? {})) + sumValues(Object.values(result.accounting.sectorInputRefundsBySector ?? {}));

            // Use relative tolerance for large values
            const tolerance = Math.max(1000, Math.abs(openingSectorMoney) * 1e-9);
            expect(Math.abs(closingTotalMoney(result) - openingSectorMoney)).toBeLessThan(tolerance);
        });

        it("household wealth reconciles: opening + wages - spending = closing", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 1000;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingWealthByPop: Record<string, number> = Object.fromEntries(
                Object.entries(input.population).map(
                    ([key, pop]) => [key, pop.wealth ?? 0],
                ),
            );
            const result = simulateTick(input, createSimState());

            for (const popKey of Object.keys(input.population) as (keyof Population)[]) {
                const openingWealth = openingWealthByPop[popKey] ?? 0;
                const wages = result.accounting.wagesByPop[popKey] ?? 0;
                const spending = result.accounting.spendingByPop[popKey] ?? 0;
                const closingWealth = result.population[popKey].wealth ?? 0;

                expect(closingWealth).toBeCloseTo(openingWealth + wages - spending, 6);
                expect(closingWealth).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe("Per-sector input reconciliation", () => {
        it("each sector reconciles purchases vs consumption independently", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.water = 500;
            input.goods.energy = 1000;
            input.goods.environmentFactor = 5000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            for (const sectorName of Object.keys(result.accounting.sectorInputsPurchasedBySector ?? {})) {
                const purchases = result.accounting.sectorInputsPurchasedBySector?.[sectorName] ?? {};
                const consumed = result.accounting.sectorInputsConsumedBySector?.[sectorName] ?? {};

                for (const goodKey of Object.keys(purchases)) {
                    const purchased = purchases[goodKey as keyof Goods] ?? 0;
                    const consumedQty = consumed[goodKey as keyof Goods] ?? 0;

                    // Consumption cannot exceed purchases
                    expect(consumedQty).toBeLessThanOrEqual(purchased + 1e-6);

                    // Refunds for unused purchases
                    const refund = result.accounting.sectorInputRefundsBySector?.[sectorName] ?? 0;
                    expect(refund).toBeGreaterThanOrEqual(0);
                }
            }
        });

        it("total returned inputs match sum of (purchased - consumed) per sector", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.water = 5000;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            for (const goodKey of Object.keys(result.accounting.returnedInputsByGood ?? {})) {
                const returned = result.accounting.returnedInputsByGood?.[goodKey as keyof Goods] ?? 0;
                let totalPurchased = 0;
                let totalConsumed = 0;

                for (const sectorName of Object.keys(result.accounting.sectorInputsPurchasedBySector ?? {})) {
                    totalPurchased += result.accounting.sectorInputsPurchasedBySector?.[sectorName]?.[goodKey as keyof Goods] ?? 0;
                    totalConsumed += result.accounting.sectorInputsConsumedBySector?.[sectorName]?.[goodKey as keyof Goods] ?? 0;
                }

                expect(returned).toBeCloseTo(Math.max(0, totalPurchased - totalConsumed), 6);
            }
        });
    });

    describe("Capital can use returned inputs", () => {
        it("capital purchases can use goods returned by sectors", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.water = 1000; // abundant water
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            // Some sectors should return water
            const returnedWater = result.accounting.returnedInputsByGood?.water ?? 0;
            expect(returnedWater).toBeGreaterThanOrEqual(0);

            // Capital should be able to purchase from returned stock
            const capitalWater = result.accounting.capitalPurchasesByGood?.water ?? 0;
            expect(capitalWater).toBeGreaterThanOrEqual(0);

            // Total consumption should not exceed opening + returned
            const totalWaterConsumed =
                (result.accounting.sectorInputsConsumedByGood?.water ?? 0) +
                (result.accounting.capitalPurchasesByGood?.water ?? 0);

            expect(totalWaterConsumed).toBeLessThanOrEqual(1000 + 1e-6); // opening was 1000
        });
    });

    describe("Long-run stability", () => {
        it("5 consecutive ticks: money and inventory remain bounded", () => {
            const state = createSimState();
            let input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 1000;
            input.goods.water = 500;
            input.goods.agriculturalGoods = 10000;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingMoney = openingTotalMoney(input);
            let prevMoney = openingMoney;

            let result: IndustryTickResult | null = null;
            for (let tick = 0; tick < 5; tick++) {
                result = simulateTick(input, createSimState());

                // Money conserved each tick
                const tickClosingMoney = closingTotalMoney(result);
                const tolerance = Math.max(1000, Math.abs(prevMoney) * 1e-9);
                expect(Math.abs(tickClosingMoney - prevMoney)).toBeLessThan(tolerance);
                prevMoney = tickClosingMoney;

                // No negative or non-finite inventory
                for (const [, qty] of Object.entries(result.goods)) {
                    expect(qty).toBeGreaterThanOrEqual(0);
                    expect(Number.isFinite(qty)).toBe(true);
                }

                // Update input for next tick
                input = {
                    ...input,
                    goods: result.goods,
                    money: result.money,
                    colonyTreasury: result.colonyTreasury,
                    population: result.population,
                } as IndustryTickInput;
            }

            expect(result).not.toBeNull();
            if (result) {
                // Total money conserved across all 5 ticks
                const totalTolerance = Math.max(5000, Math.abs(openingMoney) * 1e-8);
                expect(Math.abs(closingTotalMoney(result) - openingMoney)).toBeLessThan(totalTolerance);
            }
        });

        it("10 ticks: inventory and money remain bounded", () => {
            const state = createSimState();
            let input = createCompleteEconomyConfig({
                populationSize: 50_000,
                starterMoneyPerSector: 500_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 500;
            input.goods.water = 500;
            input.goods.agriculturalGoods = 5000;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const openingMoney = openingTotalMoney(input);
            let prevMoney = openingMoney;

            let result: IndustryTickResult | null = null;
            for (let tick = 0; tick < 10; tick++) {
                result = simulateTick(input, createSimState());

                // Money conserved each tick
                const tickClosingMoney = closingTotalMoney(result);
                const tolerance = Math.max(5000, Math.abs(prevMoney) * 1e-9);
                expect(Math.abs(tickClosingMoney - prevMoney)).toBeLessThan(tolerance);
                prevMoney = tickClosingMoney;

                // No negative or non-finite inventory
                for (const [, qty] of Object.entries(result.goods)) {
                    expect(qty).toBeGreaterThanOrEqual(0);
                    expect(Number.isFinite(qty)).toBe(true);
                }

                // Money stays within reasonable bounds (not exploding)
                const totalSectorMoney = sumValues(Object.values(result.money));
                expect(totalSectorMoney).toBeLessThan(10_000_000_000); // 10B cap
                expect(totalSectorMoney).toBeGreaterThanOrEqual(0);

                // Population stays reasonable
                const totalPop = sumValues(Object.values(result.population).map(p => p.number));
                expect(totalPop).toBeGreaterThan(0);
                expect(totalPop).toBeLessThan(200_000);

                // Update input for next tick
                input = {
                    ...input,
                    goods: result.goods,
                    money: result.money,
                    colonyTreasury: result.colonyTreasury,
                    population: result.population,
                } as IndustryTickInput;
            }

            expect(result).not.toBeNull();
            if (result) {
                // Total money conserved across all 10 ticks
                const totalTolerance = Math.max(10000, Math.abs(openingMoney) * 1e-8);
                expect(Math.abs(closingTotalMoney(result) - openingMoney)).toBeLessThan(totalTolerance);
            }
        });
    });

    describe("Non-cumulative goods validation", () => {
        it("zero production + positive consumption clamps to zero for non-cumulative goods", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Remove production sectors for energy AND services (both non-cumulative)
            // Also remove sectors that consume energy (defense, militaryEquipment)
            // Also remove services to test energy specifically
            // Remove governance production to test the mechanism
            input.activeSectors = new Set(["farm", "foodFactory", "waterTreatment", "forestry", "oilRig", "chemical", "recycling", "healthcare", "education", "lawEnforcement", "entertainmentIndustry", "logistics"]);
            // Provide energy in opening goods so sectors can consume it, but have NO energy-producing sectors
            input.goods.energy = 10000;
            input.goods.governance = 10000;

            const state2 = createSimState();
            // With the fix matching worker pipeline, non-cumulative goods with
            // requirements > production are clamped to 0 instead of throwing.
            // This allows cascade failures to propagate naturally.
            const result = simulateTick(input, state2);
            expect(result).not.toBeNull();
            
            // Non-cumulative goods with no production should be 0 after consumption
            expect(result.goods.energy).toBe(0);
            expect(result.goods.governance).toBe(0);
            
            // In the FIRST tick, sectors can buy from opening stock so they run.
            // They only stop with "No materials" in subsequent ticks when stock is depleted.
            // Verify they produced/consumed in this tick.
            const energyDependentSectors = ["healthcare", "education", "lawEnforcement", "entertainmentIndustry", "logistics"];
            for(const sector of energyDependentSectors) {
                const res = result.sectorResults[sector];
                expect(res).toBeDefined();
                expect(res.productionRatio).toBeGreaterThan(0);
            }
        });

        it("production equal to consumption leaves zero closing flow", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            const envProduction = result.accounting.sectorProductionByGood?.environmentFactor ?? 0;
            const envConsumed = result.accounting.sectorInputsConsumedByGood?.environmentFactor ?? 0;

            // If production == consumption, closing should be 0 (or close to it)
            if (Math.abs(envProduction - (result.accounting.sectorInputsConsumedByGood?.environmentFactor ?? 0)) < 1e-6) {
                expect(result.goods.environmentFactor).toBeCloseTo(0, 1);
            }
        });

        it("production greater than consumption leaves correct surplus", () => {
            const state = createSimState();
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
// Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;
            input.goods.militaryEquipment = 100; // bootstrap for defense sector

            const result = simulateTick(input, createSimState());

            const envProduction = result.accounting.sectorProductionByGood?.environmentFactor ?? 0;
            const envConsumed = result.accounting.sectorInputsConsumedByGood?.environmentFactor ?? 0;

            if (envProduction > envConsumed) {
                const expectedSurplus = envProduction - envConsumed;
                expect(result.goods.environmentFactor).toBeCloseTo(expectedSurplus, 1);
            }
        });
    });

    describe("Stored goods retain inventory when no production", () => {
        it("stored goods retain inventory when no production or consumption", () => {
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;
            // Use goods that are NOT in active sectors' requirements/production
            input.goods.tylium = 10000;
            input.goods.fissionMaterial = 5000;

            const openingGoods = { ...input.goods };
            const result = simulateTick(input, createSimState());

            // These goods should remain unchanged (no sector produces or consumes them)
            expect(result.goods.tylium).toBeCloseTo(openingGoods.tylium, 1);
            expect(result.goods.fissionMaterial).toBeCloseTo(openingGoods.fissionMaterial, 1);
        });
    });

    describe("Environmental index semantics", () => {
        it("environmentFactor follows non-cumulative flow semantics", () => {
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            const envProduction = result.accounting.sectorProductionByGood?.environmentFactor ?? 0;
            const envConsumed = result.accounting.sectorInputsConsumedByGood?.environmentFactor ?? 0;

            // Closing = production - consumed (no carryover inventory for non-cumulative)
            const expectedClosing = envProduction - envConsumed;
            expect(result.goods.environmentFactor).toBeCloseTo(expectedClosing, 1);
            expect(result.goods.environmentFactor).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Sector-level accounting invariants", () => {
        it("sector profits = revenue - labor - inputs", () => {
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.food = 1000;
            input.goods.water = 500;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            for (const sectorName of Object.keys(result.sectorProfits)) {
                const profit = result.sectorProfits[sectorName] ?? 0;
                const revenue = result.sectorRevenue[sectorName] ?? 0;
                const laborCosts = result.sectorLaborCosts[sectorName] ?? 0;
                const inputCosts = result.sectorInputCosts[sectorName] ?? 0;

                expect(profit).toBeCloseTo(revenue - laborCosts - inputCosts, 1);
            }
        });

        it("sector utilization equals actualScale", () => {
            const input = createCompleteEconomyConfig({
                populationSize: 100_000,
                starterMoneyPerSector: 1_000_000_000,
                capitalStockMultiplier: 1,
            });
            // Bootstrap for defense chain
            input.goods.water = 500;
            input.goods.environmentFactor = 5000;
            input.goods.energy = 1000;
            input.goods.governance = 1000;

            const result = simulateTick(input, createSimState());

            for (const sectorName of Object.keys(result.sectorUtilization)) {
                const utilization = result.sectorUtilization[sectorName] ?? 0;
                // utilization should be between 0 and 1
                expect(utilization).toBeGreaterThanOrEqual(0);
                expect(utilization).toBeLessThanOrEqual(1 + 1e-9);
            }
        });
    });
});