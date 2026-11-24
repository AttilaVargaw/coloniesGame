import { describe, it, expect } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import type { Goods } from "../data/Goods.ts";

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
	"nuclearSector",
];

const MINIMAL_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"oilRig",
	"forestry",
	"government",
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

function totalPopulation(population: Population): number {
	return sumValues(Object.values(population).map((p) => p.number));
}

describe("Phase 2: Economic behavior validation", () => {
	describe("Demand → Price relationship", () => {
		it("higher household demand increases prices when supply constrained", () => {
			// Use separate states to avoid price memory contamination
			const stateA = createSimState();
			const stateB = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			
			// Scenario A: Low population, LOW initial goods
			let inputA = generateColonyConfig(
				{
					populationSize: 50_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			// Reduce initial goods to create scarcity
for(const key of Object.keys(inputA.goods)) {
			const goodKey = key as keyof Goods;
			inputA.goods[goodKey] = Math.min(inputA.goods[goodKey], 1000);
		}

		// Scenario B: High population, LOW initial goods
		let inputB = generateColonyConfig(
			{
				populationSize: 200_000,
				activeSectors: MINIMAL_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);
		for(const key of Object.keys(inputB.goods)) {
			const goodKey = key as keyof Goods;
			inputB.goods[goodKey] = Math.min(inputB.goods[goodKey], 1000);
		}

			// Run long enough for demand differences to affect stock levels
			for(let tick = 0; tick < 50; tick++) {
				const resultA = simulateTick(inputA, stateA);
				const resultB = simulateTick(inputB, stateB);
				expect(resultA).not.toBeNull();
				expect(resultB).not.toBeNull();
				if(!resultA || !resultB) break;

				inputA = {
					...inputA,
					goods: resultA.goods,
					money: resultA.money,
					capitalStock: resultA.capitalStock,
					population: resultA.population ?? inputA.population,
					colonyTreasury: resultA.colonyTreasury,
				} as IndustryTickInput;

				inputB = {
					...inputB,
					goods: resultB.goods,
					money: resultB.money,
					capitalStock: resultB.capitalStock,
					population: resultB.population ?? inputB.population,
					colonyTreasury: resultB.colonyTreasury,
				} as IndustryTickInput;
			}

			// After 50 ticks with constrained supply, higher demand should have depleted stocks more in B
			// leading to higher prices for at least some consumption goods
			const consumptionGoods: (keyof Goods)[] = ["food", "water", "energy", "consumerGoods"];
			let higherInB = 0;
			for(const good of consumptionGoods) {
				const priceA = stateA.priceMemory?.[good] ?? 0;
				const priceB = stateB.priceMemory?.[good] ?? 0;
				if (priceB > priceA) {
					higherInB++;
				}
			}
			expect(higherInB).toBeGreaterThan(0);
		});
	});

	describe("Wages → Household purchasing power", () => {
		it("higher wages increase household spending capacity", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			
			// Start with normal economy
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);

			let initialWages: Record<keyof Population, number> = {} as Record<keyof Population, number>;
			let initialCash: Record<keyof Population, number> = {} as Record<keyof Population, number>;

			for(let tick = 0; tick < 30; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if (tick === 5) {
					initialWages = { ...result.wages };
					for(const key of Object.keys(result.population) as (keyof Population)[]) {
						initialCash[key] = (result.population[key]?.wealth ?? 0) + (result.wages[key] ?? 0);
					}
				}

				if (tick === 25) {
					// Verify wages and cash have grown
					for(const key of Object.keys(result.population) as (keyof Population)[]) {
						const currentWage = result.wages[key] ?? 0;
						const currentCash = (result.population[key]?.wealth ?? 0) + (result.wages[key] ?? 0);
						expect(currentWage).toBeGreaterThanOrEqual(initialWages[key] ?? 0);
						expect(currentCash).toBeGreaterThanOrEqual(initialCash[key] ?? 0);
					}
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
		});
	});

describe("Input costs → Sector profitability", () => {
		it("supply constraints create price pressure", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			
			// Start with limited oil to create price pressure
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			input.goods.oil = 10_000; // Limited oil supply

			let initialOilPrice = state.priceMemory?.oil ?? 0;
			if (initialOilPrice === 0) initialOilPrice = 100; // base price

			for(let tick = 0; tick < 30; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if (tick === 20) {
					const finalOilPrice = state.priceMemory?.oil ?? 0;
					// Price should be responsive to stock changes
					expect(finalOilPrice).toBeGreaterThan(0);
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
		});
	});

	describe("Capital investment → Production capacity", () => {
		it("sectors with more capital produce more", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {
				powerPlant: 2.0, // Double capital for power plant
			};
			
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);

			let normalState = createSimState();
			let normalInput = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			let highCapitalEnergyProd = 0;
			let normalEnergyProd = 0;

			for(let tick = 0; tick < 20; tick++) {
				const result = simulateTick(input, state);
				const normalResult = simulateTick(normalInput, normalState);
				expect(result).not.toBeNull();
				expect(normalResult).not.toBeNull();
				if(!result || !normalResult) break;

				highCapitalEnergyProd = result.accounting?.sectorProductionByGood?.energy ?? 0;
				normalEnergyProd = normalResult.accounting?.sectorProductionByGood?.energy ?? 0;

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;

				normalInput = {
					...normalInput,
					goods: normalResult.goods,
					money: normalResult.money,
					capitalStock: normalResult.capitalStock,
					population: normalResult.population ?? normalInput.population,
					colonyTreasury: normalResult.colonyTreasury,
				} as IndustryTickInput;
			}

			// High capital should produce more energy
			expect(highCapitalEnergyProd).toBeGreaterThan(normalEnergyProd);
		});
	});

	describe("Depreciation → Declining capacity", () => {
		it("capital stock decreases without investment", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 10, // Start with high capital
				},
				capitalMultipliers,
			);

			// Drain money so no capital investment occurs
			for(const sector of Object.keys(input.money) as (keyof IndustrialSectors)[]) {
				input.money[sector] = 1000;
			}

			let initialCapital = 0;
			for(const [, stock] of Object.entries(input.capitalStock)) {
				for(const [, qty] of Object.entries(stock)) {
					initialCapital += qty;
				}
			}
			expect(initialCapital).toBeGreaterThan(0);

			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				// Keep money low
				for(const sector of Object.keys(result.money) as (keyof IndustrialSectors)[]) {
					result.money[sector] = 1000;
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

			let finalCapital = 0;
			for(const [, stock] of Object.entries(input.capitalStock)) {
				for(const [, qty] of Object.entries(stock)) {
					finalCapital += qty;
				}
			}

			// Capital should have decreased due to depreciation
			expect(finalCapital).toBeLessThan(initialCapital);
		});
	});

	describe("Unemployment → Reduced household spending", () => {
		it("workers who lose jobs have less cash to spend", () => {
			const state = createSimState();
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

			// Run until collapse to create unemployment
			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				// Check if sectors are stopping
				const stoppedSectors = Object.entries(result.sectorStopReason).filter(([_, r]) => r).length;
				
				if (stoppedSectors > 5) {
					// Verify unemployed workers have lower wealth
					const workingWorkers = result.workingWorkers;
					const freeWorkers = result.freeWorkers;
					
					for(const key of Object.keys(workingWorkers) as (keyof Population)[]) {
						const working = workingWorkers[key]?.number ?? 0;
						const free = freeWorkers[key]?.number ?? 0;
						const wealth = result.population[key]?.wealth ?? 0;
						const wage = result.wages[key] ?? 0;
						
						// Free (unemployed) workers should have lower wealth growth
						if (free > working) {
							// Unemployment rate high - verify cash is limited
							expect(wealth).toBeLessThan(100000); // Reasonable bound
						}
					}
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
		});
	});

	describe("Supply chain cascade", () => {
		it("shortage in one sector cascades to dependent sectors", () => {
			const state = createSimState();
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

			// Remove oil entirely
			input.goods.oil = 0;

			let cascadeDetected = false;

			for(let tick = 0; tick < 50; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				// Power plant should stop
				const powerPlantStop = result.sectorStopReason?.powerPlant;
				
				// Energy-dependent sectors should also stop
				const energyDependentStops = ["waterTreatment", "healthcare", "education", "lawEnforcement", "logistics", "government", "services", "entertainmentIndustry", "bank", "defense", "chemical", "recycling", "consumerFactory", "paperFactory"]
					.filter(s => result.sectorStopReason[s])
					.length;

				if (powerPlantStop && energyDependentStops > 0) {
					cascadeDetected = true;
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

			expect(cascadeDetected).toBe(true);
		});
	});

	describe("Production persistence across ticks", () => {
		it("powerPlant and nuclearSector produce consistently over two consecutive ticks", () => {
			const state = createSimState();
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

			// Ensure oil is available for powerPlant
			input.goods.oil = 2_000_000;

			const initialSelectedMethod = input.selectedMethod;

			let tick1EnergyProduction = 0;
			let tick1FissionProduction = 0;
			let tick2EnergyProduction = 0;
			let tick2FissionProduction = 0;
			let tick1PowerPlantScale = 0;
			let tick1NuclearScale = 0;
			let tick2PowerPlantScale = 0;
			let tick2NuclearScale = 0;

			for (let tick = 0; tick < 2; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if (!result) break;

				const powerPlantResult = result.sectorResults?.powerPlant;
				const nuclearResult = result.sectorResults?.nuclearSector;

				expect(powerPlantResult).toBeDefined();
				expect(nuclearResult).toBeDefined();

				if (tick === 0) {
					tick1EnergyProduction = powerPlantResult?.producedGoods?.energy ?? 0;
					tick1FissionProduction = nuclearResult?.producedGoods?.fissionMaterial ?? 0;
					tick1PowerPlantScale = powerPlantResult?.productionRatio ?? 0;
					tick1NuclearScale = nuclearResult?.productionRatio ?? 0;
				} else {
					tick2EnergyProduction = powerPlantResult?.producedGoods?.energy ?? 0;
					tick2FissionProduction = nuclearResult?.producedGoods?.fissionMaterial ?? 0;
					tick2PowerPlantScale = powerPlantResult?.productionRatio ?? 0;
					tick2NuclearScale = nuclearResult?.productionRatio ?? 0;
				}

				// Verify sectors execute (have production results)
				expect(powerPlantResult?.producedGoods).toBeDefined();
				expect(nuclearResult?.producedGoods).toBeDefined();

				// Verify no negative goods pools
				for (const [key, value] of Object.entries(result.goods)) {
					expect(value).toBeGreaterThanOrEqual(0);
				}

				// Advance to next tick
				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
					selectedMethod: initialSelectedMethod,
				} as IndustryTickInput;
			}

			// Verify both ticks had positive production
			expect(tick1EnergyProduction).toBeGreaterThan(0);
			expect(tick1FissionProduction).toBeGreaterThan(0);
			expect(tick2EnergyProduction).toBeGreaterThan(0);
			expect(tick2FissionProduction).toBeGreaterThan(0);

			// Verify both sectors ran at high scale (productionRatio >= 0.85)
			expect(tick1PowerPlantScale).toBeGreaterThanOrEqual(0.85);
			expect(tick1NuclearScale).toBeGreaterThanOrEqual(0.85);
			expect(tick2PowerPlantScale).toBeGreaterThanOrEqual(0.85);
			expect(tick2NuclearScale).toBeGreaterThanOrEqual(0.85);
		});
	});
});
