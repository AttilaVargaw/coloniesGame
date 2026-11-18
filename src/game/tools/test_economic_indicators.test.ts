import { describe, it, expect } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import { EconomicDashboard } from "../workers/economicIndicators.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

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
	"consumerFactory",
	"paperFactory",
];

function sumValues(values: Iterable<number>): number {
	return [...values].reduce((sum, value) => sum + value, 0);
}

function sumPopulationWealth(population: Population): number {
	return Object.values(population).reduce(
		(sum, pop) => sum + (pop.wealth ?? 0),
		0,
	);
}

function totalMoney(input: { money: Record<string, number>; colonyTreasury: number; population: Population }): number {
	return (
		sumValues(Object.values(input.money)) +
		input.colonyTreasury +
		sumPopulationWealth(input.population)
	);
}

function totalMoneyResult(result: IndustryTickResult): number {
	return (
		sumValues(Object.values(result.money)) +
		result.colonyTreasury +
		sumPopulationWealth(result.population)
	);
}

describe("Phase 3: Economic Indicators", () => {
	it("tracks key indicators over 100 ticks", () => {
		const state = createSimState();
		const dashboard = new EconomicDashboard();
		const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
		
		let input = generateColonyConfig(
			{
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);

		for(let tick = 0; tick < 100; tick++) {
			const result = simulateTick(input, state);
			expect(result).not.toBeNull();
			if(!result) break;

			const indicators = dashboard.recordTick(result, state.priceMemory);
			
			// Basic sanity checks
			expect(indicators.tick).toBe(tick);
			expect(indicators.nominalGDP).toBeGreaterThanOrEqual(0);
			expect(indicators.realGDP).toBeGreaterThanOrEqual(0);
			expect(indicators.unemploymentRate).toBeGreaterThanOrEqual(0);
			expect(indicators.unemploymentRate).toBeLessThanOrEqual(1);
			expect(indicators.employmentRate).toBeGreaterThanOrEqual(0);
			expect(indicators.employmentRate).toBeLessThanOrEqual(1);
			expect(indicators.treasuryBalance).toBeDefined();
			expect(indicators.outputPerWorker).toBeGreaterThanOrEqual(0);
			
			// Verify sector output tracking
			for(const sector of Object.keys(indicators.sectorOutput) as (keyof IndustrialSectors)[]) {
				expect(indicators.sectorOutput[sector]).toBeGreaterThanOrEqual(0);
			}

input = {
				...input,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? input.population,
				colonyTreasury: result.colonyTreasury,
			};
		}
	
		// Verify history
		const history = dashboard.getHistory();
		expect(history.length).toBe(100);
		
		// Verify series
		const series = dashboard.getSeries();
		expect(series.nominalGDP.length).toBe(100);
		expect(series.realGDP.length).toBe(100);
		expect(series.inflationRate.length).toBe(100);
		expect(series.unemploymentRate.length).toBe(100);
		
		// GDP should be positive and stabilize (not grow indefinitely)
		expect(series.nominalGDP[99]).toBeGreaterThan(0);
		expect(series.nominalGDP[99]).toBeLessThan(series.nominalGDP[0] * 2); // Within 2x of initial
		// Check that GDP stabilizes in the second half
		const firstHalfAvg = series.nominalGDP.slice(0, 50).reduce((s, v) => s + v, 0) / 50;
		const secondHalfAvg = series.nominalGDP.slice(50).reduce((s, v) => s + v, 0) / 50;
		expect(Math.abs(secondHalfAvg - firstHalfAvg) / firstHalfAvg).toBeLessThan(0.5); // Less than 50% change
	});

	it("detects inflation when supply constrained", () => {
		const state = createSimState();
		const dashboard = new EconomicDashboard();
		const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
		
		let input = generateColonyConfig(
			{
				populationSize: 200_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);
		// Constrain initial goods
		for(const key of Object.keys(input.goods) as (keyof import("../data/Goods.ts").Goods)[]) {
			input.goods[key] = Math.min(input.goods[key], 1000);
		}

for(let tick = 0; tick < 50; tick++) {
			const result = simulateTick(input, state);
			expect(result).not.toBeNull();
			if(!result) break;

			dashboard.recordTick(result, state.priceMemory);

input = {
				...input,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? input.population,
				colonyTreasury: result.colonyTreasury,
			};
		}
	
		const series = dashboard.getSeries();
		// Inflation should be positive with constrained supply
		const avgInflation = series.inflationRate.reduce((s, v) => s + v, 0) / series.inflationRate.length;
		expect(avgInflation).toBeGreaterThan(0);
	});

	it("tracks unemployment during collapse", () => {
		const state = createSimState();
		const dashboard = new EconomicDashboard();
		const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
		
		let input = generateColonyConfig(
			{
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);
		input.goods.oil = 0; // No oil -> collapse

		let maxUnemployment = 0;

for(let tick = 0; tick < 50; tick++) {
			const result = simulateTick(input, state);
			expect(result).not.toBeNull();
			if(!result) break;

			const indicators = dashboard.recordTick(result, state.priceMemory);
			maxUnemployment = Math.max(maxUnemployment, indicators.unemploymentRate);

			input = {
				...input,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? input.population,
				colonyTreasury: result.colonyTreasury,
			};
		}

		// Unemployment should spike during collapse
		expect(maxUnemployment).toBeGreaterThan(0.1); // At least 10% unemployment
	});

	it("exports CSV correctly", () => {
		const state = createSimState();
		const dashboard = new EconomicDashboard();
		const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
		
		let input = generateColonyConfig(
			{
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);

		for(let tick = 0; tick < 10; tick++) {
			const result = simulateTick(input, state);
			expect(result).not.toBeNull();
			if(!result) break;

			dashboard.recordTick(result, state.priceMemory);

			input = {
				...input,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? input.population,
				colonyTreasury: result.colonyTreasury,
			};
		}

		const csv = dashboard.exportCSV();
		expect(csv).toContain("tick,nominalGDP,realGDP");
		expect(csv.split("\n").length).toBe(11); // header + 10 rows
	});
});
