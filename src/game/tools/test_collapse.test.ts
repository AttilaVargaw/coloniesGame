import { describe, it, expect } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
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

function totalMoney(input: IndustryTickInput): number {
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

describe("Collapse cascade test", () => {
	it("power plant runs out of money → stops → energy-dependent sectors stop with 'No materials'", { timeout: 30000 }, () => {
		const state = createSimState();
		const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
		
		let input = generateColonyConfig(
			{
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
				initialGoodsMultipliers: new Map(),
				capitalStockMultipliers: undefined,
			},
			capitalMultipliers,
		);

		let collapseTick = -1;
		let powerPlantStopped = false;
		let sectorsStoppedForMaterials = new Set<string>();

		for(let tick = 0; tick < 2000; tick++) {
			const tickInput = structuredClone(input);
			const openingMoneyThisTick = totalMoney(tickInput);

			const result = simulateTick(input, state);
			if(!result) {
				throw new Error(`simulateTick returned null at tick ${tick}`);
			}

			const closingMoney = totalMoneyResult(result);
			const moneyCreation = Math.max(0, closingMoney - openingMoneyThisTick);
			expect(moneyCreation).toBeLessThan(Math.max(1e-6, openingMoneyThisTick * 1e-9));

			const energyProd = result.accounting?.sectorProductionByGood?.energy ?? 0;
			const energyReq = result.accounting?.sectorInputsConsumedByGood?.energy ?? 0;
			const powerPlantStop = result.sectorStopReason?.powerPlant ?? "";
			
			// Track when power plant stops (any stop reason)
			if (!powerPlantStopped && powerPlantStop) {
				powerPlantStopped = true;
				collapseTick = tick;
				console.log(`Tick ${tick}: Power plant stopped with "${powerPlantStop}", money=${result.money?.powerPlant}`);
			}
			
			// Track energy-dependent sectors stopping for materials
			for (const [sector, reason] of Object.entries(result.sectorStopReason || {})) {
				if (reason === "No materials" && sector !== "powerPlant") {
					sectorsStoppedForMaterials.add(sector);
				}
			}

			// After power plant stops, energy production should be 0
			if (powerPlantStopped) {
				expect(energyProd).toBe(0);
				// Energy-dependent sectors should stop with "No materials"
				expect(sectorsStoppedForMaterials.size).toBeGreaterThan(0);
				break;
			}

			input = {
				...input,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? input.population,
				colonyTreasury: result.colonyTreasury,
			} as IndustryTickInput;
		}

		expect(collapseTick).toBeGreaterThan(0);
		expect(powerPlantStopped).toBe(true);
		expect(sectorsStoppedForMaterials.size).toBeGreaterThan(0);
		console.log(`Collapse at tick ${collapseTick}, ${sectorsStoppedForMaterials.size} sectors stopped for materials:`, [...sectorsStoppedForMaterials].sort());
	});
});
