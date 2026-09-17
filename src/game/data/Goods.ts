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
    lumber: number;
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
    healthcare: number,
    chemicals: number;
    buildings: number;
    waste: number;
}

export const basePrices = {
    basicFood: 1,
    food: 10,
    luxuryFood: 40,
    tourism: 300,
    consumerGoods: 100,
    water: 10,
    electricity: 10,
    furniture: 10,
    luxuryFurniture: 40,
    services: 15,
    agriculturalGoods: 5,
    dividents: 10,

    tylium: 150,
    metals: 10,
    uranium: 100,
    machinery: 10,
    medicine: 10,
    wood: 10,
    lumber: 20,
    oil: 50,
    spaceTransport: 2000,

    ammunition: 15,
    weapons: 30,
    nuclearWeapons: 300,
    ordnance: 30,

    environmentFactor: 10,
    money: 10,
    lawEnforcement: 10,
    healthcare: 10,
    chemicals: 10,
    buildings: 12,
    waste: 2,
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
            workerRatios[key] = Math.max(0, available[key] / (requirement * level * workerRatio))
        }
    }

    const entries = Object.entries(workerRatios)
    if (entries.length === 0) return 1

    return Math.max(0, Math.min(...entries.map(([, v]) => v), 1))
}

export function getPrices() {
    return basePrices
}