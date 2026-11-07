
//@ts-ignore
import fs from "fs";
import { ColonyConfig, generateColonyConfig, BASIC_SECTORS, generateRandomConfig } from "./economyConfigGenerator.ts";
import { createSimState, simulateTick } from "./economySimulator.ts";
import { IndustrialSectors } from "../components/Factories.ts";
import { BodyBlueprint } from "../data/BodyBlueprint.ts";
import { MapCreationData } from "../data/gameData.ts";
import { Goods } from "../data/Goods.ts";
import { describe, expect, it } from "vitest";

const TICKS = 20;

const CURATED_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"waterTreatment",
	"farm",
	"foodFactory",
	"fishery",
	"mine",
	"oilRig",
	"metalFactory",
	"construction",
	"government",
	"services",
	"retail",
];

const ESSENTIAL_GOODS: (keyof Goods)[] = ["food", "water", "electricity", "agriculturalGoods", "furniture", "oil", "buildings", "weapons", "clothing", "tourism"];
const ESSENTIAL_SECTORS: (keyof IndustrialSectors)[] = ["powerPlant", "waterTreatment", "farm", "foodFactory", "oilRig"
	// "furnitureFactory", "oilRig", "construction", "government", "services", "retail"
];

function runColony(config: Partial<ColonyConfig> = {}) {
	const input = generateColonyConfig({
		activeSectors: CURATED_SECTORS,
		...config,
	});
	const state = createSimState();
	const history: {
		tick: number;
		goods: Goods;
		money: Record<string, number>;
		population: number;
		profits: Record<string, number>;
	}[] = [];

	let currentInput = input;

	for(let i = 0; i < TICKS; i++) {
		const patch = simulateTick(currentInput, state);
		const result = state.lastResult!;
		const totalPopulation = Object.values(currentInput.population).reduce(
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

		currentInput.goods = result.goods;
		currentInput.money = result.money;
		currentInput.capitalStock = result.capitalStock;
		currentInput.population = patch.population ?? currentInput.population;
		currentInput.laborAssigned = Object.fromEntries(
			Array.from(currentInput.activeSectors).map((k) => [k, 0])
		) as Record<string, number>;
	}

	return history;
}

describe("economy stability", () => {
	it("keeps essential goods above zero over ticks", () => {
		const history = runColony();

		for(const good of ESSENTIAL_GOODS) {
			for(const snapshot of history) {
				expect(snapshot.goods[good]).toBeGreaterThan(0);
			}
		}
	});

	it("keeps essential sectors solvent", () => {
		const history = runColony();
		for(const snapshot of history) {
			for(const sector of ESSENTIAL_SECTORS) {
				const amount = snapshot.money[sector];
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

	it("keeps essential sectors profitable more than half the time", () => {
		const history = runColony();
		let profitableTicks = 0;
		for(const snapshot of history) {
			const anyProfitable = ESSENTIAL_SECTORS.some(
				(s) => (snapshot.profits[s] ?? 0) > 0
			);
			if(anyProfitable) profitableTicks++;
		}
		expect(profitableTicks).toBeGreaterThan(TICKS / 2);
	});

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
		expect(words.length).toBe(13)
	})

	it("generates configs that pass basic stability for multiple seeds", () => {
		const ret = new Map<string, Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>>()
		let seed = 0
		const aEssentialGoods = [...ESSENTIAL_GOODS]
		const aEssentialSectors = [...ESSENTIAL_SECTORS]

		for(const { population, name } of words) {
			let found = false;
			for(; seed < 25_000 && !found; ++seed) {
				let crashed = false;
				const baseInput = generateRandomConfig(seed, population!);
				const activeSectors = [...baseInput.activeSectors];
				const state = createSimState();

				const input = generateColonyConfig({
					populationSize: population!,
					activeSectors,
					starterMoneyPerSector: 20_000_000,
					capitalStockMultiplier: 10,
					initialGoodsMultiplier: 500,
				});

				let currentInput = input;

				for(let i = 0; i < TICKS; i++) {
					const patch = simulateTick(currentInput, state);
					const result = state.lastResult!;

					if(
						aEssentialGoods.some((s) => result.goods[s] <= 0) ||
						aEssentialSectors.some((s) => (result.money[s] ?? 0) <= -1_000_000)
					) {
						crashed = true;
						break;
					}

					currentInput.goods = result.goods;
					currentInput.money = result.money;
					currentInput.capitalStock = result.capitalStock;
					currentInput.population = patch.population ?? currentInput.population;
					currentInput.laborAssigned = Object.fromEntries(
						[...currentInput.activeSectors].map((k) => [k, 0])
					) as Record<string, number>;
				}

				if(!crashed) {
					const { capitalStock } = baseInput
					ret.set(name, capitalStock)
					console.log(`Found valid config for ${name} with seed ${seed}`)
					found = true;
				}
			}
		}

		fs.writeFileSync("src/game/factories/generatedEconomy.ts", "export const economies = new Map(" + JSON.stringify([...ret], null, 2) + ")")

		expect(ret.size).toBe(13)
	}, 120_000)
})
