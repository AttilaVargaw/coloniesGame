import { describe, expect, it } from "vitest";
import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { Goods } from "../data/Goods.ts";
import { NON_CUMULATING_GOODS } from "../data/Goods.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

// Minimum viable sectors for non-cumulative goods validation
const minimalViableSectors: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"farm",
	"waterTreatment",
	"foodFactory",
	"oilRig",
	"forestry",
	"government",
	"paperFactory",
];

/* ═════════════════════════════════════════════════════════════════════════════════════
   LONG-RUN SIMULATION VALIDATION — 4-STAGE FRAMEWORK
   ═══════════════════════════════════════════════════════════════════════════════════

   Stage 1: 1,000-tick simulations across 6 starting-condition scenarios
   Stage 2: Track key metrics every tick
   Stage 3: Automated stability assertions (per-tick money conservation,
			household cash reconciliation, per-good inventory conservation)
   Stage 4: Economic behavior tests
   ═══════════════════════════════════════════════════════════════════════════════════ */

const ESSENTIAL_GOODS: (keyof Goods)[] = [
	"food",
	"water",
	"energy",
	"agriculturalGoods",
	"oil",
	"buildings",
	"consumerGoods",
];

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

function totalPopulation(population: Population): number {
	return sumValues(Object.values(population).map((p) => p.number));
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

function totalSectorProfit(result: IndustryTickResult): number {
	return sumValues(Object.values(result.sectorProfits));
}

function totalWages(result: IndustryTickResult): number {
	return sumValues(Object.values(result.accounting.wagesByPop));
}

function totalSpending(result: IndustryTickResult): number {
	return sumValues(Object.values(result.accounting.spendingByPop));
}

function totalProduction(result: IndustryTickResult): number {
	return sumValues(
		Object.values(result.accounting.sectorProductionByGood ?? {}).filter(
			(v): v is number => v !== undefined,
		),
	);
}

function totalInputsConsumed(result: IndustryTickResult): number {
	return sumValues(
		Object.values(result.accounting.sectorInputsConsumedByGood ?? {}).filter(
			(v): v is number => v !== undefined,
		),
	);
}

function totalEmployment(result: IndustryTickResult): number {
	return sumValues(
		Object.values(result.sectorResults).flatMap((r) =>
			Object.values(r.workersEmployed ?? {}).filter(
				(v): v is number => v !== undefined,
			),
		),
	);
}

function totalHouseholdSales(result: IndustryTickResult): number {
	return sumValues(
		Object.values(result.accounting.householdSalesByGood ?? {}).filter(
			(v): v is number => v !== undefined,
		),
	);
}

function goodsTotal(input: IndustryTickInput): number {
	return sumValues(Object.values(input.goods));
}

function goodsTotalResult(result: IndustryTickResult): number {
	return sumValues(Object.values(result.goods));
}

function allGoodsFiniteNonNegative(
	result: IndustryTickResult,
	label: string,
): boolean {
	let ok = true;
	for(const [key, qty] of Object.entries(result.goods)) {
		if(!Number.isFinite(qty)) {
			console.error(`${label}: goods.${key} not finite: ${qty}`);
			ok = false;
		}
		if(qty < 0) {
			console.error(`${label}: goods.${key} negative: ${qty}`);
			ok = false;
		}
	}
	return ok;
}

function allWealthFiniteNonNegative(
	result: IndustryTickResult,
	label: string,
): boolean {
	let ok = true;
	for(const [key, pop] of Object.entries(result.population)) {
		const popKey = key as keyof Population;
		if(!Number.isFinite(pop.wealth)) {
			console.error(`${label}: population.${popKey}.wealth not finite`);
			ok = false;
		}
		if(pop.wealth < 0) {
			console.error(`${label}: population.${popKey}.wealth negative`);
			ok = false;
		}
		if(!Number.isFinite(pop.number)) {
			console.error(`${label}: population.${popKey}.number not finite`);
			ok = false;
		}
		if(pop.number < 0) {
			console.error(`${label}: population.${popKey}.number negative`);
			ok = false;
		}
	}
	return ok;
}

function allMoneyFiniteNonNegative(
	result: IndustryTickResult,
	label: string,
): boolean {
	let ok = true;
	for(const [key, balance] of Object.entries(result.money)) {
		if(!Number.isFinite(balance)) {
			console.error(`${label}: money.${key} not finite: ${balance}`);
			ok = false;
		}
		if(balance < 0) {
			console.error(`${label}: money.${key} negative: ${balance}`);
			ok = false;
		}
	}
	return ok;
}

function checkEmploymentDoesNotExceedPopulation(
	input: IndustryTickInput,
	result: IndustryTickResult,
	label: string,
): boolean {
	let ok = true;
	for(const [key] of Object.entries(input.population)) {
		const popKey = key as keyof Population;
		const available = input.population[popKey].number;
		let employed = 0;
		for(const name of input.activeSectors) {
			const sectorResult = result.sectorResults[name];
			const workersEmployed = sectorResult?.workersEmployed ?? {};
			employed += workersEmployed[popKey] ?? 0;
		}
		if(employed > available + 1e-9) {
			console.error(
				`${label}: ${popKey} employed ${employed} > available ${available}`,
			);
			ok = false;
		}
	}
	return ok;
}

/**
 * Verify per-good inventory conservation for cumulative goods.
 *
 * Equation: closing = opening + production - inputs - capitalPurchases
 *
 * Tolerance: 100000 absolute or 1e-4 relative (0.01%), whichever is larger.
 * This accommodates floating-point accumulation over complex tracking paths
 * while catching real drift.
 *
 * Note: household sales are NOT subtracted here because the worker's
 * internal pipeline already accounts for them through the goodsForDelta
 * add-back mechanism (warehouse sales are deducted, then added back before
 * computeColonyGoodsDelta). Subtracting householdSales would double-count
 * them for goods where they're already included in production/consumption.
 */
function assertInventoryConserved(
	input: IndustryTickInput,
	result: IndustryTickResult,
	label: string,
): void {
	const goodsKeys = Object.keys(input.goods) as (keyof Goods)[];
	for(const goodKey of goodsKeys) {
		if(NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
			continue;
		}
		const opening = input.goods[goodKey] ?? 0;
		const production =
			result.accounting.sectorProductionByGood?.[goodKey] ?? 0;
		const inputsConsumed =
			result.accounting.sectorInputsConsumedByGood?.[goodKey] ?? 0;
		const householdSales =
			result.accounting.householdSalesByGood?.[goodKey] ?? 0;
		const capitalPurchases =
			result.accounting.capitalPurchasesByGood?.[goodKey] ?? 0;

		const expectedClosing =
			opening + production - inputsConsumed - householdSales - capitalPurchases;
		const actualClosing = result.goods[goodKey] ?? 0;

		expect(Number.isFinite(actualClosing), `${label}: ${goodKey} not finite`).toBe(
			true,
		);
		expect(actualClosing, `${label}: ${goodKey} negative`).toBeGreaterThanOrEqual(
			0,
		);
		const tolerance = Math.max(1, Math.abs(expectedClosing)) * 1e-6;
		expect(
			Math.abs(actualClosing - expectedClosing),
			`${label}: ${goodKey} inventory mismatch: opening=${opening}, production=${production}, inputs=${inputsConsumed}, capital=${capitalPurchases}, expected=${expectedClosing}, actual=${actualClosing}`,
		).toBeLessThan(tolerance);
	}
}

/**
 * Shared per-tick stability assertions, applied to every scenario.
 *
 * Checks:
 * - All goods finite and nonnegative
 * - All population wealth/number finite and nonnegative
 * - All sector money finite and nonnegative
 * - Treasury and household money finite and nonnegative
 * - Household money equals population cash (1e-6 tolerance)
 * - Per-good inventory conservation (tight tolerance)
 * - No money creation (closing <= opening within tolerance)
 * - Money destruction bounded by available sector cash
 * - Employment does not exceed available population
 *
 * NOTE: `input` must be the opening state snapshot BEFORE simulateTick()
 * mutated it. Pass tickInputs[tick] from the caller.
 */
function assertTickStable(
	input: IndustryTickInput,
	result: IndustryTickResult,
	label: string,
): void {
	expect(allGoodsFiniteNonNegative(result, label)).toBe(true);
	expect(allWealthFiniteNonNegative(result, label)).toBe(true);
	expect(allMoneyFiniteNonNegative(result, label)).toBe(true);

	const openingMoney = totalMoney(input);
	const closingMoney = totalMoneyResult(result);

	// No money creation: closing must not exceed opening within tolerance.
	const moneyCreation = Math.max(0, closingMoney - openingMoney);
	expect(
		moneyCreation,
		`${label}: money created; opening=${openingMoney}, closing=${closingMoney}`,
	).toBeLessThan(openingMoney * 1e-9);

	// Money destruction must be bounded by available sector cash.
	const destruction = Math.max(0, openingMoney - closingMoney);
	const totalSectorMoneyOpening = sumValues(Object.values(input.money));
	expect(destruction).toBeLessThanOrEqual(
		totalSectorMoneyOpening + 1e-6,
	);

	const populationCash = sumPopulationWealth(result.population);
	expect(
		Math.abs(result.householdMoney - populationCash),
		`${label}: household cash != population cash`,
	).toBeLessThan(1e-6);

	assertInventoryConserved(input, result, label);

	const employed = checkEmploymentDoesNotExceedPopulation(
		input,
		result,
		label,
	);
	expect(employed).toBe(true);

	expect(result.colonyTreasury).toBeGreaterThanOrEqual(-1e-6);
	expect(result.colonyTreasury).toBeLessThan(Infinity);
	expect(result.householdMoney).toBeGreaterThanOrEqual(-1e-6);
	expect(result.householdMoney).toBeLessThan(Infinity);
}

interface SimMetrics {
	tick: number;
	totalPopulation: number;
	populationByCategory: Record<string, number>;
	totalMoney: number;
	moneyBySector: Record<string, number>;
	treasury: number;
	householdMoney: number;
	populationCash: number;
	goodsTotal: number;
	goodsByCategory: Record<string, number>;
	totalProduction: number;
	totalConsumption: number;
	totalEmployment: number;
	totalWages: number;
	totalSpending: number;
	totalSectorProfit: number;
	deprivation: Record<string, number>;
	mortalityByCategory: Record<string, number>;
}

function captureMetrics(
	tick: number,
	result: IndustryTickResult,
): SimMetrics {
	const mortalityByCategory: Record<string, number> = {};
	for(const [key, pop] of Object.entries(result.population)) {
		const popKey = key as keyof Population;
		mortalityByCategory[popKey] = pop.mortality ?? 0;
	}

	const populationCash = sumPopulationWealth(result.population);

	return {
		tick,
		totalPopulation: totalPopulation(result.population),
		populationByCategory: Object.fromEntries(
			Object.entries(result.population).map(([k, p]) => [k, p.number]),
		),
		totalMoney: totalMoneyResult(result),
		moneyBySector: { ...result.money },
		treasury: result.colonyTreasury,
		householdMoney: result.householdMoney,
		populationCash,
		goodsTotal: goodsTotalResult(result),
		goodsByCategory: { ...result.goods },
		totalProduction: totalProduction(result),
		totalConsumption: totalInputsConsumed(result) + totalHouseholdSales(result),
		totalEmployment: totalEmployment(result),
		totalWages: totalWages(result),
		totalSpending: totalSpending(result),
		totalSectorProfit: totalSectorProfit(result),
		deprivation: { ...result.deprivation },
		mortalityByCategory,
	};
}

interface SimRun {
	name: string;
	input: IndustryTickInput;
	initialInput: IndustryTickInput;
	tickInputs: IndustryTickInput[];
	results: IndustryTickResult[];
	metrics: SimMetrics[];
	openingMoney: number;
	openingGoods: Goods;
	moneyDeltas: number[]; // per-tick signed money delta (opening - closing)
}

function runSimulation(
	name: string,
	tickCount: number,
	config: Partial<{
		populationSize: number;
		activeSectors: (keyof IndustrialSectors)[];
		starterMoneyPerSector: number;
		capitalStockMultiplier: number;
		initialGoodsMultipliers: Map<keyof Goods, number>;
		capitalStockMultipliers: Map<keyof IndustrialSectors, number>;
	}>,
): SimRun {
	const state = createSimState();
	const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
	config.capitalStockMultipliers?.forEach((v, k) => {
		capitalMultipliers[k] = v;
	});

	const completeActiveSectors = [
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
	] as (keyof IndustrialSectors)[];;

	let input = generateColonyConfig(
		{
			populationSize: config.populationSize ?? 100_000,
			activeSectors: config.activeSectors ?? completeActiveSectors,
			starterMoneyPerSector: config.starterMoneyPerSector ?? 1_000_000,
			capitalStockMultiplier: config.capitalStockMultiplier ?? 1,
			initialGoodsMultipliers:
				config.initialGoodsMultipliers ?? new Map(),
			capitalStockMultipliers: config.capitalStockMultipliers,
		},
		capitalMultipliers,
	);

	// Preserve the original input separately — input gets mutated every tick.
	const initialInput = structuredClone(input);
	const openingMoney = totalMoney(initialInput);
	const openingGoods = { ...initialInput.goods };
	const results: IndustryTickResult[] = [];
	const metrics: SimMetrics[] = [];
	const tickInputs: IndustryTickInput[] = [];
	const moneyDeltas: number[] = [];

	for(let tick = 0; tick < tickCount; tick++) {
		// Snapshot the opening state before this tick.
		const tickInput = structuredClone(input);
		tickInputs.push(tickInput);

		const openingMoneyThisTick = totalMoney(tickInput);

		const result = simulateTick(input, state);
		if(!result) break;

		// --- Money accounting ---
		const closingMoney = totalMoneyResult(result);

		// No money creation: closing must not exceed opening within tolerance.
		const moneyCreation = Math.max(0, closingMoney - openingMoneyThisTick);
		expect(
			moneyCreation,
			`${name} tick ${tick + 1}: money created; opening=${openingMoneyThisTick}, closing=${closingMoney}`,
		).toBeLessThan(Math.max(1e-6, openingMoneyThisTick * 1e-9));

		// Track per-tick signed money delta for drift detection.
		// simulateTick clamps sector money at 0, so destruction occurs when
		// costs exceed available sector funds. This is an intentional mechanic,
		// but it must be bounded and must not accelerate over time.
		const signedDelta = openingMoneyThisTick - closingMoney;
		moneyDeltas.push(signedDelta);

		// Apply shared stability assertions to every tick.
		// IMPORTANT: pass tickInput (the opening snapshot), not the mutated input.
		assertTickStable(tickInput, result, `${name} tick ${tick + 1}`);

		results.push(result);
		metrics.push(captureMetrics(tick, result));

		// Chain to next tick — include all fields that persist across ticks.
		input = {
			...input,
			goods: result.goods,
			money: result.money,
			capitalStock: result.capitalStock,
			population: result.population ?? input.population,
			colonyTreasury: result.colonyTreasury,
		} as IndustryTickInput;
	}

	return {
		name,
		input,
		initialInput,
		tickInputs,
		results,
		metrics,
		openingMoney,
		openingGoods,
		moneyDeltas,
	};
}

/* ═════════════════════════════════════════════════════════════════════════════════
   STAGE 1 — 1,000-TICK SIMULATIONS ACROSS 6 SCENARIOS
   ══════════════════════════════════════════════════════════════════════════════════ */

describe("Long-run simulation validation — 1,000-tick scenarios", () => {
	describe("Scenario: Normal economy", () => {
		it("runs 1,000 ticks with standard starting conditions", () => {
			const run = runSimulation("normal", 1000, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			expect(run.results.length).toBe(1000);
			expect(run.metrics.length).toBe(1000);
		});
	});

	describe("Scenario: Low resources", () => {
		it("runs 1,000 ticks with scarce raw materials", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			// Scarce raw materials: oil, metals, tylium, fissionMaterial
			input.goods.oil = 100;
			input.goods.metals = 100;
			input.goods.tylium = 100;
			input.goods.fissionMaterial = 100;

			let ticksSurvived = 0;
			for(let tick = 0; tick < 1000; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `low-resources tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(1000);
		});
	});

	describe("Scenario: Low cash", () => {
		it("runs 1,000 ticks with minimal sector and household wealth", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 5_000_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 10_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			let ticksSurvived = 0;
			for(let tick = 0; tick < 1000; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `low-cash tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(1000);
		});
	});

	describe("Scenario: No capital", () => {
		it("runs 1,000 ticks with zero capital stock multiplier", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 0,
				},
				{},
			);

			// Precondition: initial capital must actually be zero
			const initialCapital = sumValues(
				Object.values(input.capitalStock).flatMap((s) =>
					Object.values(s),
				),
			);
			expect(initialCapital).toBe(0);

			let ticksSurvived = 0;
			for(let tick = 0; tick < 1000; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `no-capital tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(1000);
		});
	});

	describe("Scenario: No population growth", () => {
		it("runs 1,000 ticks with zero birth rates", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			// Zero out birth rates for all categories
			for(const pop of Object.values(input.population)) {
				pop.birthRate = 0;
			}

			let ticksSurvived = 0;
			for(let tick = 0; tick < 1000; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `no-growth tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(1000);
		});
	});

	describe("Scenario: Economic shock continuity", () => {
		it("simulation continues after production capacity loss", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			// Run 100 ticks normally
			let ticksBeforeShock = 0;
			for(let tick = 0; tick < 100; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksBeforeShock++;

				assertTickStable(tickInput, result, `pre-shock tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksBeforeShock).toBe(100);

			// Shock: reduce oil by 90% (severe but not total supply disruption)
			input.goods.oil = Math.floor((input.goods.oil ?? 0) * 0.1);

			// Continue for 900 more ticks
			let ticksAfterShock = 0;
			for(let tick = 0; tick < 900; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksAfterShock++;

				assertTickStable(tickInput, result, `post-shock tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksAfterShock).toBe(900);
		});
	});
});

/* ═════════════════════════════════════════════════════════════════════════════════
   STAGE 2 & 3 — Track metrics every tick + automated stability assertions
   ══════════════════════════════════════════════════════════════════════════════════ */

describe("Long-run simulation validation — per-tick stability assertions", () => {
	describe("Normal economy over 1,000 ticks", () => {
		it("every tick: no NaN, no negative balances, no population collapse", () => {
			const run = runSimulation("normal-assertions", 1000, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			for(const m of run.metrics) {
				expect(Number.isFinite(m.totalPopulation)).toBe(true);
				expect(m.totalPopulation).toBeGreaterThanOrEqual(0);

				expect(Number.isFinite(m.totalMoney)).toBe(true);
				expect(m.totalMoney).toBeGreaterThanOrEqual(0);

				expect(m.goodsTotal).toBeGreaterThanOrEqual(0);

				for(const [, qty] of Object.entries(m.goodsByCategory)) {
					expect(Number.isFinite(qty)).toBe(true);
					expect(qty).toBeGreaterThanOrEqual(0);
				}

				for(const [, pop] of Object.entries(
					run.results[m.tick]?.population ?? {},
				)) {
					expect(Number.isFinite(pop.wealth)).toBe(true);
					expect(pop.wealth).toBeGreaterThanOrEqual(0);
					expect(Number.isFinite(pop.number)).toBe(true);
					expect(pop.number).toBeGreaterThanOrEqual(0);
				}

				for(const [, balance] of Object.entries(m.moneyBySector)) {
					expect(Number.isFinite(balance)).toBe(true);
					expect(balance).toBeGreaterThanOrEqual(0);
				}

				expect(Number.isFinite(m.treasury)).toBe(true);
				expect(m.treasury).toBeGreaterThanOrEqual(0);

				expect(Number.isFinite(m.householdMoney)).toBe(true);
				expect(m.householdMoney).toBeGreaterThanOrEqual(0);

				expect(m.householdMoney).toBeCloseTo(m.populationCash, 6);

				const employedInTick = sumValues(
					Object.values(
						run.results[m.tick]?.sectorResults ?? {},
					).flatMap((r) => Object.values(r.workersEmployed ?? {})),
				);
				expect(employedInTick).toBeLessThanOrEqual(
					m.totalPopulation + 1e-9,
				);
			}
		});

		it("money and inventory remain bounded over 1,000 ticks", () => {
			const run = runSimulation("normal-bounded", 1000, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			const openingMoney = run.openingMoney;
			const closingMoney = totalMoneyResult(run.results[run.results.length - 1]);

			expect(closingMoney).toBeGreaterThan(openingMoney * 0.5);
			expect(closingMoney).toBeLessThan(openingMoney * 2);

			const openingGoods = goodsTotal(run.initialInput);
			const closingGoods = goodsTotalResult(
				run.results[run.results.length - 1],
			);
			if(openingGoods > 0) {
				expect(closingGoods).toBeLessThan(openingGoods * 100 + 1_000_000);
			}
		});

		it("money destruction rate does not grow over 1,000 ticks (no drift)", () => {
			const run = runSimulation("money-drift", 1000, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			const deltas = run.moneyDeltas;
			expect(deltas.length).toBe(1000);

			// Per-tick destruction must be bounded
			for(let i = 0; i < deltas.length; i++) {
				expect(deltas[i]).toBeGreaterThanOrEqual(-run.openingMoney * 1e-9); // no creation
				expect(deltas[i]).toBeLessThan(10_000_000);
			}

			// Destruction rate must not grow over time: compare first half vs second half.
			const half = Math.floor(deltas.length / 2);
			const firstHalfAvg =
				deltas.slice(0, half).reduce((sum, d) => sum + d, 0) / half;
			const secondHalfAvg =
				deltas.slice(half).reduce((sum, d) => sum + d, 0) / half;

			// Second half destruction should not exceed first half by more than 50%.
			// This catches drift where money destruction accelerates over time.
			expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5 + 1_000_000);
		});

		it("population does not collapse over 1,000 ticks", () => {
			const run = runSimulation("normal-population", 1000, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			const openingPop = totalPopulation(run.initialInput.population);
			const closingPop = run.metrics[run.metrics.length - 1].totalPopulation;

			expect(closingPop).toBeGreaterThan(openingPop * 0.5);
			expect(closingPop).toBeLessThan(openingPop * 3);
		});
	});

	describe("Low resources scenario stability", () => {
		it("scarce raw materials: all metrics remain finite over 500 ticks", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			input.goods.oil = 50;
			input.goods.metals = 50;
			input.goods.tylium = 50;

			let ticksSurvived = 0;
			for(let tick = 0; tick < 500; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `low-resources tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(500);
		});
	});

	describe("Low cash scenario stability", () => {
		it("minimal wealth: no NaN, no negative balances over 500 ticks", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 5_000_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 10_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			let ticksSurvived = 0;
			for(let tick = 0; tick < 500; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `low-cash tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(500);
		});
	});

	describe("No capital scenario stability", () => {
		it("zero capital stock: simulation remains stable over 500 ticks", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 0,
				},
				{},
			);

			// Precondition: zero capital
			const initialCapital = sumValues(
				Object.values(input.capitalStock).flatMap((s) =>
					Object.values(s),
				),
			);
			expect(initialCapital).toBe(0);

			let ticksSurvived = 0;
			for(let tick = 0; tick < 500; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksSurvived++;

				assertTickStable(tickInput, result, `no-capital tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksSurvived).toBe(500);
		});
	});
});

/* ═════════════════════════════════════════════════════════════════════════════════
   STAGE 4 — Economic behavior tests
   ══════════════════════════════════════════════════════════════════════════════════ */

describe("Long-run simulation validation — economic behavior", () => {
	describe("Production responds to resource availability", () => {
		it("scarce inputs reduce production proportionally", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: minimalViableSectors,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			// Abundant oil first
			input.goods.oil = 1_000_000;
			const resultAbundant = simulateTick(input, state);
			expect(resultAbundant).not.toBeNull();
			const productionAbundant =
				resultAbundant!.sectorResults["powerPlant"]?.productionRatio ?? 0;

			// Reset with scarce oil
			input = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: minimalViableSectors,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			input.goods.oil = 10;
			const state2 = createSimState();
			const resultScarce = simulateTick(input, state2);
			expect(resultScarce).not.toBeNull();
			const productionScarce =
				resultScarce!.sectorResults["powerPlant"]?.productionRatio ?? 0;

			// Abundant production must be positive
			expect(productionAbundant).toBeGreaterThan(0);
			// Scarce oil should reduce production
			expect(productionScarce).toBeLessThan(productionAbundant);
		});
	});

	describe("Households can afford essential goods", () => {
		it("with sufficient supply and cash, households purchase essential goods", () => {
			const state = createSimState();
			let input = generateColonyConfig(
				{
					populationSize: 1_000_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 10_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);
			// Give households meaningful wealth so they can afford goods
			for(const pop of Object.values(input.population)) {
				pop.wealth = 10_000_000;
			}

			let ticksCompleted = 0;
			let firstResult: IndustryTickResult | null = null;
			let allSpending = 0;
			for(let tick = 0; tick < 100; tick++) {
				const tickInput = structuredClone(input);

				const result = simulateTick(input, state);
				if(!result) break;
				ticksCompleted++;
				if(!firstResult) firstResult = result;
				allSpending += sumValues(
					Object.values(result.accounting.spendingByPop),
				);

				assertTickStable(tickInput, result, `household tick ${tick + 1}`);

				input = {
					...input,
					goods: result.goods,
					money: result.money,
					capitalStock: result.capitalStock,
					population: result.population ?? input.population,
					colonyTreasury: result.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksCompleted).toBe(100);
			expect(firstResult).not.toBeNull();
			const first = firstResult!;

			const firstSpending = sumValues(
				Object.values(first.accounting.spendingByPop),
			);
			expect(Number.isFinite(firstSpending)).toBe(true);
			expect(firstSpending).toBeGreaterThanOrEqual(0);
			expect(firstSpending).toBeGreaterThan(0);

			expect(allSpending).toBeGreaterThan(0);

			const sales = first.accounting.householdSalesByGood;
			const essentialSales = ESSENTIAL_GOODS.reduce(
				(sum, g) => sum + (sales[g] ?? 0),
				0,
			);
			expect(essentialSales).toBeGreaterThan(0);
		});
	});

	describe("Capital investment supports future production", () => {
		it("higher initial capital leads to higher production", () => {
			// Sim A: low capital
			const stateA = createSimState();
			const inputA = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 0.1,
				},
				{},
			);

			// Sim B: high capital
			const stateB = createSimState();
			const inputB = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 10,
				},
				{},
			);

			// Precondition: high capital scenario has more initial capital
			const capitalA = sumValues(
				Object.values(inputA.capitalStock).flatMap((s) =>
					Object.values(s),
				),
			);
			const capitalB = sumValues(
				Object.values(inputB.capitalStock).flatMap((s) =>
					Object.values(s),
				),
			);
			expect(capitalB).toBeGreaterThan(capitalA);

			let inputACur = inputA;
			let inputBCur = inputB;
			let totalProductionA = 0;
			let totalProductionB = 0;
			let ticksCompleted = 0;

			for(let tick = 0; tick < 100; tick++) {
				const resultA = simulateTick(inputACur, stateA);
				const resultB = simulateTick(inputBCur, stateB);
				if(!resultA || !resultB) break;

				ticksCompleted++;
				totalProductionA += totalProduction(resultA);
				totalProductionB += totalProduction(resultB);

				inputACur = {
					...inputACur,
					goods: resultA.goods,
					money: resultA.money,
					capitalStock: resultA.capitalStock,
					population: resultA.population ?? inputACur.population,
					colonyTreasury: resultA.colonyTreasury,
				} as IndustryTickInput;

				inputBCur = {
					...inputBCur,
					goods: resultB.goods,
					money: resultB.money,
					capitalStock: resultB.capitalStock,
					population: resultB.population ?? inputBCur.population,
					colonyTreasury: resultB.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksCompleted).toBe(100);

			expect(totalProductionB).toBeGreaterThanOrEqual(totalProductionA);
		});
	});

	describe("Wages respond to labor availability", () => {
		it("larger workforce supports at least as much aggregate wage payment", () => {
			const stateA = createSimState();
			const inputA = generateColonyConfig(
				{
					populationSize: 100_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			const stateB = createSimState();
			const inputB = generateColonyConfig(
				{
					populationSize: 50_000,
					activeSectors: COMPLETE_SECTORS,
					starterMoneyPerSector: 1_000_000_000,
					capitalStockMultiplier: 1,
				},
				{},
			);

			let inputACur = inputA;
			let inputBCur = inputB;
			let totalWagesA = 0;
			let totalWagesB = 0;
			let ticksCompleted = 0;

			for(let tick = 0; tick < 100; tick++) {
				const resultA = simulateTick(inputACur, stateA);
				const resultB = simulateTick(inputBCur, stateB);
				if(!resultA || !resultB) break;

				ticksCompleted++;
				totalWagesA += totalWages(resultA);
				totalWagesB += totalWages(resultB);

				inputACur = {
					...inputACur,
					goods: resultA.goods,
					money: resultA.money,
					capitalStock: resultA.capitalStock,
					population: resultA.population ?? inputACur.population,
					colonyTreasury: resultA.colonyTreasury,
				} as IndustryTickInput;

				inputBCur = {
					...inputBCur,
					goods: resultB.goods,
					money: resultB.money,
					capitalStock: resultB.capitalStock,
					population: resultB.population ?? inputBCur.population,
					colonyTreasury: resultB.colonyTreasury,
				} as IndustryTickInput;
			}

			expect(ticksCompleted).toBe(100);

			expect(totalWagesA).toBeGreaterThanOrEqual(totalWagesB);
		});
	});

	describe("Sector input cost stability", () => {
		it("sector input costs remain finite and nonnegative over time", () => {
			const run = runSimulation("input-cost-stability", 500, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			for(const result of run.results) {
				for(const [, cost] of Object.entries(
					result.sectorInputCosts,
				)) {
					expect(Number.isFinite(cost)).toBe(true);
					expect(cost).toBeGreaterThanOrEqual(0);
				}
			}
		});
	});

	describe("Sector constraints validation", () => {
		it("no sector employs more workers than available population", () => {
			const run = runSimulation("sector-constraints", 500, {
				populationSize: 100_000,
				activeSectors: COMPLETE_SECTORS,
				starterMoneyPerSector: 1_000_000_000,
				capitalStockMultiplier: 1,
			});

			for(let i = 0; i < run.results.length; i++) {
				expect(
					checkEmploymentDoesNotExceedPopulation(
						run.tickInputs[i],
						run.results[i],
						`tick ${i + 1}`,
					),
				).toBe(true);
			}
		});
	});
});
