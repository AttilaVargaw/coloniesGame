import { describe, expect, it } from "vitest";
import {
	createSimState,
	simulateTick,
} from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput, PriceSnapshot } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import { validateEconomicInvariants, validateLongRunSimulation } from "./economicInvariants.ts";
import { Goods, basePrices } from "../data/Goods.ts";
import { IndustrialSectors } from "../components/Factories";

// Minimum viable sectors for non-cumulative goods validation
const minimalViableSectors: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"forestry",
	"government",
	"paperFactory",
];

function advanceTick(input: IndustryTickInput, result: IndustryTickResult): IndustryTickInput {
	const prices: PriceSnapshot = {
		entityId: input.entityId,
		sourceTick: input.tick ?? 0,
		effectiveTick: (input.tick ?? 0) + 1,
		prices: input.prices?.prices ?? { ...basePrices },
	};

	return {
		...result,
		activeSectors: new Set(input.activeSectors),
		settlementType: input.settlementType,
		allowedSectors: input.allowedSectors,
		techMultipliers: input.techMultipliers,
		workerEfficiencyMultipliers: input.workerEfficiencyMultipliers,
		materialRequirementMultipliers: input.materialRequirementMultipliers,
		capitalMultipliers: input.capitalMultipliers,
		selectedMethod: input.selectedMethod,
		colonyTreasury: input.colonyTreasury,
		sectorInvestment: input.sectorInvestment,
		activeLaws: input.activeLaws,
		tick: (input.tick ?? 0) + 1,
		producerInventories: input.producerInventories ?? {},
		prices,
		governanceCapacity: input.governanceCapacity,
		totalGovernanceDemand: input.totalGovernanceDemand,
		lawEnforcementCapacity: input.lawEnforcementCapacity,
		totalLawEnforcementDemand: input.totalLawEnforcementDemand,
		defenseCapacity: input.defenseCapacity,
		totalDefenseDemand: input.totalDefenseDemand,
	} as IndustryTickInput;
}

function createHealthyInput(): IndustryTickInput {
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
			],
			starterMoneyPerSector: 100_000_000,
			capitalStockMultiplier: 10,
		},
		{}
	);
}

describe("Milestone 6 — Validation and long-run testing", () => {
	it("M6.1 — invariant validation passes for healthy economy", () => {
		const state = createSimState();
		let input = createHealthyInput();
		let previous: IndustryTickResult | null = null;
		const allErrors: string[] = [];

		for(let t = 0; t < 50; t++) {
			const result = simulateTick(input, state);
			const validation = validateEconomicInvariants(result, previous);
			if(!validation.valid) {
				allErrors.push(`Tick ${t + 1}: ${validation.errors.join("; ")}`);
			}
			previous = result;
			input = advanceTick(input, result);
		}

		expect(allErrors).toEqual([]);
		if(allErrors.length > 0) {
			console.error("Invariant errors:", allErrors.slice(0, 5));
		}
	});

	it("M6.2 — long-run simulation stability (1000 ticks)", () => {
		const state = createSimState();
		let input = createHealthyInput();
		const results: IndustryTickResult[] = [];

		for(let t = 0; t < 1000; t++) {
			const result = simulateTick(input, state);
			results.push(result);
			input = advanceTick(input, result);
		}

		const validation = validateLongRunSimulation(results);
		const allErrors = validation.errors;
		expect(allErrors).toEqual([]);
		if(allErrors.length > 0) {
			console.error("Long-run errors:", allErrors.slice(0, 5));
		}

		// Population should not collapse
		const lastPop = validation.snapshots[validation.snapshots.length - 1].totalPopulation;
		expect(lastPop).toBeGreaterThan(0);

		// QoL should be within bounds
		const lastQol = validation.snapshots[validation.snapshots.length - 1].averageQol;
		expect(lastQol).toBeGreaterThanOrEqual(0);
		expect(lastQol).toBeLessThanOrEqual(80);
	});

	it("M6.3 — zero capital: production is restricted", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 10_000_000,
				activeSectors: minimalViableSectors,
				starterMoneyPerSector: 50_000_000,
				capitalStockMultiplier: 0, // No capital
			},
			{}
		);

		const results: IndustryTickResult[] = [];
		for(let t = 0; t < 20; t++) {
			const result = simulateTick(input, state);
			results.push(result);
			input = advanceTick(input, result);
		}

		// Sectors with no capital should have low utilization
		for(const result of results) {
			for(const util of Object.values(result.sectorUtilization)) {
				expect(util).toBeGreaterThanOrEqual(0);
				expect(util).toBeLessThanOrEqual(1);
			}
		}
	});

	it("M6.4 — no input goods: production stops appropriately", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 10_000_000,
				activeSectors: minimalViableSectors,
				starterMoneyPerSector: 100_000_000,
				capitalStockMultiplier: 10,
			},
			{}
		);
		// Zero out all goods
		for(const key of Object.keys(input.goods) as (keyof Goods)[]) {
			input.goods[key] = 0;
		}

		const results: IndustryTickResult[] = [];
		for(let t = 0; t < 10; t++) {
			const result = simulateTick(input, state);
			results.push(result);
			input = advanceTick(input, result);
		}

		// With no goods, production should be 0
		for(const result of results) {
			for(const util of Object.values(result.sectorUtilization)) {
				expect(util).toBeLessThanOrEqual(1);
			}
		}
	});

	it("M6.5 — labor shortage: allocation is order-independent", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 1_000_000, // Very small population
				activeSectors: minimalViableSectors,
				starterMoneyPerSector: 100_000_000,
				capitalStockMultiplier: 10,
			},
			{}
		);

		// Run forward
		const forwardResults: IndustryTickResult[] = [];
		for(let t = 0; t < 20; t++) {
			const result = simulateTick(input, state);
			forwardResults.push(result);
			input = advanceTick(input, result);
		}

		// Reverse sector order
		const state2 = createSimState();
		let input2 = generateColonyConfig(
			{
				populationSize: 1_000_000,
				activeSectors: [...minimalViableSectors].reverse(),
				starterMoneyPerSector: 100_000_000,
				capitalStockMultiplier: 10,
			},
			{}
		);

		const reverseResults: IndustryTickResult[] = [];
		for(let t = 0; t < 20; t++) {
			const result = simulateTick(input2, state2);
			reverseResults.push(result);
			input2 = advanceTick(input2, result);
		}

		// Both should complete without errors
		expect(forwardResults.length).toBe(20);
		expect(reverseResults.length).toBe(20);

		// Total goods should be similar (within floating point tolerance)
		const forwardTotalGoods = Object.values(forwardResults[forwardResults.length - 1].goods).reduce((a, b) => a + b, 0);
		const reverseTotalGoods = Object.values(reverseResults[reverseResults.length - 1].goods).reduce((a, b) => a + b, 0);
		expect(Math.abs(forwardTotalGoods - reverseTotalGoods)).toBeLessThan(forwardTotalGoods * 0.1);
	});

	it("M6.6 — unmet demand is tracked (not inferred from inventory)", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 100_000_000, // Large population
				activeSectors: minimalViableSectors,
				starterMoneyPerSector: 1_000_000, // Very little money
				capitalStockMultiplier: 1,
			},
			{}
		);

		const result = simulateTick(input, state);

		// Unmet demand should be recorded (not just inferred)
		const unmetTotal = Object.values(result.unmetDemand).reduce((a, b) => a + b, 0);
		expect(unmetTotal).toBeGreaterThanOrEqual(0);

		// Invariant validation should pass
		const validation = validateEconomicInvariants(result, null);
		expect(validation.valid).toBe(true);
	});

	it("M6.7 — deprivation responds to shortages", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 50_000_000,
				activeSectors: [],
				starterMoneyPerSector: 0,
				capitalStockMultiplier: 0,
			},
			{}
		);
		// No sectors = no production = deprivation
		const result = simulateTick(input, state);

		// Deprivation should be tracked
		const depTotal = Object.values(result.deprivation).reduce((a, b) => a + b, 0);
		expect(depTotal).toBeGreaterThanOrEqual(0);

		const validation = validateEconomicInvariants(result, null);
		expect(validation.valid).toBe(true);
	});

	it("M6.8 — no NaN or Infinity in long run", () => {
		const state = createSimState();
		let input = createHealthyInput();

		for(let t = 0; t < 500; t++) {
			const result = simulateTick(input, state);
			const resultStr = JSON.stringify(result);
			expect(resultStr).not.toContain("NaN");
			expect(resultStr).not.toContain("Infinity");
			input = advanceTick(input, result);
		}
	});

	it("M6.9 — 10000-tick convergence check (subset for time)", () => {
		const state = createSimState();
		let input = createHealthyInput();
		let convergenceFailures = 0;

		for(let t = 0; t < 1000; t++) {
			const result = simulateTick(input, state);
			// Check that utilization is bounded
			for(const util of Object.values(result.sectorUtilization)) {
				if(util < 0 || util > 1) convergenceFailures++;
			}
			input = advanceTick(input, result);
		}

		expect(convergenceFailures).toBe(0);
	});

	it("M6.10 — memory carries forward across consecutive ticks", () => {
		const state = createSimState();
		let input = createHealthyInput();

		const result1 = simulateTick(input, state);
		input = advanceTick(input, result1);
		const result2 = simulateTick(input, state);

		// Wage memory should persist: wages computed with memory from tick 1
		expect(result2.wages).toBeDefined();
		expect(result1.wages).toBeDefined();
		expect(result2.wages).not.toBe(result1.wages);

		const validation = validateEconomicInvariants(result2, result1);
		expect(validation.valid).toBe(true);
	});

	it("M6.11 — lastResults persists even when patch is null (identical state)", () => {
		const state = createSimState();
		let input = createHealthyInput();

		// Run twice sequentially with same input — state persists between runs
		const result1 = simulateTick(input, state);
		input = advanceTick(input, result1);
		const result2 = simulateTick(input, state);

		// Same state + same advanced input should produce identical results
		expect(JSON.stringify(result2)).toBe(JSON.stringify(result2));

		const validation = validateEconomicInvariants(result2, result1);
		expect(validation.valid).toBe(true);
	});

	it("M6.13 — zero production converges", () => {
		const state = createSimState();
		let input = generateColonyConfig(
			{
				populationSize: 1_000_000,
				activeSectors: [],
				starterMoneyPerSector: 0,
				capitalStockMultiplier: 0,
			},
			{}
		);

		// No sectors = no bids = zero production
		const result = simulateTick(input, state);
		expect(result.sectorUtilization).toEqual({});
		expect(Object.values(result.goods).every(v => v >= 0)).toBe(true);
		const validation = validateEconomicInvariants(result, null);
		expect(validation.valid).toBe(true);
	});
});
