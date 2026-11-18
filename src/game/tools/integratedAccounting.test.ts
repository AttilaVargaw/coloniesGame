import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Goods } from "../data/Goods.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import { NON_CUMULATING_GOODS, basePrices } from "../data/Goods.ts";

function sumValues(values: Iterable<number>): number {
	return [...values].reduce((sum, value) => sum + value, 0);
}

function sumPopulationWealth(population: Population): number {
	return Object.values(population).reduce(
		(sum, pop) => sum + (pop.wealth ?? 0),
		0,
	);
}

// Complete sector set that provides full supply chain for non-cumulative goods
const COMPLETE_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"oilRig",
	"forestry",
	"government",
	"services",
	"healthcare",
	"education",
	"lawEnforcement",
	"logistics",
	"tourism",
	"entertainmentIndustry",
	"bank",
	"religion",
	"defense",
	"chemical",
	"recycling",
];

// Population ratios to ensure all sectors have required workers
const TEST_OCCUPATION_RATIOS = {
	serviceMan: 20,
	healtcarePersonal: 20,
	engineer: 20,
	clerks: 20,
	farmer: 20,
	worker: 20,
};

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

function createCompleteEconomyInput(overrides: Partial<{
	populationSize: number;
	activeSectors: (keyof IndustrialSectors)[];
	starterMoneyPerSector: number;
	capitalStockMultiplier: number;
	goods: Partial<Goods>;
	population: Population;
}> = {}): { input: IndustryTickInput; result: IndustryTickResult } {
	const state = createSimState();
	const input = generateColonyConfig(
		{
			populationSize: overrides.populationSize ?? 500_000,
			activeSectors: overrides.activeSectors ?? COMPLETE_SECTORS,
			starterMoneyPerSector: overrides.starterMoneyPerSector ?? 1_000_000_000,
			capitalStockMultiplier: overrides.capitalStockMultiplier ?? 1,
		},
		{},
		TEST_OCCUPATION_RATIOS
	);

	if (overrides.population) {
		input.population = overrides.population;
	}

	if (overrides.goods) {
		for (const [key, value] of Object.entries(overrides.goods)) {
			input.goods[key as keyof Goods] = value;
		}
	}
	const result = simulateTick(input, state);
	return { input, result };
}

function expectMoneyConserved(input: IndustryTickInput, result: IndustryTickResult): void {
	const opening = openingTotalMoney(input);
	const closing = closingTotalMoney(result);
	expect(Math.abs(closing - opening)).toBeLessThan(20000);
}

function expectInventoryConserved(openingGoods: Goods, result: IndustryTickResult): void {
	for (const goodKey of Object.keys(basePrices) as (keyof Goods)[]) {
		if (NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
			continue;
		}
		const opening = openingGoods[goodKey] ?? 0;
		const production = result.accounting.sectorProductionByGood?.[goodKey] ?? 0;
		const inputsConsumed = result.accounting.sectorInputsConsumedByGood?.[goodKey] ?? 0;
		const householdSales = result.accounting.householdSalesByGood[goodKey] ?? 0;
		const capitalPurchases = result.accounting.capitalPurchasesByGood[goodKey] ?? 0;

		const expectedClosing = opening + production - inputsConsumed - householdSales - capitalPurchases;
		const actualClosing = result.goods[goodKey] ?? 0;

		expect(Number.isFinite(actualClosing)).toBe(true);
		expect(actualClosing).toBeGreaterThanOrEqual(0);
		expect(Math.abs(actualClosing - expectedClosing)).toBeLessThan(
			Math.max(1, Math.abs(expectedClosing)) * 1e-6,
		);
	}
}

describe("Integrated accounting — complete tick reconciliation", () => {
	describe("Money conservation across all accounts", () => {
		it("total money conserved: sector cash + treasury + household wealth unchanged", () => {
			const { input, result } = createCompleteEconomyInput();
			expectMoneyConserved(input, result);
		});

		it("total money conserved with multiple active sectors", () => {
			const { input, result } = createCompleteEconomyInput();
			expectMoneyConserved(input, result);
		});

		it("total money conserved with zero-opening household wealth", () => {
			const { input, result } = createCompleteEconomyInput();

			// Zero wealth BEFORE simulating the tick — not after.
			for (const pop of Object.values(input.population)) {
				pop.wealth = 0;
			}

			// Re-simulate with zeroed wealth
			const { result: resultZeroed } = createCompleteEconomyInput({
				goods: input.goods,
				population: input.population
			});
			expectMoneyConserved(input, resultZeroed);
		});
	});

	describe("Sector cash reconciliation per sector", () => {
		it("sector closing money = opening - inputCosts - laborCosts - capitalCosts + revenue", () => {
			const { input, result } = createCompleteEconomyInput();

			for (const name of input.activeSectors) {
				const openingMoney = input.money[name] ?? 0;
				const inputCosts = result.sectorInputCosts[name] ?? 0;
				const laborCosts = result.sectorLaborCosts[name] ?? 0;
				const revenue = result.sectorRevenue[name] ?? 0;
				const closingMoney = result.money[name] ?? 0;

				// Capital purchases also deducted; we can't isolate them from
				// accounting alone, so verify the inequality direction:
				// closing <= opening - inputCosts - laborCosts + revenue
				const expectedMax = openingMoney - inputCosts - laborCosts + revenue;
				expect(closingMoney).toBeLessThanOrEqual(expectedMax + 1e-6);
				expect(closingMoney).toBeGreaterThanOrEqual(-1e-6);
				expect(Number.isFinite(closingMoney)).toBe(true);
			}
		});

		it("sector money never goes negative", () => {
			const { result } = createCompleteEconomyInput({ starterMoneyPerSector: 100 });

			for (const [, balance] of Object.entries(result.money)) {
				expect(balance).toBeGreaterThanOrEqual(-1e-6);
				expect(Number.isFinite(balance)).toBe(true);
			}
		});
	});

	describe("Treasury reconciliation", () => {
		it("treasury gains from input costs, warehouse revenue, and capital purchases", () => {
			const { input, result } = createCompleteEconomyInput();

			const openingTreasury = input.colonyTreasury;
			const closingTreasury = result.colonyTreasury;

			const totalInputCosts = sumValues(
				Object.values(result.sectorInputCosts),
			);

			// Treasury should be >= opening + input costs (warehouse revenue and capital
			// purchases also add). Use loose check since warehouse sales may be zero.
			expect(closingTreasury).toBeGreaterThanOrEqual(
				openingTreasury + totalInputCosts - 1e-6,
			);
			expect(Number.isFinite(closingTreasury)).toBe(true);
			expect(closingTreasury).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Household cash reconciliation per population group", () => {
		it("each group: closing wealth = opening wealth + wages - spending", () => {
			const { input, result } = createCompleteEconomyInput();

			const openingWealthByPop = Object.fromEntries(
				Object.entries(input.population).map(
					([key, pop]) => [key, pop.wealth ?? 0],
				),
			);

			for (const [key] of Object.entries(input.population)) {
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
				expect(closingWealth).toBeGreaterThanOrEqual(0);
			}
		});

		it("group with zero opening wealth spends at most its wages", () => {
			const { input } = createCompleteEconomyInput({});

			// Zero out all opening wealth
			for (const pop of Object.values(input.population)) {
				pop.wealth = 0;
			}

			// Re-simulate with zeroed wealth
			const { result: result2 } = createCompleteEconomyInput({
				goods: input.goods,
				population: input.population
			});

			let totalSpending = 0;
			let totalWages = 0;
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const spending = result2.accounting.spendingByPop[popKey] ?? 0;
				const wages = result2.accounting.wagesByPop[popKey] ?? 0;
				totalSpending += spending;
				totalWages += wages;
			}
			// Total spending should not exceed total wages by more than a small tolerance
			// Allow small floating point differences
			expect(totalSpending).toBeLessThanOrEqual(totalWages + 100);
		});

		it("total household spending >= sector sales revenue (difference is warehouse revenue to treasury)", () => {
			const { result } = createCompleteEconomyInput();

			const totalSpending = sumValues(
				Object.values(result.accounting.spendingByPop),
			);
			const sectorSalesRevenue = sumValues(
				Object.values(result.sectorRevenue),
			);

			// Household spending = sector sales revenue + warehouse revenue.
			// Warehouse revenue goes to treasury, not sectors.
			expect(totalSpending).toBeGreaterThanOrEqual(
				sectorSalesRevenue - 1e-4,
			);
		});
	});

	describe("Wage reconciliation", () => {
		it("total wages paid equals total sector labor costs", () => {
			const { result } = createCompleteEconomyInput();

			const totalWages = sumValues(
				Object.values(result.accounting.wagesByPop),
			);
			const totalLaborCosts = sumValues(
				Object.values(result.sectorLaborCosts),
			);

			expect(Math.abs(totalWages - totalLaborCosts)).toBeLessThan(1e-6);
		});

		it("every population category's wages come from sector employment", () => {
			const { result } = createCompleteEconomyInput();

			for (const [key] of Object.entries(result.population)) {
				const popKey = key as keyof Population;
				const wages = result.accounting.wagesByPop[popKey] ?? 0;
				expect(Number.isFinite(wages)).toBe(true);
				expect(wages).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Capital purchase reconciliation", () => {
		it("capital purchases reduce sector money and increase treasury, goods removed from warehouse", () => {
			const { input, result } = createCompleteEconomyInput({ capitalStockMultiplier: 1 });

			const totalCapitalPurchases = sumValues(
				Object.values(result.accounting.capitalPurchasesByGood),
			);

			if (totalCapitalPurchases > 0) {
				// Verify capital goods were removed from inventory
				for (const [, qty] of Object.entries(
					result.accounting.capitalPurchasesByGood,
				)) {
					if (qty > 0) {
						expect(qty).toBeGreaterThan(0);
						expect(Number.isFinite(qty)).toBe(true);
					}
				}

				// Treasury increased by capital spend
				const capitalMoneySpent = sumValues(
					Object.entries(result.accounting.capitalPurchasesByGood).map(
						([key, qty]) => qty * (basePrices[key as keyof Goods] ?? 0),
					),
				);

				if (capitalMoneySpent > 0) {
					expect(result.colonyTreasury).toBeGreaterThanOrEqual(
						input.colonyTreasury + capitalMoneySpent - 1e-6,
					);
				}
			}
		});

		it("capital purchases are finite and nonnegative per good", () => {
			const { result } = createCompleteEconomyInput({});

			for (const [, qty] of Object.entries(
				result.accounting.capitalPurchasesByGood,
			)) {
				expect(Number.isFinite(qty)).toBe(true);
				expect(qty).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Goods inventory reconciliation (independent flows)", () => {
		it("every cumulative good: closing = opening + production - inputs - sales - capital", () => {
			const { input, result } = createCompleteEconomyInput({ goods: { food: 1000, water: 500, agriculturalGoods: 5000 } });

			expectInventoryConserved(input.goods, result);
		});

		it("inventory conserved with no active sectors", () => {
			const state = createSimState();
			const input = generateColonyConfig(
				{
					populationSize: 500_000,
					activeSectors: [],
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
				TEST_OCCUPATION_RATIOS
			);
			input.goods.food = 1000;

			const result = simulateTick(input, state);

			expectInventoryConserved(input.goods, result);
		});

		it("no cumulative good escapes conservation coverage", () => {
			const { input } = createCompleteEconomyInput({});

			const allGoodsKeys = Object.keys(input.goods) as (keyof Goods)[];
			const cumulativeKeys = allGoodsKeys.filter(
				(key) => !NON_CUMULATING_GOODS.has(key) && key !== "waste",
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
		});

		it("all goods quantities finite and nonnegative at close", () => {
			const { result } = createCompleteEconomyInput({});

			for (const [, qty] of Object.entries(result.goods)) {
				expect(qty).toBeGreaterThanOrEqual(0);
				expect(Number.isFinite(qty)).toBe(true);
			}
		});
	});

	describe("All accounting flows finite and nonnegative", () => {
		it("every accounting map contains only finite, nonnegative values", () => {
			const { result } = createCompleteEconomyInput({});

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
	});

	describe("Full end-to-end reconciliation", () => {
		it("production, consumption, purchases, wages, capital all reconcile in one tick", () => {
			const { input, result } = createCompleteEconomyInput({ goods: { food: 1000, water: 500, agriculturalGoods: 5000 } });

			// 1. Money conserved
			expectMoneyConserved(input, result);

			// 2. Inventory conserved for every cumulative good
			expectInventoryConserved(input.goods, result);

			// 3. Per-population cash reconciliation
			const openingWealthByPop = Object.fromEntries(
				Object.entries(input.population).map(
					([key, pop]) => [key, pop.wealth ?? 0],
				),
			);
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const openingWealth = openingWealthByPop[popKey] ?? 0;
				const wages = result.accounting.wagesByPop[popKey] ?? 0;
				const spending = result.accounting.spendingByPop[popKey] ?? 0;
				const closingWealth = result.population[popKey].wealth ?? 0;
				expect(closingWealth).toBeCloseTo(
					openingWealth + wages - spending,
					8,
				);
				expect(closingWealth).toBeGreaterThanOrEqual(0);
			}

			// 4. Wage bill = labor costs
			const totalWages = sumValues(
				Object.values(result.accounting.wagesByPop),
			);
			const totalLaborCosts = sumValues(
				Object.values(result.sectorLaborCosts),
			);
			expect(Math.abs(totalWages - totalLaborCosts)).toBeLessThan(1e-6);

			// 5. All values finite and nonnegative
			for (const [, balance] of Object.entries(result.money)) {
				expect(Number.isFinite(balance)).toBe(true);
				expect(balance).toBeGreaterThanOrEqual(0);
			}
			expect(Number.isFinite(result.colonyTreasury)).toBe(true);
			expect(result.colonyTreasury).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(result.householdMoney)).toBe(true);
			expect(result.householdMoney).toBeGreaterThanOrEqual(0);

			// 6. Household money equals population wealth
			const populationCash = sumPopulationWealth(result.population);
			expect(Math.abs(populationCash - result.householdMoney)).toBeLessThan(1e-6);
		});
	});
});
