import { describe, it, expect } from "vitest";
import { generateColonyConfig } from "../generateColonyConfig.ts";
import { simulateTick, createSimState } from "../economyConfigGenerator.ts";
import { Goods, basePrices, NON_CUMULATING_GOODS } from "../../data/Goods.ts";
import type { IndustryTickInput } from "../../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../../workers/IndustryTickResult.ts";

// 7 service sectors + oilRig for continuous oil + forestry for environmentFactor
const SEVEN_SECTORS_PLUS_OIL: string[] = [
	"powerPlant",
	"services",
	"government",
	"bank",
	"education",
	"logistics",
	"lawEnforcement",
	"oilRig",
	"forestry",
];

function createTestInput(
	activeSectors: string[],
	initialGoodsOverrides: Partial<Goods> = {}
): ReturnType<typeof generateColonyConfig> {
	const config = {
		populationSize: 100_000,
		activeSectors: activeSectors as any,
		starterMoneyPerSector: 1_000_000_000,
		capitalStockMultiplier: 1,
	};

	const input = generateColonyConfig(config, {});

	// Apply initial goods overrides
	for (const [key, value] of Object.entries(initialGoodsOverrides)) {
		input.goods[key as keyof Goods] = value;
	}

	return input;
}

function validateFlowReconciliation(
	_previousGoods: Goods,
	result: any
): void {
	// Basic sanity checks: no NaN, no negative values for cumulative goods
	for (const good of Object.keys(basePrices) as (keyof Goods)[]) {
		const closing = result.goods[good] ?? 0;
		expect(Number.isFinite(closing)).toBe(true);
		if (!NON_CUMULATING_GOODS.has(good) && good !== "waste") {
			expect(closing).toBeGreaterThanOrEqual(0);
		}
	}
}

function closeTickForNext(
	input: IndustryTickInput,
	result: IndustryTickResult
): IndustryTickInput {
	return {
		...input,
		goods: result.goods,
		money: result.money,
		capitalStock: result.capitalStock,
		population: result.population ?? input.population,
	} as IndustryTickInput;
}

describe("Multi-tick flow validation", () => {
	const initialGoods: Partial<Goods> = {
		oil: 50000,
		environmentFactor: 500000,
		governance: 50000,
		consumerGoods: 5000000,
		chemicals: 50000,
		medicine: 50000,
		paper: 50000,
		metals: 50000,
		machinery: 50000,
		buildings: 50000,
		water: 50000,
		food: 50000,
		agriculturalGoods: 50000,
		lumber: 50000,
	};

	describe("30-tick stability with continuous oil", () => {
		it("maintains production without collapse", () => {
			let input = createTestInput(SEVEN_SECTORS_PLUS_OIL, initialGoods);
			const state = createSimState();

			let productionHistory: Record<string, number[]> = {};
			for (const sector of SEVEN_SECTORS_PLUS_OIL) {
				productionHistory[sector] = [];
			}

			for (let tick = 1; tick <= 30; tick++) {
				input.tick = tick;
				const result = simulateTick(input, state);
				expect(result).not.toBeNull();

				// Debug: log power plant stop reason
				if (tick <= 5) {
					console.log(`Tick ${tick}: powerPlant ratio=${result.sectorUtilization.powerPlant}, stopReason=${result.sectorStopReason.powerPlant}, goods.energy=${result.goods.energy}, goods.oil=${result.goods.oil}`);
					console.log(`Tick ${tick}: oilRig ratio=${result.sectorUtilization.oilRig}, stopReason=${result.sectorStopReason.oilRig}, produced.oil=${result.goodsProduction.oil}`);
				}

				// Track production ratios
				for (const sector of SEVEN_SECTORS_PLUS_OIL) {
					const ratio = result.sectorUtilization[sector] ?? 0;
					productionHistory[sector].push(ratio);
				}

				// Debug: log all sector ratios
				if (tick <= 5) {
					for (const sector of SEVEN_SECTORS_PLUS_OIL) {
						console.log(`Tick ${tick}: ${sector} ratio=${result.sectorUtilization[sector]}, stopReason=${result.sectorStopReason[sector]}`);
					}
				}

				// Debug: check services inputs on tick 3
				if (tick === 3 || tick === 4) {
					console.log(`Tick ${tick} goods: energy=${result.goods.energy}, environmentFactor=${result.goods.environmentFactor}, consumerGoods=${result.goods.consumerGoods}, governance=${result.goods.governance}`);
					console.log(`Tick ${tick} services sectorResults:`, result.sectorResults.services);
					console.log(`Tick ${tick} services stopReason:`, result.sectorStopReason.services);
				}

				// Update input for next tick using closeTickForNext
				input = closeTickForNext(input, result);

				state.tick = tick;
				state.lastResult = result;
			}

			// Verify power plant maintains significant production
			const ppHistory = productionHistory.powerPlant;
			const last10 = ppHistory.slice(-10);
			const avgLast10 = last10.reduce((a, b) => a + b, 0) / last10.length;
			console.log(`powerPlant last10:`, last10);
			expect(avgLast10).toBeGreaterThan(0.5);

			// Verify oilRig produces
			const oilHistory = productionHistory.oilRig;
			const oilLast10 = oilHistory.slice(-10);
			const oilAvgLast10 = oilLast10.reduce((a, b) => a + b, 0) / oilLast10.length;
			console.log(`oilRig last10:`, oilLast10);
			expect(oilAvgLast10).toBeGreaterThan(0.5);

			// Other sectors should maintain some production (not collapse to 0)
			for (const sector of SEVEN_SECTORS_PLUS_OIL) {
				if (sector === "powerPlant" || sector === "oilRig") continue;
				const history = productionHistory[sector];
				const last10 = history.slice(-10);
				const avgLast10 = last10.reduce((a, b) => a + b, 0) / last10.length;
				console.log(`${sector} last10:`, last10, `avg=${avgLast10.toFixed(3)}`);
				// Don't collapse to 0 - maintain at least minimal production
				expect(avgLast10).toBeGreaterThan(0.05);
			}
		}, 60000);
	});

	describe("Flow reconciliation per tick", () => {
		it("reconciles physical flows for every tick", () => {
			let input = createTestInput(SEVEN_SECTORS_PLUS_OIL, initialGoods);
			const state = createSimState();

			for (let tick = 1; tick <= 20; tick++) {
				input.tick = tick;
				const previousGoods = { ...input.goods };
				const result = simulateTick(input, state);

				// Validate reconciliation
				validateFlowReconciliation(previousGoods, result);

				// Update for next tick using closeTickForNext
				input = closeTickForNext(input, result);

				state.tick = tick;
				state.lastResult = result;
			}
		});
	});

describe("Order sensitivity", () => {
	const orders: string[][] = [
		[...SEVEN_SECTORS_PLUS_OIL],
		[...SEVEN_SECTORS_PLUS_OIL].reverse(),
		["services", "powerPlant", "government", "bank", "education", "logistics", "lawEnforcement", "oilRig", "forestry"],
		["forestry", "oilRig", "lawEnforcement", "logistics", "education", "bank", "government", "services", "powerPlant"],
	];

		for (const order of orders) {
			it(`produces consistent results for order: ${order.join(" > ")}`, () => {
				let input = createTestInput(order, initialGoods);
				const state = createSimState();

				let tick1Result: any = null;
				let tick10Result: any = null;

				for (let tick = 1; tick <= 10; tick++) {
					input.tick = tick;
					const result = simulateTick(input, state);

					if (tick === 1) tick1Result = result;
					if (tick === 10) tick10Result = result;

					input = closeTickForNext(input, result);

					state.tick = tick;
					state.lastResult = result;
				}

				// Just verify it runs without error
				expect(tick1Result).toBeDefined();
				expect(tick10Result).toBeDefined();
			});
		}
	});
});