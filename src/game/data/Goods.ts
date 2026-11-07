import { getLowestRatio } from "../utils/getLowestRatio";

export type Goods = {
    food: number;
    tourism: number;
    consumerGoods: number;
    water: number
    energy: number
    services: number
    agriculturalGoods: number;
    // dividents: number

    tylium: number;
    metals: number;
    uranium: number;
    machinery: number;
    medicine: number;
    lumber: number;
    oil: number;
    spaceTransport: number;

    nuclearWeapons: number;
    vehicles: number;

    environmentFactor: number
    faith: number,
    lawEnforcement: number,
    healthcare: number,
    chemicals: number;
    buildings: number;
    waste: number;
    governance: number;

    logistics: number;
    paper: number;

    entertainment: number;

    education: number;

    retail: number;

    ore: number
    defense: number
    monetaryServices: number

    mobility: number
    militaryEquipment: number
}

export const physicalGoods = new Set<keyof Goods>([
    "militaryEquipment",
    "food",
    "ore",
    "consumerGoods",
    "water",
    "agriculturalGoods",
    "tylium",
    "metals",
    "uranium",
    "machinery",
    "medicine",
    "lumber",
    "oil",
    "spaceTransport",
    "nuclearWeapons",
    "vehicles",
    "chemicals",
    "buildings",
    "waste",
    "paper",
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
    "logistics",
    "monetaryServices",
    "tourism",
    "energy",
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
    "logistics",
    "monetaryServices",
    "tourism",
    "energy",
]);

export const CAN_BE_NEGATIVE: ReadonlySet<keyof Goods> = new Set([
    "environmentFactor",
]);

export const basePrices = {
    food: 30,
    tourism: 300,
    consumerGoods: 100,
    water: 10,
    energy: 20,
    services: 15,
    agriculturalGoods: 20,

    tylium: 150,
    metals: 150,
    uranium: 100,
    machinery: 50,
    medicine: 20,
    lumber: 30,
    oil: 100,
    spaceTransport: 2000,

    nuclearWeapons: 300,
    vehicles: 80,

    environmentFactor: 50,
    faith: 40,
    lawEnforcement: 40,
    healthcare: 70,
    chemicals: 20,
    buildings: 20,
    waste: 2,
    governance: 40,

    paper: 20,
    logistics: 60,
    entertainment: 30,
    education: 80,
    retail: 100,

    mobility: 100,
    ore: 100,
    defense: 100,
    monetaryServices: 200,
    militaryEquipment: 800,
} satisfies Record<keyof Goods, number>

export const godsCategories = new Map<string, Set<keyof Goods>>([
    ["publicServices", new Set(["governance", "healthcare", "lawEnforcement", "education", "logistics"])],
    ["rawMaterials", new Set(["agriculturalGoods", "oil", "ore", "tylium", "water", "energy", "uranium", "environmentFactor"])],
    ["industrialMaterials", new Set(["buildings", "chemicals", "lumber", "metals", "medicine", "paper", "waste", "machinery"])],
    ["consumerGoods", new Set(["consumerGoods", "food"])],
    ["services", new Set(["services", "tourism", "faith", "monetaryServices", "entertainment"])],
    ["military", new Set(["nuclearWeapons", "militaryEquipment", "defense"])],
    ["mobility", new Set(["vehicles", "spaceTransport", "mobility"])]
]) as ReadonlyMap<string, Set<keyof Goods>>;

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