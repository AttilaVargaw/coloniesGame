import { ReadonlyRecord } from "@/lib/readonlyRecord";

export type Goods = {
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
    // dividents: number

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
    vehicles: number;
    electronics: number;

    environmentFactor: number
    money: number,
    faith: number,
    lawEnforcement: number,
    healthcare: number,
    chemicals: number;
    buildings: number;
    waste: number;
    governance: number;

    railroadVehicles: number;
    ships: number;
    luxuryShips: number;
    aircraft: number;
    clothing: number;
    constructionMaterials: number;

    post: number;
    paper: number;

    entertainment: number;
    itServices: number;

    education: number;

    alcoholDrinks: number;
    stimulantDrinks: number;

    retail: number;
    automotiveMobility: number,
    railroadMobility: number,
    shipMobility: number,
    airMobility: number,
}

export const basePrices = {
    food: 10,
    luxuryFood: 60,
    tourism: 300,
    consumerGoods: 100,
    water: 10,
    electricity: 10,
    furniture: 10,
    luxuryFurniture: 120,
    services: 15,
    agriculturalGoods: 5,
    // dividents: 10,

    tylium: 150,
    metals: 10,
    uranium: 100,
    machinery: 10,
    medicine: 10,
    wood: 10,
    lumber: 20,
    oil: 100,
    spaceTransport: 2000,

    ammunition: 15,
    weapons: 30,
    nuclearWeapons: 300,
    ordnance: 30,
    vehicles: 80,
    electronics: 60,

    environmentFactor: 10,
    money: 10,
    faith: 10,
    lawEnforcement: 10,
    healthcare: 10,
    chemicals: 10,
    buildings: 12,
    waste: 2,
    governance: 10,

    aircraft: 1000,
    clothing: 100,
    constructionMaterials: 100,
    luxuryShips: 1000,
    ships: 100,
    railroadVehicles: 100,
    paper: 15,
    post: 10,
    entertainment: 20,
    itServices: 10,
    education: 50,
    alcoholDrinks: 50,
    stimulantDrinks: 50,
    retail: 100,

    automotiveMobility: 100,
    railroadMobility: 100,
    shipMobility: 100,
    airMobility: 100,
} satisfies ReadonlyRecord<keyof Goods, number>

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
    if(entries.length === 0) return 1

    return Math.max(0, Math.min(...entries.map(([, v]) => v), 1))
}

const priceMemory: Partial<Record<keyof Goods, number>> = {};
const priceDamping = 0.4;
const priceMaxDeviation = 0.25;

export function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>> = priceMemory): Record<keyof Goods, number> {
    const prices = {} as Record<keyof Goods, number>;

    for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
        const stock = goods[key] || 0;
        const base = basePrices[key];
        const baseline = Math.max(base * 10, 1);
        const stockRatio = stock / baseline;

        let adjustment = 1.0;

        if(stockRatio < 0.2) {
            adjustment = 1.25;
        }
        else if(stockRatio < 0.5) {
            adjustment = 1.1;
        }
        else if(stockRatio > 4) {
            adjustment = 0.9;
        }
        else if(stockRatio > 2) {
            adjustment = 0.95;
        }

        const currentPrice = memory[key] ?? base;
        const targetPrice = base * adjustment;
        const dampedPrice = currentPrice + (targetPrice - currentPrice) * priceDamping;
        const clampedPrice = Math.max(base * (1 - priceMaxDeviation), Math.min(base * (1 + priceMaxDeviation), dampedPrice));
        memory[key] = clampedPrice;
        prices[key] = clampedPrice;
    }
    return prices;
}