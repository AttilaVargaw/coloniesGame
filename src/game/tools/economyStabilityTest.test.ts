
//@ts-ignore
import fs from "fs";
import { ColonyConfig, generateColonyConfig, generateRandomConfig, generateValidatedColonyConfig, validateColonyConfigFromOptions, ESSENTIAL_GOODS, ESSENTIAL_SECTORS } from "./economyConfigGenerator.ts";
import { IndustrialSectors } from "../components/Factories.ts";
import { BodyBlueprint } from "../data/BodyBlueprint.ts";
import { MapCreationData } from "../data/gameData.ts";
import { Goods } from "../data/Goods.ts";
import { describe, expect, it } from "vitest";

const TICKS = 30;

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

describe("economy stability", () => {
	it("finds all colonies", () => {
		expect(words.length).toBe(13)
	})

	it("validates curated sectors directly without retry", () => {
		// Curated 12-sector economy loop - should be viable on first try
		const validation = validateColonyConfigFromOptions({
			populationSize: 1_000_000,
			activeSectors: [
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
			],
			starterMoneyPerSector: 20_000_000,
			capitalStockMultiplier: 10,
			initialGoodsMultiplier: 500,
		}, { ticks: TICKS });

		expect(validation.viable).toBe(true);
		if(!validation.viable) {
			console.log(`Failed at tick ${validation.ticksSurvived}`,
				validation.failedGood ? `good: ${validation.failedGood.good} = ${validation.failedGood.value}` : ``,
				validation.failedSector ? `sector: ${validation.failedSector.sector} = ${validation.failedSector.money}` : ``);
		}
	})

	it("generates configs that pass basic stability for multiple seeds", () => {
		const ret = new Map<string, Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>>()

		let seed = 0
		for(const { population, name } of words) {
			let found = false;
			for(; seed < 25_000 && !found; ++seed) {
				const baseInput = generateRandomConfig(seed, population!);
				const activeSectors = [...baseInput.activeSectors];

				const { validation } = generateValidatedColonyConfig({
					populationSize: population!,
					activeSectors,
					starterMoneyPerSector: 20_000_000,
					capitalStockMultiplier: 10,
					initialGoodsMultiplier: 500,
				}, { ticks: TICKS });

				if(validation.viable) {
					const { capitalStock } = baseInput
					ret.set(name, capitalStock)
					console.log(`Found valid config for ${name} with seed ${++seed}`)
					found = true;
					break
				} else {
					// if(validation.failedGood) {
					// 	console.log("Failed goods ", validation.failedGood)
					// }
					// if(validation.failedSector) {
					// 	console.log("Failed sector ", validation.failedSector.sector)
					// }
				}
			}
		}

		// Round up all capital stock numbers and write the file every time
		const roundedRet = new Map<string, Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>>()
		for(const [name, capitalStock] of ret) {
			const roundedSectors: Record<string, Record<string, number>> = {}
			for(const [sector, goods] of Object.entries(capitalStock)) {
				const roundedGoods: Record<string, number> = {}
				for(const [good, value] of Object.entries(goods)) {
					roundedGoods[good] = Math.ceil(value!)
				}
				roundedSectors[sector] = roundedGoods
			}
			roundedRet.set(name, roundedSectors as Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>)
		}

		fs.writeFileSync("src/game/factories/generatedEconomy.ts", "export const economies = new Map(" + JSON.stringify([...roundedRet], null, 2) + ")")

		expect(ret.size).toBe(13)
	}, 120_000)
})
