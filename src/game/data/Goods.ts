import { ReadonlyRecord } from "@/lib/readonlyRecord";
import { getLowestRatio } from "../utils/getLowestRatio";

export type Goods = {
    food: number;
    meat: number;
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
    aircraft: number;
    clothing: number;

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
    "meat",
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
    "aircraft",
    "clothing",
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
    food: 30,
    meat: 60,
    tourism: 300,
    consumerGoods: 100,
    water: 10,
    electricity: 20,
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
    wood: 20,
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
    faith: 40,
    lawEnforcement: 40,
    healthcare: 70,
    chemicals: 20,
    buildings: 20,
    waste: 2,
    governance: 40,

    aircraft: 1000,
    clothing: 100,
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

export const godsCategories = new Map<string, Set<keyof Goods>>([
    ["rawMaterials", new Set(["agriculturalGoods", "wood", "oil", "ore", "tylium", "water", "electricity", "uranium", "environmentFactor"])],
    ["industrialMaterials", new Set(["buildings", "chemicals", "electronics", "lumber", "metals", "medicine", "paper", "waste", "machinery"])],
    ["consumerGoods", new Set(["consumerGoods", "luxuryFurniture", "furniture", "food", "meat", "alcoholDrinks", "clothing", "stimulantDrinks"])],
    ["services", new Set(["services", "governance", "healthcare", "lawEnforcement", "tourism", "faith", "monetaryServices", "education", "entertainment", "itServices", "retail", "post"])],
    ["military", new Set(["ammunition", "weapons", "nuclearWeapons", "ordnance", "militaryVehicles", "defense"])],
    ["mobility", new Set(["automotiveMobility", "railroadMobility", "shipMobility", "airMobility", "vehicles", "ships", "aircraft", "railroadVehicles", "spaceTransport"])]
])

if(Object.keys(basePrices).length !== [...godsCategories].reduce((acc, [_, set]) => acc + set.size, 0)) {
    console.error("Goods and basePrices must have the same keys", Object.keys(basePrices), [...godsCategories].reduce((acc, [_, set]) => acc + set.size, 0))
}

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

const priceDamping = 0.3;
const priceMinMultiplier = 0.1;
const priceMaxMultiplier = 10;

export function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>>): Record<keyof Goods, number> {
    const prices = {} as Record<keyof Goods, number>;

    for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
        const stock = goods[key] || 0;
        const base = basePrices[key];
        const baseline = Math.max(base * 10, 1);

        // Continuous supply/demand curve: scarcity raises price, surplus lowers it
        let adjustment = 1.0;
        if(stock > 0) {
            adjustment = baseline / stock;
        } else {
            adjustment = priceMaxMultiplier;
        }
        adjustment = Math.max(priceMinMultiplier, Math.min(priceMaxMultiplier, adjustment));

        const currentPrice = memory[key] ?? base;
        const targetPrice = base * adjustment;
        const dampedPrice = currentPrice + (targetPrice - currentPrice) * priceDamping;
        const clampedPrice = Math.max(base * priceMinMultiplier, Math.min(base * priceMaxMultiplier, dampedPrice));
        memory[key] = clampedPrice;
        prices[key] = clampedPrice;
    }
    return prices;
}