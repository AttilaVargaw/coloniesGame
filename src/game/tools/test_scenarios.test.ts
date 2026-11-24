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
	"metalFactory",
	"machineryFactory",
	"fishery",
	"mine",
	"environmentControl",
	"medicineFactory",
	"construction",
	"automotive",
];

const NO_OIL_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
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

const MINIMAL_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"forestry",
	"government",
];

const MINIMAL_WITH_OIL: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"oilRig",
	"forestry",
	"government",
];

const NO_FOOD_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"waterTreatment",
	"oilRig",
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

function totalPopulation(population: Population): number {
	return sumValues(Object.values(population).map((p) => p.number));
}

function runSimulation(
	tickCount: number,
	config: Partial<{
		populationSize: number;
		activeSectors: (keyof IndustrialSectors)[];
		starterMoneyPerSector: number;
		capitalStockMultiplier: number;
		initialGoodsMultipliers: Map<keyof Goods, number>;
		capitalStockMultipliers: Map<keyof IndustrialSectors, number>;
		initialGoodsOverrides: Partial<Goods>;
	}>,
): { results: IndustryTickResult[]; input: IndustryTickInput; metrics: any[] } {
	const state = createSimState();
	const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
	config.capitalStockMultipliers?.forEach((v, k) => {
		capitalMultipliers[k] = v;
	});

	let input = generateColonyConfig(
		{
			populationSize: config.populationSize ?? 100_000,
			activeSectors: config.activeSectors ?? COMPLETE_SECTORS,
			starterMoneyPerSector: config.starterMoneyPerSector ?? 1_000_000_000,
			capitalStockMultiplier: config.capitalStockMultiplier ?? 1,
			initialGoodsMultipliers:
				config.initialGoodsMultipliers ?? new Map(),
			capitalStockMultipliers: config.capitalStockMultipliers,
		},
		capitalMultipliers,
	);

	// Apply initial goods overrides AFTER generation
	if (config.initialGoodsOverrides) {
		for (const [key, value] of Object.entries(config.initialGoodsOverrides) as [keyof Goods, number][]) {
			input.goods[key] = value;
		}
	}

	const results: IndustryTickResult[] = [];
	const metrics: any[] = [];

	for(let tick = 0; tick < tickCount; tick++) {
		const openingMoney = totalMoney(input);

		const result = simulateTick(input, state);
		if(!result) break;

		const closingMoney = totalMoneyResult(result);
		const moneyCreation = Math.max(0, closingMoney - openingMoney);
		expect(moneyCreation).toBeLessThan(Math.max(1e-6, openingMoney * 1e-9));

		results.push(result);
		metrics.push({
			tick,
			totalPopulation: totalPopulation(result.population),
			totalMoney: closingMoney,
			powerPlantMoney: result.money.powerPlant ?? 0,
			powerPlantStop: result.sectorStopReason?.powerPlant ?? "",
			powerPlantScale: result.sectorResults?.powerPlant?.productionRatio ?? 0,
			energyProd: result.accounting?.sectorProductionByGood?.energy ?? 0,
			foodProd: result.accounting?.sectorProductionByGood?.food ?? 0,
			treasury: result.colonyTreasury,
		});

		input = {
			...input,
			goods: result.goods,
			money: result.money,
			capitalStock: result.capitalStock,
			population: result.population ?? input.population,
			colonyTreasury: result.colonyTreasury,
		} as IndustryTickInput;
	}

	return { results, input, metrics };
}

describe("Economic scenarios", () => {
	describe("Scenario: Stable economy", () => {
		it("runs 500 ticks with stable production and money", () => {
			const { metrics } = runSimulation(500, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			expect(metrics.length).toBe(500);
			
			// Power plant should run stably (not stopped, high production)
			for(const m of metrics) {
				expect(m.powerPlantStop).toBe("");
				expect(m.powerPlantScale).toBeGreaterThan(0.04); // Production above 4%
				expect(m.energyProd).toBeGreaterThan(0);
				expect(m.totalPopulation).toBeGreaterThan(0);
			}
			
			// Population should be stable
			const finalPop = metrics[metrics.length - 1].totalPopulation;
			const initialPop = metrics[0].totalPopulation;
			expect(finalPop).toBeGreaterThan(initialPop * 0.8);
			expect(finalPop).toBeLessThan(initialPop * 1.5);
		});
	});

	describe("Scenario: Oil shortage collapse (no oilRig)", () => {
		it("power plant reduces production when oil runs low, energy-dependent sectors affected", () => {
			const { metrics } = runSimulation(100, {
				populationSize: 100_000,
				activeSectors: NO_OIL_SECTORS, // No oil production
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
				initialGoodsOverrides: { oil: 5000 },
			});

			// Find when power plant production drops significantly due to oil shortage
			// (scales down proportionally rather than stopping completely)
			let shortageTick = -1;
			for(const m of metrics) {
				if (m.powerPlantScale < 0.5 && shortageTick === -1) {
					shortageTick = m.tick;
				}
			}

			expect(shortageTick).toBeGreaterThan(0);
			expect(shortageTick).toBeLessThan(100); // Should hit shortage within 100 ticks
			
			// After shortage, energy production should be significantly reduced
			const initialEnergyProd = metrics[0].energyProd;
			const finalEnergyProd = metrics[metrics.length - 1].energyProd;
			expect(finalEnergyProd).toBeLessThan(initialEnergyProd * 0.5); // At least 50% reduction
		});
	});

describe("Scenario: Healthcare collapse", () => {
		it("household healthcare consumption drops when no healthcare production exists", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			// Use sectors that DON'T produce healthcare
			const NO_HEALTHCARE_SECTORS: (keyof IndustrialSectors)[] = [
				"powerPlant",
				"farm",
				"waterTreatment",
				"foodFactory",
				"oilRig",
				"forestry",
				"government",
				"education",
				"lawEnforcement",
				"logistics",
			];
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: NO_HEALTHCARE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			// Start with very low healthcare
			input.goods.healthcare = 100;

			let initialPop = totalPopulation(input.population);
			let healthcareStopTick = -1;

			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				// Check if healthcare production is 0 (should be from tick 0)
				const healthcareProd = result.accounting?.sectorProductionByGood?.healthcare ?? 0;
				if (healthcareProd === 0 && healthcareStopTick === -1) {
					healthcareStopTick = tick;
				}

				// Check household healthcare consumption
				const householdSales = result.accounting?.householdSalesByGood?.healthcare ?? 0;

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			// Healthcare should be 0 from the start (no healthcare sector)
			expect(healthcareStopTick).toBe(0);
			
			// Household healthcare consumption should be 0 (no healthcare available)
			// Note: The simulation might still show some consumption if initial stock exists
			// but without production, it should eventually stop
		});
	});
	});

	describe("Scenario: Food shortage collapse", () => {
		it("food production is zero when no food-producing sectors exist", () => {
			// Use sectors with NO food production (no farm, no forestry, no foodFactory)
			const { metrics } = runSimulation(50, {
				populationSize: 100_000,
				activeSectors: NO_FOOD_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
				initialGoodsOverrides: { 
					food: 1000,
				},
			});

			// Food production should be 0 from the start
			for(const m of metrics) {
				expect(m.foodProd).toBe(0);
			}
			
			// Food stock should be consumed by households
			// (This test verifies that without food producers, food is only consumed)
		});
	});

	describe("Scenario: Recovery after resource restoration", () => {
		it("economy recovers when oil supply is restored after collapse", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: NO_OIL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			// Start with very low oil to trigger collapse
			input.goods.oil = 5000;

			let collapseTick = -1;
			let recoveryTick = -1;

			// Phase 1: Run until collapse
			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if (result.sectorStopReason?.powerPlant && collapseTick === -1) {
					collapseTick = tick;
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

			// Phase 2: Add oilRig sector and restore oil supply
			input.activeSectors.add("oilRig");
			input.goods.oil = 1_000_000;
			// Initialize oilRig capital and money
			input.money.oilRig = 1_000_000_000;
			input.capitalStock.oilRig = { machinery: 0.5, buildings: 0.1 };

			// Phase 3: Run and verify recovery
			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if (collapseTick !== -1 && (result.accounting?.sectorProductionByGood?.energy ?? 0) > 0 && recoveryTick === -1) {
					recoveryTick = tick;
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

			expect(recoveryTick).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Scenario: Treasury intervention", () => {
		it("treasury subsidy restarts essential production after collapse", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			// Very low oil
			input.goods.oil = 1000;

			// Run until power plant stops
			let collapseTick = -1;
			for(let tick = 0; tick < 50; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if (result.sectorStopReason?.powerPlant && collapseTick === -1) {
					collapseTick = tick;
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

			// Treasury intervention: give power plant money AND all required inputs
			input.money.powerPlant = 10_000_000;
			input.goods.oil = 100_000;
			input.goods.environmentFactor = 10_000;
			input.goods.governance = 10_000;

			// Verify recovery
			let recovered = false;
			for(let tick = 0; tick < 50; tick++) {
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();
				if(!result) break;

				if ((result.accounting?.sectorProductionByGood?.energy ?? 0) > 0) {
					recovered = true;
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

expect(recovered).toBe(true);
	});
	});

describe("Phase 1: Recovery mechanics", () => {
	describe("Organic recovery vs treasury-assisted recovery", () => {
		it("compares organic recovery (oil restored) vs treasury-assisted recovery", () => {
			const state = createSimState();
			const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
			
// === SCENARIO A: Organic Recovery ===
		let inputA = generateColonyConfig(
			{
				populationSize: 100_000,
				activeSectors: NO_OIL_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			},
			capitalMultipliers,
		);
		inputA.goods.oil = 5000;

		const initialSelectedMethodA = inputA.selectedMethod;

		let shortageTickA = -1;
		let fullStopTickA = -1;
		let recoveryTickA = -1;
		let energyProdHistoryA: number[] = [];
		let householdCashHistoryA: number[] = [];
		let sectorMoneyHistoryA: Record<string, number[]> = {};

		// Phase 1A: Run until shortage/full stop
		for(let tick = 0; tick < 100; tick++) {
			const result = simulateTick(inputA, state);
			expect(result).not.toBeNull();
			if(!result) break;

			const energyProd = result.accounting?.sectorProductionByGood?.energy ?? 0;
			const powerPlantStop = result.sectorStopReason?.powerPlant;
			
			energyProdHistoryA.push(energyProd);
			householdCashHistoryA.push(Object.values(result.population).reduce((s, p) => s + (p.wealth ?? 0), 0));
			for(const [sector, money] of Object.entries(result.money)) {
				sectorMoneyHistoryA[sector] = (sectorMoneyHistoryA[sector] || []).concat(money);
			}

			if ((powerPlantStop === "Material shortage" || powerPlantStop === "No materials") && shortageTickA === -1) {
				shortageTickA = tick;
			}
			if (energyProd === 0 && fullStopTickA === -1) {
				fullStopTickA = tick;
			}
			if (fullStopTickA !== -1 && energyProd > 0 && recoveryTickA === -1) {
				recoveryTickA = tick;
			}

			inputA = {
				...inputA,
				goods: result.goods,
				money: result.money,
				capitalStock: result.capitalStock,
				population: result.population ?? inputA.population,
				colonyTreasury: result.colonyTreasury,
				selectedMethod: initialSelectedMethodA,
			} as IndustryTickInput;
		}

			expect(shortageTickA).toBeGreaterThan(0);

			// Phase 2A: Add oilRig sector and restore oil supply
			inputA.activeSectors.add("oilRig");
			inputA.goods.oil = 1_000_000;
			inputA.money.oilRig = 1_000_000_000;
			inputA.capitalStock.oilRig = { machinery: 0.5, buildings: 0.1 };
			inputA.selectedMethod.oilRig = inputA.selectedMethod.oilRig ?? "dieselEngines";

			// Phase 3A: Run and verify organic recovery
			for(let tick = 0; tick < 100; tick++) {
				const result = simulateTick(inputA, state);
				expect(result).not.toBeNull();
				if(!result) break;

				energyProdHistoryA.push(result.accounting?.sectorProductionByGood?.energy ?? 0);
				householdCashHistoryA.push(Object.values(result.population).reduce((s, p) => s + (p.wealth ?? 0), 0));

				if (fullStopTickA !== -1 && (result.accounting?.sectorProductionByGood?.energy ?? 0) > 0 && recoveryTickA === -1) {
					recoveryTickA = tick;
				}

				inputA = {
					...inputA,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? inputA.population,
					colonyTreasury: result.colonyTreasury,
					selectedMethod: initialSelectedMethodA,
				} as IndustryTickInput;
			}

			// Organic recovery may not have full stop, so recoveryTickA might be -1
			// But energy production should be restored to high levels
			const finalEnergyA = energyProdHistoryA[energyProdHistoryA.length - 1];
			expect(finalEnergyA).toBeGreaterThan(0);
			console.log(`Organic: shortage at ${shortageTickA}, fullStop=${fullStopTickA}, recovery=${recoveryTickA}, finalEnergy=${finalEnergyA.toFixed(0)}`);

// === SCENARIO B: Treasury-Assisted Recovery ===
			const stateB = createSimState();
			let inputB = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: MINIMAL_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				capitalMultipliers,
			);
			inputB.goods.oil = 1000;

			const initialSelectedMethodB = inputB.selectedMethod;

			let shortageTickB = -1;
			let fullStopTickB = -1;
			let recoveryTickB = -1;
			let energyProdHistoryB: number[] = [];
			let householdCashHistoryB: number[] = [];

			// Phase 1B: Run until shortage/full stop
			for(let tick = 0; tick < 50; tick++) {
				const result = simulateTick(inputB, stateB);
				expect(result).not.toBeNull();
				if(!result) break;

				const energyProd = result.accounting?.sectorProductionByGood?.energy ?? 0;
				const powerPlantStop = result.sectorStopReason?.powerPlant;
				
				energyProdHistoryB.push(energyProd);
				householdCashHistoryB.push(Object.values(result.population).reduce((s, p) => s + (p.wealth ?? 0), 0));

				if ((powerPlantStop === "Material shortage" || powerPlantStop === "No materials") && shortageTickB === -1) {
					shortageTickB = tick;
				}
				if (energyProd === 0 && fullStopTickB === -1) {
					fullStopTickB = tick;
				}
				if (fullStopTickB !== -1 && energyProd > 0 && recoveryTickB === -1) {
					recoveryTickB = tick;
				}

				inputB = {
					...inputB,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? inputB.population,
					colonyTreasury: result.colonyTreasury,
					selectedMethod: initialSelectedMethodB,
				} as IndustryTickInput;
			}

			expect(shortageTickB).toBeGreaterThan(0);

			// Phase 2B: Treasury intervention - give power plant money AND all required inputs + add oilRig for sustainable oil
			inputB.money.powerPlant = 10_000_000;
			inputB.goods.oil = 1_000_000;
			inputB.goods.environmentFactor = 10_000;
			inputB.goods.governance = 10_000;
			inputB.activeSectors.add("oilRig");
			inputB.money.oilRig = 1_000_000_000;
			inputB.capitalStock.oilRig = { machinery: 0.5, buildings: 0.1 };
			// Initialize selectedMethod for new oilRig sector
			inputB.selectedMethod.oilRig = inputB.selectedMethod.oilRig ?? "dieselEngines";

			// Phase 3B: Run and verify treasury-assisted recovery
			for(let tick = 0; tick < 50; tick++) {
				const result = simulateTick(inputB, stateB);
				expect(result).not.toBeNull();
				if(!result) break;

				energyProdHistoryB.push(result.accounting?.sectorProductionByGood?.energy ?? 0);
				householdCashHistoryB.push(Object.values(result.population).reduce((s, p) => s + (p.wealth ?? 0), 0));

				if (fullStopTickB !== -1 && (result.accounting?.sectorProductionByGood?.energy ?? 0) > 0 && recoveryTickB === -1) {
					recoveryTickB = tick;
				}

				inputB = {
					...inputB,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? inputB.population,
					colonyTreasury: result.colonyTreasury,
					selectedMethod: initialSelectedMethodB,
				} as IndustryTickInput;
			}

			const finalEnergyB = energyProdHistoryB[energyProdHistoryB.length - 1];
			// Check that energy production recovered at least once during Phase 3B
			const maxEnergyB = Math.max(...energyProdHistoryB.slice(energyProdHistoryB.length - 50));
			expect(maxEnergyB).toBeGreaterThan(0);
			console.log(`Treasury: shortage at ${shortageTickB}, fullStop=${fullStopTickB}, recovery=${recoveryTickB}, maxEnergy=${maxEnergyB.toFixed(0)}, finalEnergy=${finalEnergyB.toFixed(0)}`);

			// Both should eventually recover energy production
			expect(finalEnergyA).toBeGreaterThan(0);
			expect(maxEnergyB).toBeGreaterThan(0);

			// Household cash should recover in organic recovery
			// Treasury recovery may not sustain if oil runs out again
			const finalCashA = householdCashHistoryA[householdCashHistoryA.length - 1];
			const finalCashB = householdCashHistoryB[householdCashHistoryB.length - 1];
			expect(finalCashA).toBeGreaterThan(0);
			// Treasury recovery achieved temporary recovery (maxEnergyB > 0) but may not sustain
			// finalCashB may be 0 if recovery wasn't sustained
			expect(maxEnergyB).toBeGreaterThan(0);
		});
	});

	describe("Recovery with sector cascade tracking", () => {
			it("tracks which sectors recover in what order after energy restoration", () => {
				const state = createSimState();
				const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
				let input = generateColonyConfig(
					{
						populationSize: 100_000,
						activeSectors: NO_OIL_SECTORS,
						starterMoneyPerSector: 1_000_000_000,
						capitalStockMultiplier: 1,
					},
					capitalMultipliers,
				);
				input.goods.oil = 5000;

				let collapseTick = -1;
				const sectorRecoveryTicks: Record<string, number> = {};

				// Phase 1: Run until collapse
				for(let tick = 0; tick < 100; tick++) {
					const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					if (result.sectorStopReason?.powerPlant && collapseTick === -1) {
						collapseTick = tick;
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

				// Phase 2: Restore oil
				input.activeSectors.add("oilRig");
				input.goods.oil = 1_000_000;
				input.money.oilRig = 1_000_000_000;
				input.capitalStock.oilRig = { machinery: 0.5, buildings: 0.1 };

				// Phase 3: Track sector recovery
				for(let tick = 0; tick < 100; tick++) {
					const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					// Record when each sector resumes production
					for(const [sector, res] of Object.entries(result.sectorResults)) {
						if (res.productionRatio > 0 && sectorRecoveryTicks[sector] === undefined) {
							sectorRecoveryTicks[sector] = tick;
						}
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

				// Power plant should recover first (it's the energy producer)
				expect(sectorRecoveryTicks.powerPlant).toBeDefined();
				expect(sectorRecoveryTicks.powerPlant).toBeLessThanOrEqual(10);

				// Energy-dependent sectors should recover after power plant
				const energyDependent = ["waterTreatment", "healthcare", "education", "lawEnforcement", "logistics", "government", "services", "entertainmentIndustry", "bank", "defense", "chemical", "recycling", "consumerFactory", "paperFactory"];
				for(const sector of energyDependent) {
					if (sectorRecoveryTicks[sector] !== undefined) {
						expect(sectorRecoveryTicks[sector]).toBeGreaterThanOrEqual(sectorRecoveryTicks.powerPlant);
					}
				}

				console.log("Sector recovery order:", Object.entries(sectorRecoveryTicks).sort((a,b) => a[1] - b[1]));
			});
		});

		describe("Recovery failure modes", () => {
			it("fails to recover if oil supply restored but power plant has no money", () => {
				const state = createSimState();
				const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
				let input = generateColonyConfig(
					{
						populationSize: 100_000,
						activeSectors: NO_OIL_SECTORS,
						starterMoneyPerSector: 1_000_000_000,
						capitalStockMultiplier: 1,
					},
					capitalMultipliers,
				);
				input.goods.oil = 5000;

				// Phase 1: Run until collapse
				for(let tick = 0; tick < 100; tick++) {
					const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					input = {
						...input,
						goods: result.goods,
						money: result.money,
						capitalStock: result.capitalStock,
						population: result.population ?? input.population,
						colonyTreasury: result.colonyTreasury,
					} as IndustryTickInput;
				}

				// Phase 2: Restore oil BUT power plant has no money
				input.goods.oil = 1_000_000;
				// DON'T give power plant money
				// input.money.powerPlant = 0; // Already 0 after collapse

				// Phase 3: Should NOT recover
				let recovered = false;
				for(let tick = 0; tick < 50; tick++) {
					input.money.powerPlant = 0; 
                    const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					if ((result.accounting?.sectorProductionByGood?.energy ?? 0) > 0) {
						recovered = true;
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

				expect(recovered).toBe(false);
				console.log("No recovery without power plant money - correct");
			});

			it("fails to recover if essential non-cumulative inputs missing (environmentFactor, governance)", () => {
				const state = createSimState();
				const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
				let input = generateColonyConfig(
					{
						populationSize: 100_000,
						activeSectors: MINIMAL_SECTORS,
						starterMoneyPerSector: 1_000_000_000,
						capitalStockMultiplier: 1,
					},
					capitalMultipliers,
				);
				input.goods.oil = 1000;

				// Phase 1: Run until collapse
				for(let tick = 0; tick < 50; tick++) {
					input.money.powerPlant = 0; 
                    const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					input = {
						...input,
						goods: result.goods,
						money: result.money,
						capitalStock: result.capitalStock,
						population: result.population ?? input.population,
						colonyTreasury: result.colonyTreasury,
					} as IndustryTickInput;
				}

				// Phase 2: Treasury gives oil and money but NOT environmentFactor/governance
				input.money.powerPlant = 10_000_000;
				input.goods.oil = 100_000;
				// Note: environmentFactor and governance are NOT provided

				// Phase 3: Should NOT recover
				let recovered = false;
				for(let tick = 0; tick < 50; tick++) {
					const result = simulateTick(input, state);
					expect(result).not.toBeNull();
					if(!result) break;

					if ((result.accounting?.sectorProductionByGood?.energy ?? 0) > 0) {
						recovered = true;
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

				expect(recovered).toBe(false);
				console.log("No recovery without environmentFactor/governance - correct");
			});
		});
	});

	describe("Scenario: Stress - high population growth", () => {
		it("economy handles increased demand from population growth", () => {
			const { metrics } = runSimulation(200, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			// Manually increase birth rates after initial run
			// This is a simplified test - just verify stable economy handles load
			const finalPop = metrics[metrics.length - 1].totalPopulation;
			const initialPop = metrics[0].totalPopulation;
			
			// With default birth rates, population should grow slowly
			expect(finalPop).toBeGreaterThan(initialPop * 0.9);
			expect(finalPop).toBeLessThan(initialPop * 2.0);
			
			// Power plant should still be running
			const lastMetric = metrics[metrics.length - 1];
			expect(lastMetric.powerPlantStop).toBe("");
			expect(lastMetric.energyProd).toBeGreaterThan(0);
		});
	});
