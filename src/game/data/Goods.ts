import { getLowestRatio } from "../utils/getLowestRatio";

export type Goods = {
    food: number;
    tourism: number;
    consumerGoods: number;
    water: number
    energy: number
    services: number
    agriculturalGoods: number;
    tylium: number;
    metals: number;
    fissionMaterial: number;
    machinery: number;
    medicine: number;
    lumber: number;
    oil: number;
    spaceShips: number;
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
    defense: number
    monetaryServices: number
    mobility: number
    militaryEquipment: number
}

export const physicalGoods = new Set<keyof Goods>([
    "militaryEquipment",
    "food",
    "consumerGoods",
    "water",
    "agriculturalGoods",
    "tylium",
    "metals",
    "fissionMaterial",
    "machinery",
    "medicine",
    "lumber",
    "oil",
    "spaceShips",
    "nuclearWeapons",
    "vehicles",
    "chemicals",
    "buildings",
    "waste",
    "paper",
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
    fissionMaterial: 100,
    machinery: 50,
    medicine: 20,
    lumber: 30,
    oil: 100,
    spaceShips: 2000,

    nuclearWeapons: 300,
    vehicles: 80,

    environmentFactor: 50,
    faith: 40,
    lawEnforcement: 40,
    healthcare: 70,
    chemicals: 40,
    buildings: 20,
    waste: 2,
    governance: 40,

    paper: 30,
    logistics: 60,
    entertainment: 30,
    education: 80,

    mobility: 200,
    defense: 100,
    monetaryServices: 200,
    militaryEquipment: 800,
} satisfies Record<keyof Goods, number>

export const godsCategories = new Map<string, Set<keyof Goods>>([
    ["publicServices", new Set(["governance", "healthcare", "lawEnforcement", "education", "logistics"])],
    ["rawMaterials", new Set(["agriculturalGoods", "oil", "tylium", "water", "energy", "fissionMaterial", "environmentFactor"])],
    ["industrialMaterials", new Set(["buildings", "chemicals", "lumber", "metals", "medicine", "paper", "waste", "machinery"])],
    ["consumerGoods", new Set(["consumerGoods", "food"])],
    ["services", new Set(["services", "tourism", "faith", "monetaryServices", "entertainment"])],
    ["military", new Set(["nuclearWeapons", "militaryEquipment", "defense"])],
    ["mobility", new Set(["vehicles", "spaceShips", "mobility"])]
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

