import { ReadonlyRecord } from "@/lib/readonlyRecord";
import { getLowestRatio } from "../utils/getLowestRatio";

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

    ore: number
    defense: number
    monetaryServices: number
    militaryVehicles: number
}

export const physicalGoods = new Set<keyof Goods>([
    "food",
    "ore",
    "luxuryFood",
    "consumerGoods",
    "water",
    "furniture",
    "luxuryFurniture",
    "agriculturalGoods",
    "tylium",
    "metals",
    "uranium",
    "machinery",
    "medicine",
    "wood",
    "lumber",
    "oil",
    "spaceTransport",
    "ammunition",
    "weapons",
    "nuclearWeapons",
    "ordnance",
    "vehicles",
    "electronics",
    "chemicals",
    "buildings",
    "waste",
    "railroadVehicles",
    "ships",
    "luxuryShips",
    "aircraft",
    "clothing",
    "constructionMaterials",
    "paper",
    "alcoholDrinks",
    "stimulantDrinks",
    "militaryVehicles"
])

export const services = new Set<keyof Goods>([
    "services",
    "faith",
    "lawEnforcement",
    "healthcare",
    "education",
    "governance",
    "environmentFactor",
    "defense",
    "retail",
    "entertainment",
    "itServices",
    "post",
    "monetaryServices",
    "airMobility",
    "automotiveMobility",
    "railroadMobility",
    "shipMobility",
    "tourism",
    "electricity",
])

export const NON_CUMULATING_GOODS: ReadonlySet<keyof Goods> = new Set([
    "services",
    "faith",
    "lawEnforcement",
    "healthcare",
    "education",
    "governance",
    "environmentFactor",
    "defense",
    "retail",
    "entertainment",
    "itServices",
    "post",
    "monetaryServices",
    "airMobility",
    "automotiveMobility",
    "railroadMobility",
    "shipMobility",
    "tourism",
    "electricity",
]);

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
    metals: 150,
    uranium: 100,
    machinery: 50,
    medicine: 20,
    wood: 10,
    lumber: 30,
    oil: 100,
    spaceTransport: 2000,

    ammunition: 20,
    weapons: 30,
    nuclearWeapons: 300,
    ordnance: 50,
    vehicles: 80,
    electronics: 60,

    environmentFactor: 50,
    faith: 20,
    lawEnforcement: 20,
    healthcare: 50,
    chemicals: 20,
    buildings: 20,
    waste: 2,
    governance: 20,

    aircraft: 1000,
    clothing: 100,
    constructionMaterials: 100,
    luxuryShips: 1000,
    ships: 100,
    railroadVehicles: 100,
    paper: 20,
    post: 40,
    entertainment: 30,
    itServices: 50,
    education: 80,
    alcoholDrinks: 50,
    stimulantDrinks: 50,
    retail: 100,

    automotiveMobility: 100,
    railroadMobility: 100,
    shipMobility: 100,
    airMobility: 100,
    ore: 100,
    defense: 100,
    monetaryServices: 200,
    militaryVehicles: 500
} satisfies ReadonlyRecord<keyof Goods, number>

export function getLowestGoodsRatio(
    requirements: Partial<Record<keyof Goods, number>>,
    available: Record<keyof Goods, number>, level: number, workerRatio: number
) {
    return getLowestRatio(
        requirements as Record<string, number>,
        (key) => available[key as keyof Goods] ?? 0,
        level,
        workerRatio
    )
}

const priceDamping = 0.4;
const priceMaxDeviation = 0.25;

export function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>>): Record<keyof Goods, number> {
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