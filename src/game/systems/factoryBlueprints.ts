import { generateIndustrialSector, type IndustryReducer } from "./generateIndustrialSector";
import type { IndustrialSectors } from "../components/Factories";

export const industryReducers = Object.entries({
    mine: generateIndustrialSector({
        name: "mine", goodsRequirements: {
            machinery: 8, electricity: 1, buildings: 4, governance: 2, electronics: 1, vehicles: 0.1
        }, workerRequirement: { miner: 50, clerks: 2 }, goodsProduction: { metals: 70, uranium: 10, tylium: 2, waste: 2 },
        efficiencyBonus: 0.01
    }),
    oilRig: generateIndustrialSector({
        name: "oilRig", goodsRequirements: { vehicles: 0.1, machinery: 8, electricity: 1, buildings: 4, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 5 }, goodsProduction: { oil: 80, waste: 2 },
        efficiencyBonus: 0.01
    }),
    forestry: generateIndustrialSector({
        name: "forestry", goodsRequirements: { vehicles: 0.1, ammunition: 1, chemicals: 3, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { wood: 180, agriculturalGoods: 20, },
        efficiencyBonus: 0.01
    }),
    farm: generateIndustrialSector({
        name: "farm", goodsRequirements: { vehicles: 0.1, machinery: 5, water: 4, chemicals: 8, buildings: 4, governance: 2, electronics: 1 }, workerRequirement: { farmer: 100, clerks: 1 }, goodsProduction: { agriculturalGoods: 100, },
        efficiencyBonus: 0.01
    }),
    fishery: generateIndustrialSector({
        name: "fishery", goodsRequirements: { vehicles: 0.1, machinery: 3, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { agriculturalGoods: 30 },
        efficiencyBonus: 0.01
    }),
    foodFactory: generateIndustrialSector({
        name: "foodFactory",
        goodsRequirements: { vehicles: 0.1, agriculturalGoods: 20, machinery: 8, buildings: 3, governance: 2, electronics: 1 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { food: 150, retail: 20 },
        efficiencyBonus: 0.01
    }),
    luxuryFood: generateIndustrialSector({
        name: "luxuryFood",
        goodsRequirements: { vehicles: 0.1, machinery: 6, electricity: 18, buildings: 3, governance: 2, electronics: 1 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { luxuryFood: 22, retail: 20 },
        efficiencyBonus: 0.01
    }),
    waterTreatment: generateIndustrialSector({
        name: "waterTreatment", goodsRequirements: { vehicles: 0.1, electricity: 20, machinery: 12, chemicals: 8, buildings: 6, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { water: 1500 },
        efficiencyBonus: 0.01
    }),
    powerPlant: generateIndustrialSector({
        name: "powerPlant", goodsRequirements: { vehicles: 0.1, oil: 14, machinery: 6, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { electricity: 220, waste: 1 },
        efficiencyBonus: 0.01
    }),
    metalFactory: generateIndustrialSector({
        name: "metalFactory", goodsRequirements: { vehicles: 0.1, metals: 10, machinery: 8, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { metals: 60, waste: 1 },
        efficiencyBonus: 0.01
    }),
    lumberMill: generateIndustrialSector({
        name: "lumberMill", goodsRequirements: { vehicles: 0.1, wood: 30, machinery: 6, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { lumber: 40 },
        efficiencyBonus: 0.01
    }),
    machineryFactory: generateIndustrialSector({
        name: "machineryFactory", goodsRequirements: { vehicles: 0.1, metals: 8, electricity: 15, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { machinery: 40 },
        efficiencyBonus: 0.01
    }),
    medicineFactory: generateIndustrialSector({
        name: "medicineFactory", goodsRequirements: { vehicles: 0.1, chemicals: 5, machinery: 6, electricity: 14, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, scientist: 1, clerks: 1 }, goodsProduction: { medicine: 35 },
        efficiencyBonus: 0.01
    }),
    consumerFactory: generateIndustrialSector({
        name: "consumerFactory", goodsRequirements: { vehicles: 0.1, chemicals: 6, machinery: 8, electricity: 22, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { consumerGoods: 20 },
        efficiencyBonus: 0.01
    }),
    luxuryFurnitureFactory: generateIndustrialSector({
        name: "luxuryFurnitureFactory", goodsRequirements: { retail: 50, vehicles: 0.1, lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { luxuryFurniture: 14 },
        efficiencyBonus: 0.01
    }),
    furnitureFactory: generateIndustrialSector({
        name: "furnitureFactory", goodsRequirements: { retail: 20, vehicles: 0.1, lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { furniture: 50 },
        efficiencyBonus: 0.01
    }),
    ammunitionFactory: generateIndustrialSector({
        name: "ammunitionFactory", goodsRequirements: { retail: 10, vehicles: 0.1, metals: 8, chemicals: 5, machinery: 8, electricity: 20, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { ammunition: 50 },
        efficiencyBonus: 0.01
    }),
    weaponFactory: generateIndustrialSector({
        name: "weaponFactory", goodsRequirements: { retail: 10, vehicles: 0.1, metals: 10, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 100 }, goodsProduction: { weapons: 20 },
        efficiencyBonus: 0.01
    }),
    nuclearWeaponFactory: generateIndustrialSector({
        name: "nuclearWeaponFactory", goodsRequirements: { vehicles: 0.1, uranium: 5, machinery: 8, electricity: 28, buildings: 12, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { nuclearWeapons: 5 },
        efficiencyBonus: 0.01
    }),
    ordnanceFactory: generateIndustrialSector({
        name: "ordnanceFactory", goodsRequirements: { vehicles: 0.1, metals: 12, chemicals: 6, machinery: 8, ammunition: 10, electricity: 24, buildings: 10, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { ordnance: 30 },
        efficiencyBonus: 0.01
    }),
    spaceport: generateIndustrialSector({
        name: "spaceport", goodsRequirements: { vehicles: 0.1, machinery: 8, furniture: 10, electricity: 25, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { spaceTransport: 5 },
        efficiencyBonus: 0.01
    }),
    spaceShipyard: generateIndustrialSector({
        name: "spaceShipyard", goodsRequirements: { vehicles: 0.1, metals: 16, machinery: 14, electricity: 28, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { spaceTransport: 8 },
        efficiencyBonus: 0.01
    }),
    orbitalFactory: generateIndustrialSector({
        name: "orbitalFactory", goodsRequirements: { vehicles: 0.1, machinery: 12, electricity: 28, tylium: 5, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { tylium: 12 },
        efficiencyBonus: 0.01
    }),
    construction: generateIndustrialSector({
        name: "construction", goodsRequirements: {
            vehicles: 0.1,
            lumber: 8,
            metals: 6,
            chemicals: 4,
            electricity: 4,
            governance: 2,
            electronics: 1,
            constructionMaterials: 10,
            retail: 20
        }, workerRequirement: { worker: 100, clerks: 2 }, goodsProduction: { buildings: 80 },
        efficiencyBonus: 0.01
    }),
    services: generateIndustrialSector({
        name: "services", goodsRequirements: { retail: 50, vehicles: 0.1, electricity: 22, furniture: 8, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { serviceWorker: 100 }, goodsProduction: { services: 65 },
        efficiencyBonus: 0.01
    }),
    tourism: generateIndustrialSector({
        name: "tourism", goodsRequirements: { retail: 50, vehicles: 0.1, services: 12, luxuryFood: 6, luxuryFurniture: 8, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 20, clerks: 1, serviceWorker: 50 }, goodsProduction: { tourism: 12 },
        efficiencyBonus: 0.01
    }),
    education: generateIndustrialSector({
        name: "education", goodsRequirements: {
            vehicles: 0.1, electricity: 10, services: 6, buildings: 2, governance: 2, electronics: 1
        }, workerRequirement: { teacher: 100, clerks: 10, worker: 5 }, goodsProduction: { education: 300 },
        efficiencyBonus: 0.01
    }),
    healthcare: generateIndustrialSector({
        name: "healthcare", goodsRequirements: { retail: 20, vehicles: 0.1, medicine: 3, electricity: 8, buildings: 2, governance: 2, electronics: 1 }, workerRequirement: { healtcarePersonal: 100, clerks: 1, worker: 1 }, goodsProduction: { healthcare: 200 },
        efficiencyBonus: 0.01
    }),
    environmentControl: generateIndustrialSector({
        name: "environmentControl", goodsRequirements: { vehicles: 0.1, electricity: 14, medicine: 3, chemicals: 3, buildings: 6, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { environmentFactor: 30 },
        efficiencyBonus: 0.01
    }),
    chemical: generateIndustrialSector({
        name: "chemical", goodsRequirements: { vehicles: 0.1, oil: 8, electricity: 15, buildings: 2, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { chemicals: 70, waste: 4 },
        efficiencyBonus: 0.01
    }),
    bank: generateIndustrialSector({
        name: "bank", goodsRequirements: { vehicles: 0.1, electricity: 14, services: 8, buildings: 2, governance: 2, electronics: 1 }, workerRequirement: { worker: 50, clerks: 50 }, goodsProduction: { money: 35 },
        efficiencyBonus: 0.01
    }),
    religion: generateIndustrialSector({
        name: "religion", goodsRequirements: { vehicles: 0.1, services: 12, money: 15, buildings: 2, governance: 2, electronics: 1 }, workerRequirement: { clergy: 5, clerks: 1, worker: 1 }, goodsProduction: { faith: 200 },
        efficiencyBonus: 0.01
    }),
    lawEnforcement: generateIndustrialSector({
        name: "lawEnforcement", goodsRequirements: { vehicles: 0.1, electricity: 12, weapons: 3, buildings: 2, governance: 2, electronics: 1 }, workerRequirement: { policeMen: 100, worker: 1, clerks: 2 }, goodsProduction: { lawEnforcement: 80 },
        efficiencyBonus: 0.01
    }),
    nuclearSector: generateIndustrialSector({
        name: "nuclearSector", goodsRequirements: { vehicles: 0.1, uranium: 8, machinery: 8, electricity: 10, buildings: 4, governance: 2, electronics: 1 }, workerRequirement: { scientist: 2, worker: 100, clerks: 2 }, goodsProduction: { electricity: 320, waste: 3 },
        efficiencyBonus: 0.01
    }),
    greenEnergy: generateIndustrialSector({
        name: "greenEnergy", goodsRequirements: { vehicles: 0.1, machinery: 6, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 1 }, goodsProduction: { electricity: 160 },
        efficiencyBonus: 0.01
    }),
    alternativeMedicine: generateIndustrialSector({
        name: "alternativeMedicine", goodsRequirements: { retail: 20, vehicles: 0.1, agriculturalGoods: 25, buildings: 1, governance: 2, electronics: 1 }, workerRequirement: { worker: 100, clerks: 2 }, goodsProduction: { healthcare: 120 },
        efficiencyBonus: 0.01
    }),
    recycling: generateIndustrialSector({
        name: "recycling",
        goodsRequirements: { waste: 20, electricity: 4, buildings: 3, governance: 2, electronics: 1, vehicles: 0.1 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { metals: 6, lumber: 4, water: 30, chemicals: 2, oil: 4 },
        outputLevelModifier: (level) => level * (1 + 0.08 * (level - 1))
    }),
    government: generateIndustrialSector({
        name: "government",
        goodsRequirements: { vehicles: 0.1, services: 5, buildings: 2, electronics: 1 },
        workerRequirement: { clerks: 80, worker: 20 },
        goodsProduction: { governance: 100 },
        efficiencyBonus: 0.01
    }),
    automotive: generateIndustrialSector({
        name: "automotive",
        goodsRequirements: { retail: 20, machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { vehicles: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    electronics: generateIndustrialSector({
        name: "electronics",
        goodsRequirements: { retail: 20, vehicles: 0.1, machinery: 6, chemicals: 5, electricity: 18, buildings: 3, governance: 2 },
        workerRequirement: { worker: 100, scientist: 2, clerks: 1 },
        goodsProduction: { electronics: 20 },
        efficiencyBonus: 0.01
    }),
    railroadVehicles: generateIndustrialSector({
        name: "railroadVehicles",
        goodsRequirements: { machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { railroadVehicles: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    ships: generateIndustrialSector({
        name: "ships",
        goodsRequirements: { machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { ships: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    luxuryShips: generateIndustrialSector({
        name: "luxuryShips",
        goodsRequirements: { retail: 20, machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { luxuryShips: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    aircraft: generateIndustrialSector({
        name: "aircraft",
        goodsRequirements: { machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { aircraft: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    clothing: generateIndustrialSector({
        name: "clothing",
        goodsRequirements: { retail: 50, machinery: 8, chemicals: 2, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, agriculturalGoods: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { clothing: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    constructionMaterials: generateIndustrialSector({
        name: "constructionMaterials",
        goodsRequirements: { machinery: 8, oil: 2, electricity: 15, buildings: 3, water: 20, governance: 2, electronics: 1, lumber: 10, metals: 10 },
        workerRequirement: { worker: 100, scientist: 1, clerks: 1 },
        goodsProduction: { constructionMaterials: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    paperFactory: generateIndustrialSector({
        name: "paperFactory",
        goodsRequirements: { vehicles: 0.1, wood: 20, chemicals: 8, machinery: 6, electricity: 16, buildings: 3, governance: 2, electronics: 1 },
        workerRequirement: { worker: 100, clerks: 5 },
        goodsProduction: { paper: 180 },
        efficiencyBonus: 0.01
    }),
    postalServices: generateIndustrialSector({
        name: "postalServices",
        goodsRequirements: { retail: 50, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 5 },
        goodsProduction: { post: 15, waste: 1 },
        efficiencyBonus: 0.01
    }),
    entertainmentIndustry: generateIndustrialSector({
        name: "entertainmentIndustry",
        goodsRequirements: { retail: 50, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 5 },
        goodsProduction: { entertainment: 15, waste: 1 },
        efficiencyBonus: 0.01,
    }),
    informationTechnology: generateIndustrialSector({
        name: "informationTechnology",
        goodsRequirements: { electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { itServices: 15, waste: 1 },
        efficiencyBonus: 0.01,
    }),
    alcoholicDrinkIndustry: generateIndustrialSector({
        name: "alcoholicDrinkIndustry",
        goodsRequirements: { retail: 20, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { alcoholDrinks: 15, waste: 1 },
        efficiencyBonus: 0.01,
    }),
    stimulantDrinkIndustry: generateIndustrialSector({
        name: "stimulantDrinkIndustry",
        goodsRequirements: { retail: 20, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { stimulantDrinks: 15, waste: 1 },
        efficiencyBonus: 0.01,
    }),
    retail: generateIndustrialSector({
        name: "retail",
        goodsRequirements: { electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 100, clerks: 1 },
        goodsProduction: { waste: 1 },
        efficiencyBonus: 0.01,
    }),
} satisfies Record<keyof IndustrialSectors, IndustryReducer>)

export function getSectorOutputLevel(name: keyof IndustrialSectors, level: number): number {
    const entry = industryReducers.find(([n]) => n === name) as [string, IndustryReducer] | undefined;
    if(!entry) return level;
    const config = (entry[1] as IndustryReducer & { config?: { efficiencyBonus?: number; outputLevelModifier?: (level: number) => number } }).config;
    if(!config) return level;
    if(config.outputLevelModifier) return config.outputLevelModifier(level);
    if(config.efficiencyBonus && config.efficiencyBonus > 0) return level * (1 + config.efficiencyBonus * (level - 1));
    return level;
}
