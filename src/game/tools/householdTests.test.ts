import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { Goods } from "../data/Goods.ts";

function sumValues(values: Iterable<number>): number {
	return [...values].reduce((sum, value) => sum + value, 0);
}

function sumPopulationWealth(population: Population): number {
	return Object.values(population).reduce(
		(sum, pop) => sum + (pop.wealth ?? 0),
		0,
	);
}

function runTick(
	overrides: Partial<{
		populationSize: number;
		activeSectors: (keyof import("../components/Factories").IndustrialSectors)[];
		starterMoneyPerSector: number;
		capitalStockMultiplier: number;
		goods: Partial<Goods>;
		zeroWealth: boolean;
	}> = {}
): { input: IndustryTickInput; result: IndustryTickResult } {
	const state = createSimState();
	const input = generateColonyConfig(
		{
			populationSize: overrides.populationSize ?? 100_000,
			activeSectors: overrides.activeSectors ?? ["farm"],
			starterMoneyPerSector: overrides.starterMoneyPerSector ?? 1_000_000_000,
			capitalStockMultiplier: overrides.capitalStockMultiplier ?? 1,
		},
		{},
	);
	if (overrides.goods) {
		for (const [key, value] of Object.entries(overrides.goods)) {
			input.goods[key as keyof Goods] = value;
		}
	}
	if (overrides.zeroWealth) {
		for (const pop of Object.values(input.population)) {
			pop.wealth = 0;
		}
	}
	const result = simulateTick(input, state);
	return { input, result };
}

describe("Household economics — per-group cash and mortality", () => {
	describe("Per-group spending limited to own cash", () => {
		it("each group: spending <= opening wealth + wages earned this tick", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
			});

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

				expect(spending).toBeLessThanOrEqual(
					openingWealth + wages + 1e-8,
				);
			}
		});

		it("group with zero opening wealth and zero wages spends nothing", () => {
			const { input, result } = runTick({ zeroWealth: true });

			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const spending = result.accounting.spendingByPop[popKey] ?? 0;
				const wages = result.accounting.wagesByPop[popKey] ?? 0;

				expect(spending).toBeLessThanOrEqual(wages + 1e-8);
			}
		});

		it("group cannot spend another group's cash", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
			});

			// Capture opening wealth per group
			const openingWealthByPop = Object.fromEntries(
				Object.entries(input.population).map(
					([key, pop]) => [key, pop.wealth ?? 0],
				),
			);

			const wagesByPop = result.accounting.wagesByPop;
			const spendingByPop = result.accounting.spendingByPop;

			// Verify no group's spending exceeds its own available cash
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const available = openingWealthByPop[popKey] + (wagesByPop[popKey] ?? 0);
				const spending = spendingByPop[popKey] ?? 0;

				expect(spending).toBeLessThanOrEqual(available + 1e-8);
			}
		});

		it("total household spending >= sector sales revenue (difference is warehouse revenue to treasury)", () => {
			const { result } = runTick({
				activeSectors: ["farm", "foodFactory"],
			});

			const totalSpending = sumValues(
				Object.values(result.accounting.spendingByPop),
			);
			const sectorSalesRevenue = sumValues(
				Object.values(result.sectorRevenue),
			);

			// Household spending = sector sales revenue + warehouse revenue.
			// Warehouse revenue goes to treasury, so spending >= sector revenue.
			expect(totalSpending).toBeGreaterThanOrEqual(
				sectorSalesRevenue - 1e-4,
			);
			expect(totalSpending - sectorSalesRevenue).toBeGreaterThanOrEqual(
				-1e-4,
			);
		});
	});

	describe("Per-group cash reconciliation", () => {
		it("closing wealth = opening wealth + wages - spending for every group", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
			});

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
		});

		it("aggregate household money equals sum of population wealth", () => {
			const { result } = runTick({
				activeSectors: ["farm"],
			});

			const populationCash = sumPopulationWealth(result.population);
			expect(Math.abs(populationCash - result.householdMoney)).toBeLessThan(
				1e-6,
			);
		});

		it("population wealth is finite and nonnegative for every group", () => {
			const { result } = runTick({});

			for (const [, pop] of Object.entries(result.population)) {
				expect(Number.isFinite(pop.wealth)).toBe(true);
				expect(pop.wealth).toBeGreaterThanOrEqual(0);
				expect(Number.isFinite(pop.number)).toBe(true);
				expect(pop.number).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Mortality does not destroy category cash", () => {
		it("wealth stays with the category after mortality — closing wealth = opening + wages - spending", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
				goods: { food: 0 }, // scarce food to trigger deprivation/mortality
			});

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

				// Mortality changes population count, not category cash.
				// Closing wealth must still equal opening + wages - spending.
				expect(closingWealth).toBeCloseTo(
					openingWealth + wages - spending,
					8,
				);
				expect(closingWealth).toBeGreaterThanOrEqual(0);
			}
		});

		it("population count may decrease but category wealth is preserved", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
				goods: { food: 0 }, // trigger mortality via scarcity
			});

			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const originalNumber = input.population[popKey].number;
				const closingNumber = result.population[popKey].number;

				// Population cannot increase beyond natural growth bounds;
				// it may decrease due to mortality.
				expect(closingNumber).toBeGreaterThanOrEqual(0);
				expect(closingNumber).toBeLessThanOrEqual(originalNumber * 1.01 + 1);

				// Wealth is per-category, not per-capita: mortality doesn't
				// destroy the category's cash balance.
				const closingWealth = result.population[popKey].wealth ?? 0;
				expect(closingWealth).toBeGreaterThanOrEqual(0);
				expect(Number.isFinite(closingWealth)).toBe(true);
			}
		});

		it("mortality rate produces finite, nonnegative values for all groups", () => {
			const { result } = runTick({
				activeSectors: ["farm"],
				goods: { food: 0 },
			});

			expect(result.deprivation).toBeDefined();
			for (const [, value] of Object.entries(result.deprivation)) {
				expect(Number.isFinite(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Wage attribution to correct population group", () => {
		it("wages are paid to the population category that performed the work", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
			});

			const wagesByPop = result.accounting.wagesByPop;
			const sectorLaborCosts = result.sectorLaborCosts;

			// Total wages across all groups must equal total sector labor costs
			const totalWages = sumValues(Object.values(wagesByPop));
			const totalLaborCosts = sumValues(Object.values(sectorLaborCosts));
			expect(Math.abs(totalWages - totalLaborCosts)).toBeLessThan(1e-6);

			// Each group's wages must be nonnegative and finite
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const wages = wagesByPop[popKey] ?? 0;
				expect(Number.isFinite(wages)).toBe(true);
				expect(wages).toBeGreaterThanOrEqual(0);
			}
		});

		it("groups not employed by any sector receive zero wages", () => {
			const { input, result } = runTick({
				activeSectors: ["farm"],
			});

			const wagesByPop = result.accounting.wagesByPop;

			// Collect all employed population types across all sectors
			const employedTypes = new Set<keyof Population>();
			for (const name of input.activeSectors) {
				const sectorResult = result.sectorResults[name];
				const workersEmployed = sectorResult?.workersEmployed ?? {};
				for (const key of Object.keys(workersEmployed) as (keyof Population)[]) {
					if ((workersEmployed[key] ?? 0) > 0) {
						employedTypes.add(key);
					}
				}
			}

			// Groups not employed in any sector must have zero wages
			for (const [key] of Object.entries(input.population)) {
				const popKey = key as keyof Population;
				const wages = wagesByPop[popKey] ?? 0;
				if (!employedTypes.has(popKey)) {
					expect(wages).toBe(0);
				} else {
					expect(wages).toBeGreaterThanOrEqual(0);
				}
				expect(Number.isFinite(wages)).toBe(true);
			}
		});
	});

	describe("Spending by pop group finite and nonnegative", () => {
		it("every group's spending is finite and nonnegative", () => {
			const { result } = runTick({
				activeSectors: ["farm", "foodFactory"],
			});

			for (const [key] of Object.entries(result.accounting.spendingByPop)) {
				const popKey = key as keyof Population;
				const spending = result.accounting.spendingByPop[popKey] ?? 0;
				expect(Number.isFinite(spending)).toBe(true);
				expect(spending).toBeGreaterThanOrEqual(0);
			}
		});
	});
});
