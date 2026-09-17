import { ReadonlyRecord } from "@/lib/readonlyRecord";

export type Goods = {
    basicFood: number;
    food: number;
    luxuryFood: number;
    tourism: number;
    consumerGoods: number;
    water: number
    electricity: number
    furniture: number;
    luxuryFurniture: number;
    services: number
    agriculturalGoods: number;
    dividents: number

    tylium: number;
    metals: number;
    uranium: number;
    machinery: number;
    medicine: number;
    wood: number;
    oil: number;
    spaceTransport: number;

    ammunition: number;
    weapons: number;
    nuclearWeapons: number;
    ordnance: number;

    environmentFactor: number
    money: number,
    faith: number,
    lawEnforcement: number,
    healthcare: number
}

export const basePrices = {
    basicFood: 1,
    food: 10,
    luxuryFood: 100,
    tourism: 1000,
    consumerGoods: 500,
    water: 10,
    electricity: 10,
    furniture: 10,
    luxuryFurniture: 100,
    services: 20,
    agriculturalGoods: 5,
    dividents: 1,

    tylium: 1000,
    metals: 10,
    uranium: 100,
    machinery: 10,
    medicine: 10,
    wood: 10,
    oil: 50,
    spaceTransport: 10_000,

    ammunition: 10,
    weapons: 10,
    nuclearWeapons: 10,
    ordnance: 10,

    environmentFactor: 1,
    money: 1,
    lawEnforcement: 10,
    healthcare: 10,
} as ReadonlyRecord<keyof Goods, number>

export function getLowestGoodsRatio(
    requirements: Partial<Record<keyof Goods, number>>,
    available: Record<keyof Goods, number>, level: number, workerRatio: number
) {
    const workerRatios = {} as Record<string, number>

    for(const [key, requirement] of Object.entries(requirements) as [keyof Goods, number][]) {
        const t = available[key] - requirement * level * workerRatio

        if(t > 0) {
            workerRatios[key] = 1
        } else {
            workerRatios[key] = available[key] / (requirement * level * workerRatio)
        }
    }

    const entries = Object.entries(workerRatios)
    if (entries.length === 0) return 1

    return Math.min(...entries.map(([, v]) => v), 1)
}

export function getPrices() {
    return basePrices
}