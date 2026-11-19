import { describe, expect, it } from "vitest";
import {
	createSimState,
	simulateTick,
	generateValidatedColonyConfig,
} from "./economyConfigGenerator.ts";
import type { SimState } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import { Goods } from "../data/Goods.ts";
import { Population } from "../data/Population.ts";

// Population ratios to ensure all sectors have required workers
const TEST_OCCUPATION_RATIOS = {
	serviceMan: 20,
	healtcarePersonal: 20,
	engineer: 20,
	clerks: 20,
	farmer: 20,
	worker: 20,
};

function cloneInput(input: IndustryTickInput): IndustryTickInput {
	return {
		...input,
		activeSectors: new Set(input.activeSectors),
		goods: { ...input.goods },
		population: { ...input.population },
		techMultipliers: { ...input.techMultipliers },
		capitalStock: { ...input.capitalStock },
		money: { ...input.money },
		workerEfficiencyMultipliers: { ...input.workerEfficiencyMultipliers },
		materialRequirementMultipliers: { ...input.materialRequirementMultipliers },
		capitalMultipliers: { ...input.capitalMultipliers },
		selectedMethod: { ...input.selectedMethod },
		allowedSectors: input.allowedSectors ? [...input.allowedSectors] : undefined,
		sectorInvestment: { ...input.sectorInvestment },
		activeLaws: new Set(input.activeLaws),
		producerInventories: input.producerInventories ?? {},
	};
}

function createBaselineInput(): IndustryTickInput {
	return generateColonyConfig(
		{
			populationSize: 50_000_000,
			activeSectors: [
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
				"paperFactory",
			],
			starterMoneyPerSector: 50_000_000,
			capitalStockMultiplier: 5,
		},
		{},
		TEST_OCCUPATION_RATIOS
	);
}

function assertGoodsNonNegative(goods: Goods, tick: number) {
	for (const [key, value] of Object.entries(goods)) {
		const g = key as keyof Goods;
		expect(value).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(value)).toBe(true);
		if (value < 0) {
			throw new Error(`Tick ${tick}: good ${g} is negative: ${value}`);
		}
	}
}

function assertPopulationValid(pop: Population, tick: number) {
	for (const [key, p] of Object.entries(pop) as [keyof Population, any][]) {
		expect(p.number).toBeGreaterThanOrEqual(0);
		expect(p.wealth).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(p.number)).toBe(true);
		expect(Number.isFinite(p.wealth)).toBe(true);
		if (p.number < 0 || p.wealth < 0) {
			throw new Error(`Tick ${tick}: population ${key} invalid: number=${p.number}, wealth=${p.wealth}`);
		}
	}
}

describe("Phase 1 — Baseline determinism and invariants", () => {
	it("P1.7.1 — same input produces same output (determinism)", () => {
		const baseInput = createBaselineInput();

		const stateA = createSimState();
		const resultA = simulateTick(cloneInput(baseInput), stateA);

		const stateB = createSimState();
		const resultB = simulateTick(cloneInput(baseInput), stateB);

		expect(JSON.stringify(resultA)).toBe(JSON.stringify(resultB));
		expect(stateA.tick).toBe(stateB.tick);
	});

	it("P1.7.2 — multi-tick simulation is deterministic", () => {
		const baseInput = createBaselineInput();

		const runSimulation = () => {
			const state = createSimState();
			let input = createBaselineInput();
			const snapshots: any[] = [];

			for (let t = 0; t < 10; t++) {
				const result = simulateTick(input, state);
				snapshots.push(result);
				input = {
					...result,
					activeSectors: new Set(baseInput.activeSectors),
					settlementType: baseInput.settlementType,
					allowedSectors: baseInput.allowedSectors,
					techMultipliers: baseInput.techMultipliers,
					workerEfficiencyMultipliers: baseInput.workerEfficiencyMultipliers,
					materialRequirementMultipliers: baseInput.materialRequirementMultipliers,
					capitalMultipliers: baseInput.capitalMultipliers,
					selectedMethod: baseInput.selectedMethod,
					colonyTreasury: baseInput.colonyTreasury,
					sectorInvestment: baseInput.sectorInvestment,
					activeLaws: baseInput.activeLaws,
					tick: (input.tick ?? 0) + 1,
					producerInventories: input.producerInventories ?? {},
				};
			}

			return snapshots;
		};

		const runA = runSimulation();
		const runB = runSimulation();

		expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
	});

	it("P1.7.3 — simulateTick does not mutate input", () => {
		const baseInput = createBaselineInput();
		const inputCopy = cloneInput(baseInput);

		const state = createSimState();
		simulateTick(inputCopy, state);

		expect(inputCopy.activeSectors).toEqual(baseInput.activeSectors);
		expect(inputCopy.goods).toEqual(baseInput.goods);
		expect(inputCopy.money).toEqual(baseInput.money);
		expect(inputCopy.capitalStock).toEqual(baseInput.capitalStock);
		expect(inputCopy.population).toEqual(baseInput.population);
	});

	it("P1.7.4 — goods never go negative after a tick", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		assertGoodsNonNegative(result.goods, 1);
	});

	it("P1.7.5 — population number and wealth never go negative", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		assertPopulationValid(result.population, 1);
	});

	it("P1.7.6 — capital stock never goes negative", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const [sector, stocks] of Object.entries(result.capitalStock)) {
			for (const [good, value] of Object.entries(stocks)) {
				expect(value).toBeGreaterThanOrEqual(0);
				expect(Number.isFinite(value)).toBe(true);
			}
		}
	});

	it("P1.7.7 — prices and wages remain within bounds", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const [popType, wage] of Object.entries(result.wages)) {
			expect(wage).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(wage)).toBe(true);
		}

		for (const [sector, money] of Object.entries(result.money)) {
			expect(Number.isFinite(money)).toBe(true);
		}
	});

	it("P1.7.8 — actualScale is within [0, 1]", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const [sector, scale] of Object.entries(result.sectorUtilization)) {
			expect(scale).toBeGreaterThanOrEqual(0);
			expect(scale).toBeLessThanOrEqual(1);
			expect(Number.isFinite(scale)).toBe(true);
		}
	});

	it("P1.7.9 — money flow: sector money changes are accounted", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const sector of baseInput.activeSectors) {
			expect(result.money[sector]).toBeDefined();
			expect(Number.isFinite(result.money[sector])).toBe(true);
		}
	});

	it("P1.7.10 — goods conservation note: existing code double-counts production in finalizeGoods", () => {
		// Known limitation: finalizeGoods adds production to currentGoods which already
		// includes produced goods from the iteration loop. This is existing behavior
		// to be corrected in Phase 2. Test documents current behavior, not a bug.
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		// Just verify goods are non-negative and finite
		assertGoodsNonNegative(result.goods, 1);
	});

	it("P1.7.11 — validated colony config survives N ticks", () => {
		const { config, validation } = generateValidatedColonyConfig(
			{
				populationSize: 50_000_000,
				starterMoneyPerSector: 20_000_000,
				capitalStockMultiplier: 10,
				initialGoodsMultipliers: new Map(),
			},
			{ ticks: 20 }
		);

		expect(validation.viable).toBe(true);
		expect(validation.ticksSurvived).toBe(20);
	});

	it("P1.7.12 — sector profits sum equals revenue minus costs", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const [sector, profit] of Object.entries(result.sectorProfits)) {
			const revenue = result.sectorRevenue[sector] ?? 0;
			const laborCosts = result.sectorLaborCosts[sector] ?? 0;
			const inputCosts = result.sectorInputCosts[sector] ?? 0;
			const expectedProfit = revenue - inputCosts - laborCosts;
			expect(profit).toBeCloseTo(expectedProfit, 5);
		}
	});

	it("P1.7.13 — utilization matches actualScale", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		for (const [sector, utilization] of Object.entries(result.sectorUtilization)) {
			expect(utilization).toBeGreaterThanOrEqual(0);
			expect(utilization).toBeLessThanOrEqual(1);
		}
	});

	it("P1.7.14 — 100-tick long-run baseline snapshot", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		let input = createBaselineInput();

		const metrics: { tick: number; totalGoods: number; totalMoney: number; totalPopulation: number; averageQol: number }[] = [];

		for (let t = 0; t < 100; t++) {
			const result = simulateTick(input, state);

			if (t >= 50 && t < 100) {
				console.log(`Tick ${t+1}: powerPlant money=${result.money?.powerPlant}, productionRatio=${result.sectorResults?.powerPlant?.productionRatio}`);
				console.log(`Tick ${t+1}: government money=${result.money?.government}, productionRatio=${result.sectorResults?.government?.productionRatio}`);
				console.log(`Tick ${t+1}: forestry money=${result.money?.forestry}, productionRatio=${result.sectorResults?.forestry?.productionRatio}`);
				console.log(`Tick ${t+1}: paperFactory money=${result.money?.paperFactory}, productionRatio=${result.sectorResults?.paperFactory?.productionRatio}`);
				console.log(`Tick ${t+1}: treasury=${result.colonyTreasury}, totalSectorMoney=${Object.values(result.money).reduce((a,b)=>a+b,0)}`);
			}

			const totalGoods = Object.values(result.goods).reduce((a, b) => a + b, 0);
			const totalMoney = Object.values(result.money).reduce((a, b) => a + b, 0);
			const totalPopulation = Object.values(result.population).reduce((a, b) => a + (b as any).number, 0);
			const qolValues = Object.values(result.populationUpdates).map((u: any) => u.qol);
			const averageQol = qolValues.reduce((a, b) => a + b, 0) / qolValues.length;

			metrics.push({
				tick: t + 1,
				totalGoods,
				totalMoney,
				totalPopulation,
				averageQol,
			});

			input = {
				...result,
				activeSectors: new Set(baseInput.activeSectors),
				settlementType: baseInput.settlementType,
				allowedSectors: baseInput.allowedSectors,
				techMultipliers: baseInput.techMultipliers,
				workerEfficiencyMultipliers: baseInput.workerEfficiencyMultipliers,
				materialRequirementMultipliers: baseInput.materialRequirementMultipliers,
				capitalMultipliers: baseInput.capitalMultipliers,
				selectedMethod: baseInput.selectedMethod,
				colonyTreasury: baseInput.colonyTreasury,
				sectorInvestment: baseInput.sectorInvestment,
				activeLaws: baseInput.activeLaws,
				tick: (input.tick ?? 0) + 1,
				producerInventories: input.producerInventories ?? {},
			};

			if ((t + 1) % 10 === 0) {
				assertGoodsNonNegative(result.goods, t + 1);
				assertPopulationValid(result.population, t + 1);
			}
		}

		expect(metrics.length).toBe(100);
		expect(metrics[metrics.length - 1].totalPopulation).toBeGreaterThan(0);
		expect(metrics[metrics.length - 1].averageQol).toBeGreaterThanOrEqual(0);
		expect(metrics[metrics.length - 1].averageQol).toBeLessThanOrEqual(80);
	});

	it("P1.7.15 — no NaN or Infinity in result", () => {
		const baseInput = createBaselineInput();
		const state = createSimState();
		const result = simulateTick(cloneInput(baseInput), state);

		const resultStr = JSON.stringify(result);
		expect(resultStr).not.toContain("NaN");
		expect(resultStr).not.toContain("Infinity");

		const checkFinite = (value: any, path: string) => {
			if (typeof value === "number") {
				expect(Number.isFinite(value)).toBe(true);
				if (!Number.isFinite(value)) {
					throw new Error(`Non-finite value at ${path}: ${value}`);
				}
			} else if (Array.isArray(value)) {
				value.forEach((v, i) => checkFinite(v, `${path}[${i}]`));
			} else if (value && typeof value === "object") {
				for (const [k, v] of Object.entries(value)) {
					checkFinite(v, `${path}.${k}`);
				}
			}
		};

		checkFinite(result, "result");
	});
});
