
//@ts-ignore
import fs from "fs";
import { generateRandomConfig, generateValidatedColonyConfig, createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import { IndustrialSectors } from "../components/Factories.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import { BodyBlueprint } from "../data/BodyBlueprint.ts";
import { MapCreationData } from "../data/gameData.ts";
import { Goods } from "../data/Goods.ts";
import { describe, expect, it } from "vitest";

const TICKS = 20;

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

function debugFoodTrace(config: Partial<IndustryTickInput>, ticks: number) {
    const state = createSimState();
    let input = generateColonyConfig(config as any, {});
    for(let i = 0; i < ticks; i++) {
        const result = simulateTick(input, state);
        input.goods = result.goods;
        input.money = result.money;
        input.capitalStock = result.capitalStock;
        input.population = result.population ?? input.population;
    }
}

const words = getColoniesWithPopulation(MapCreationData)

describe("economy stability", () => {
    it("finds all colonies", () => {
        expect(words.length).toBe(13)
    })

    it("generates configs that pass basic stability for multiple seeds", () => {
        const ret = new Map<string, { capitalStock: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>; goods: Partial<Record<keyof Goods, number>>; population: number }>()

        let seed = 0
        for(const { population, name } of words) {
            let found = false;
            let failedSector = ""

            for(; seed < 25_000 && !found; ++seed) {
                const baseInput = generateRandomConfig(seed, population!);
                const activeSectors = [...baseInput.activeSectors];

                const { validation } = generateValidatedColonyConfig({
                    populationSize: population!,
                    activeSectors,
                    starterMoneyPerSector: 20_000_000,
                    capitalStockMultiplier: 10,
                    initialGoodsMultipliers: new Map(),
                    capitalStockMultipliers: new Map(),
                }, { ticks: TICKS });

                if(validation.viable) {
                    ret.set(name, { capitalStock: baseInput.capitalStock, goods: baseInput.goods, population: population! })
                    console.log(`Found valid config for ${name} with seed ${++seed}`)
                    found = true;
                    break
                } else {
                    if(validation.failedGood) {
                        console.log("Failed goods ", validation.failedGood, validation.minGoods,  )
                    }
                    if(validation.failedSector) {
                        console.log("Failed sector ", validation.failedSector.sector)
                    }
                }
            }

            if(!found) {
                console.log(`=== COLONY FAILED: ${name} population=${population} ===`);
                const baseInput = generateRandomConfig(seed % 25_000, population!);
                debugFoodTrace({ populationSize: population!, activeSectors: [...baseInput.activeSectors], starterMoneyPerSector: 20_000_000, capitalStockMultiplier: 10 } as any, TICKS);
            }
        }

        // Round up all capital stock numbers and write the file every time
        const roundedRet = new Map<string, { capitalStock: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>; goods: Partial<Record<keyof Goods, number>>; population: number }>()
        for(const [name, data] of ret) {
            const roundedSectors: Record<string, Record<string, number>> = {}
            for(const [sector, goods] of Object.entries(data.capitalStock)) {
                const roundedGoods: Record<string, number> = {}
                for(const [good, value] of Object.entries(goods)) {
                    roundedGoods[good] = Math.ceil(value!)
                }
                roundedSectors[sector] = roundedGoods
            }
            const roundedGoods: Record<string, number> = {}
            for(const [good, value] of Object.entries(data.goods)) {
                roundedGoods[good] = Math.ceil(value!)
            }
            roundedRet.set(name, { capitalStock: roundedSectors as Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>, goods: roundedGoods, population: data.population })
        }

        fs.writeFileSync("src/game/factories/generatedEconomy.ts", "export const economies = new Map(" + JSON.stringify([...roundedRet], null, 2) + ")")

        // expect(ret.size).toBe(13)
    })
})
