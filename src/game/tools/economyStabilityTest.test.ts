
//@ts-ignore
import fs from "fs";
import { ColonyConfig, generateColonyConfig, BASIC_SECTORS, generateRandomConfig } from "./economyConfigGenerator.ts";
import { createSimState, simulateTick } from "./economySimulator.ts";
import { IndustrialSectors } from "../components/Factories.ts";
import { BodyBlueprint } from "../data/BodyBlueprint.ts";
import { MapCreationData } from "../data/gameData.ts";
import { Goods } from "../data/Goods.ts";
import { describe, expect, it } from "vitest";

const TICKS = 15;

function runColony(config: Partial<ColonyConfig> = {}) {
	const input = generateColonyConfig(config);
	const state = createSimState();
	const history: {
		tick: number;
		goods: Goods;
		money: Record<string, number>;
		population: number;
		profits: Record<string, number>;
	}[] = [];

	for(let i = 0; i < TICKS; i++) {
		simulateTick(input, state);
		const result = state.lastResult!;
		const totalPopulation = Object.values(input.population).reduce(
			(sum, p) => sum + p.number,
			0
		);
		history.push({
			tick: i + 1,
			goods: { ...result.goods },
			money: { ...result.money },
			population: totalPopulation,
			profits: { ...result.sectorProfits },
		});

		// Carry state forward for the next tick (population changes slowly,
		// so keeping it constant for 30 ticks is fine for a stability check)
		input.goods = result.goods;
		input.money = result.money;
		input.capitalStock = result.capitalStock;
		input.laborAssigned = Object.fromEntries(
			Array.from(input.activeSectors).map((k) => [k, 0])
		) as Record<string, number>;
	}

	return history;
}

describe("economy stability", () => {
	it("keeps essential goods above zero over 30 ticks", () => {
		const history = runColony();
		const essentialGoods: (keyof Goods)[] = [
			"food",
			"water",
			"electricity",
			"agriculturalGoods",
		];

		for(const good of essentialGoods) {
			for(const snapshot of history) {
				expect(snapshot.goods[good]).toBeGreaterThan(0);
			}
		}
	});

	it("keeps sector money from going deeply negative", () => {
		const history = runColony();
		for(const snapshot of history) {
			for(const [, amount] of Object.entries(snapshot.money)) {
				expect(amount).toBeGreaterThan(-1_000_000);
			}
		}
	});

	it("keeps population from collapsing", () => {
		const history = runColony();
		const firstPop = history[0].population;
		for(const snapshot of history) {
			expect(snapshot.population).toBeGreaterThan(firstPop * 0.5);
		}
	});

	it("keeps at least one essential sector profitable", () => {
		const history = runColony();
		const essentialSectors = [
			"powerPlant",
			"waterTreatment",
			"farm",
			"foodFactory",
		];
		let profitableTicks = 0;
		for(const snapshot of history) {
			const anyProfitable = essentialSectors.some(
				(s) => (snapshot.profits[s] ?? 0) > 0
			);
			if(anyProfitable) profitableTicks++;
		}
		expect(profitableTicks).toBeGreaterThan(TICKS / 2);
	});

	const mustBeSuccessfulSectors = new Set<keyof IndustrialSectors>(BASIC_SECTORS)
	const mustBeSuccessfulGoods = new Set<keyof Goods>(["food", "electricity", "water", "defense"])

	function getColoniesWithPopulation(root: BodyBlueprint) {
		const colonies: BodyBlueprint[] = [];
		if(root.population) colonies.push(root);
		for(const system of root.systems ?? []) {
			for(const body of system.bodies) {
				colonies.push(...getColoniesWithPopulation(body));
			}
		}
		return colonies;
	}

	const words = getColoniesWithPopulation(MapCreationData)

	it("finds all colonies", () => {
		// 12 colonies + Hibernia
		expect(words.length).toBe(13)
	})

	it("generates configs that pass basic stability for multiple seeds", () => {
		const ret = new Map<string, Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>>()
		let seed = 0
		const amustBeSuccessfulGoods = [...mustBeSuccessfulGoods]
		const amustBeSuccessfulSectors = [...mustBeSuccessfulSectors]

		for(const { population, name } of words) {
			for(; seed < 25_000; ++seed) {
				let crashed = false;
				const baseInput = generateRandomConfig(seed, population!);
				const activeSectors = [...baseInput.activeSectors];
				const state = createSimState();

				const input = generateColonyConfig({
					populationSize: population!,
					activeSectors,
					starterMoneyPerSector: 5_000_000,
					capitalStockMultiplier: 10,
					initialGoodsMultiplier: 500,
				});

				for(let i = 0; i < TICKS; i++) {
					simulateTick(input, state);
					const result = state.lastResult!;

					if(
						amustBeSuccessfulGoods.some((s) => result.goods[s] <= 0) ||
						amustBeSuccessfulSectors.some((s) => result.money[s] <= 0)
					) {
						crashed = true;
						break;
					}

					input.goods = result.goods;
					input.money = result.money;
					input.capitalStock = result.capitalStock;
					input.laborAssigned = Object.fromEntries(
						[...input.activeSectors].map((k) => [k, 0])
					) as Record<string, number>;
				}

				if(!crashed) {
					const { capitalStock } = baseInput
					ret.set(name, capitalStock)
					console.log(`Found valid config for ${name} with seed ${++seed}`)
					break
				}
			}
		}

		fs.writeFileSync("src/game/factories/generatedEconomy.ts", "export const economies = new Map(" + JSON.stringify([...ret], null, 2) + ")")

		expect(ret.size).toBe(13)
	}, 50_000)
})
