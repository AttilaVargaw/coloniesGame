import { generateIndustrialSector, type IndustryReducer } from "./generateIndustrialSector";
import type { IndustrialSectors } from "../components/Factories";

export const industryReducers = Object.entries({
    mine: generateIndustrialSector({
        name: "mine", goodsRequirements: { machinery: 8, electricity: 1, buildings: 4 }, workerRequirement: { miner: 20, clerks: 2 }, goodsProduction: { metals: 70, uranium: 6, tylium: 2, waste: 2 },
        efficiencyBonus: 0.02
    }),
    oilRig: generateIndustrialSector({
        name: "oilRig", goodsRequirements: { machinery: 8, electricity: 1, buildings: 4 }, workerRequirement: { worker: 40, clerks: 10 }, goodsProduction: { oil: 80, waste: 2 },
        efficiencyBonus: 0.02
    }),
    forestry: generateIndustrialSector({
        name: "forestry", goodsRequirements: { ammunition: 1, chemicals: 3, buildings: 3 }, workerRequirement: { worker: 6, clergy: 2 }, goodsProduction: { wood: 180, agriculturalGoods: 20, basicFood: 10 },
        efficiencyBonus: 0.02
    }),
    farm: generateIndustrialSector({
        name: "farm", goodsRequirements: { machinery: 5, water: 4, chemicals: 8, buildings: 4 }, workerRequirement: { farmer: 10, clerks: 2 }, goodsProduction: { agriculturalGoods: 100, basicFood: 60 },
        efficiencyBonus: 0.02
    }),
    fishery: generateIndustrialSector({
        name: "fishery", goodsRequirements: { machinery: 3, buildings: 3 }, workerRequirement: { worker: 10, clerks: 2 }, goodsProduction: { basicFood: 80, agriculturalGoods: 30 },
        efficiencyBonus: 0.02
    }),
    foodFactory: generateIndustrialSector({
        name: "foodFactory",
        goodsRequirements: { agriculturalGoods: 20, machinery: 8, buildings: 3 },
        workerRequirement: { worker: 10, clerks: 2 },
        goodsProduction: { food: 150, },
        efficiencyBonus: 0.02
    }),
    luxuryFood: generateIndustrialSector({
        name: "luxuryFood",
        goodsRequirements: { machinery: 6, electricity: 18, buildings: 3 },
        workerRequirement: { worker: 20, clerks: 2 },
        goodsProduction: { luxuryFood: 22 },
        efficiencyBonus: 0.02
    }),
    waterTreatment: generateIndustrialSector({
        name: "waterTreatment", goodsRequirements: { electricity: 20, machinery: 12, chemicals: 8, buildings: 6 }, workerRequirement: { worker: 30, clerks: 2 }, goodsProduction: { water: 1500 },
        efficiencyBonus: 0.02
    }),
    powerPlant: generateIndustrialSector({
        name: "powerPlant", goodsRequirements: { oil: 14, machinery: 6, buildings: 3 }, workerRequirement: { worker: 10, clerks: 2 }, goodsProduction: { electricity: 220, waste: 1 },
        efficiencyBonus: 0.02
    }),
    metalFactory: generateIndustrialSector({
        name: "metalFactory", goodsRequirements: { metals: 10, machinery: 8, electricity: 20, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { metals: 60, waste: 1 },
        efficiencyBonus: 0.02
    }),
    lumberMill: generateIndustrialSector({
        name: "lumberMill", goodsRequirements: { wood: 30, machinery: 6, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { furniture: 40, lumber: 40 },
        efficiencyBonus: 0.02
    }),
    machineryFactory: generateIndustrialSector({
        name: "machineryFactory", goodsRequirements: { metals: 8, electricity: 15, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { machinery: 40 },
        efficiencyBonus: 0.02
    }),
    medicineFactory: generateIndustrialSector({
        name: "medicineFactory", goodsRequirements: { chemicals: 5, machinery: 6, electricity: 14, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2, scientist: 2 }, goodsProduction: { medicine: 35 },
        efficiencyBonus: 0.02
    }),
    consumerFactory: generateIndustrialSector({
        name: "consumerFactory", goodsRequirements: { furniture: 10, chemicals: 6, machinery: 8, electricity: 22, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { consumerGoods: 20 },
        efficiencyBonus: 0.02
    }),
    furnitureFactory: generateIndustrialSector({
        name: "furnitureFactory", goodsRequirements: { lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 3 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { luxuryFurniture: 14 },
        efficiencyBonus: 0.02
    }),
    ammunitionFactory: generateIndustrialSector({
        name: "ammunitionFactory", goodsRequirements: { metals: 8, chemicals: 5, machinery: 8, electricity: 20, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { ammunition: 50 },
        efficiencyBonus: 0.02
    }),
    weaponFactory: generateIndustrialSector({
        name: "weaponFactory", goodsRequirements: { metals: 10, machinery: 6, electricity: 20, buildings: 3 }, workerRequirement: { worker: 20 }, goodsProduction: { weapons: 20 },
        efficiencyBonus: 0.02
    }),
    nuclearWeaponFactory: generateIndustrialSector({
        name: "nuclearWeaponFactory", goodsRequirements: { uranium: 5, machinery: 8, electricity: 28, buildings: 12 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { nuclearWeapons: 5 },
        efficiencyBonus: 0.02
    }),
    ordnanceFactory: generateIndustrialSector({
        name: "ordnanceFactory", goodsRequirements: { metals: 12, chemicals: 6, machinery: 8, ammunition: 10, electricity: 24, buildings: 10 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { ordnance: 30 },
        efficiencyBonus: 0.02
    }),
    spaceport: generateIndustrialSector({
        name: "spaceport", goodsRequirements: { machinery: 8, furniture: 10, electricity: 25, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { spaceTransport: 5 },
        efficiencyBonus: 0.02
    }),
    spaceShipyard: generateIndustrialSector({
        name: "spaceShipyard", goodsRequirements: { metals: 16, machinery: 14, electricity: 28, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { spaceTransport: 8 },
        efficiencyBonus: 0.02
    }),
    orbitalFactory: generateIndustrialSector({
        name: "orbitalFactory", goodsRequirements: { machinery: 12, electricity: 28, tylium: 5, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { tylium: 12 },
        efficiencyBonus: 0.02
    }),
    construction: generateIndustrialSector({
        name: "construction", goodsRequirements: { lumber: 8, metals: 6, chemicals: 4, electricity: 4, buildings: 4 }, workerRequirement: { worker: 40, clerks: 2 }, goodsProduction: { buildings: 80 },
        efficiencyBonus: 0.02
    }),
    services: generateIndustrialSector({
        name: "services", goodsRequirements: { electricity: 22, furniture: 8, buildings: 3 }, workerRequirement: { serviceWorker: 2 }, goodsProduction: { services: 65 },
        efficiencyBonus: 0.02
    }),
    tourism: generateIndustrialSector({
        name: "tourism", goodsRequirements: { services: 12, luxuryFood: 6, luxuryFurniture: 8, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { tourism: 12 },
        efficiencyBonus: 0.02
    }),
    education: generateIndustrialSector({ 
        name: "education", goodsRequirements: { electricity: 10, services: 6, buildings: 2 }, workerRequirement: { teacher: 10, clerks: 2, worker: 2 }, goodsProduction: { dividents: 35 },
        efficiencyBonus: 0.02
    }),
    healthcare: generateIndustrialSector({
        name: "healthcare", goodsRequirements: { medicine: 3, electricity: 8, buildings: 2 }, workerRequirement: { healtcarePersonal: 10, clerks: 2, worker: 2 }, goodsProduction: { healthcare: 200 },
        efficiencyBonus: 0.02
    }),
    environmentControl: generateIndustrialSector({
        name: "environmentControl", goodsRequirements: { electricity: 14, medicine: 3, chemicals: 3, buildings: 6 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { environmentFactor: 30 },
        efficiencyBonus: 0.02
    }),
    chemical: generateIndustrialSector({
        name: "chemical", goodsRequirements: { oil: 8, electricity: 15, buildings: 2 }, workerRequirement: { worker: 10, clerks: 2 }, goodsProduction: { chemicals: 70, waste: 4 },
        efficiencyBonus: 0.02
    }),
    bank: generateIndustrialSector({
        name: "bank", goodsRequirements: { electricity: 14, services: 8, buildings: 2 }, workerRequirement: { worker: 2, clerks: 6 }, goodsProduction: { money: 35 },
        efficiencyBonus: 0.02
    }),
    religion: generateIndustrialSector({
        name: "religion", goodsRequirements: { services: 12, money: 15, buildings: 2 }, workerRequirement: { clergy: 8, clerks: 2, worker: 2 }, goodsProduction: { faith: 200 },
        efficiencyBonus: 0.02
    }),
    lawEnforcement: generateIndustrialSector({
        name: "lawEnforcement", goodsRequirements: { electricity: 12, weapons: 3, buildings: 2 }, workerRequirement: { policeMen: 20, worker: 2, clerks: 2 }, goodsProduction: { lawEnforcement: 80 },
        efficiencyBonus: 0.02
    }),
    nuclearSector: generateIndustrialSector({
        name: "nuclearSector", goodsRequirements: { uranium: 8, machinery: 8, electricity: 10, buildings: 4 }, workerRequirement: { scientist: 4, worker: 16, clerks: 4 }, goodsProduction: { electricity: 320, waste: 3 },
        efficiencyBonus: 0.02
    }),
    greenEnergy: generateIndustrialSector({
        name: "greenEnergy", goodsRequirements: { machinery: 6, buildings: 8 }, workerRequirement: { worker: 20, clerks: 2 }, goodsProduction: { electricity: 160 },
        efficiencyBonus: 0.02
    }),
    alternativeMedicine: generateIndustrialSector({
        name: "alternativeMedicine", goodsRequirements: { agriculturalGoods: 25, buildings: 1 }, workerRequirement: { worker: 10, clerks: 2 }, goodsProduction: { healthcare: 120 },
        efficiencyBonus: 0.02
    }),
    recycling: generateIndustrialSector({
        name: "recycling",
        goodsRequirements: { waste: 20, electricity: 4, buildings: 3 },
        workerRequirement: { worker: 10, clerks: 2 },
        goodsProduction: { metals: 6, lumber: 4, water: 30, chemicals: 2, oil: 4 },
        outputLevelModifier: (level) => level * (1 + 0.08 * (level - 1))
    }),
    government: generateIndustrialSector({
        name: "government",
        goodsRequirements: { services: 5, buildings: 2 },
        workerRequirement: { clerks: 10 },
        goodsProduction: { governance: 100 },
        efficiencyBonus: 0.02
    }),
});

export function getSectorOutputLevel(name: keyof IndustrialSectors, level: number): number {
    const entry = industryReducers.find(([n]) => n === name) as [string, IndustryReducer] | undefined;
    if(!entry) return level;
    const config = (entry[1] as IndustryReducer & { config?: { efficiencyBonus?: number; outputLevelModifier?: (level: number) => number } }).config;
    if(!config) return level;
    if(config.outputLevelModifier) return config.outputLevelModifier(level);
    if(config.efficiencyBonus && config.efficiencyBonus > 0) return level * (1 + config.efficiencyBonus * (level - 1));
    return level;
}

export const sectorUpgradeCosts: Record<string, number> = {
    mine: 50,
    oilRig: 50,
    forestry: 30,
    farm: 30,
    fishery: 30,
    foodFactory: 80,
    luxuryFood: 60,
    waterTreatment: 100,
    powerPlant: 120,
    metalFactory: 80,
    lumberMill: 60,
    machineryFactory: 100,
    medicineFactory: 100,
    consumerFactory: 80,
    furnitureFactory: 60,
    ammunitionFactory: 100,
    weaponFactory: 120,
    nuclearWeaponFactory: 200,
    ordnanceFactory: 120,
    spaceport: 200,
    spaceShipyard: 200,
    orbitalFactory: 150,
    construction: 80,
    services: 50,
    tourism: 60,
    education: 80,
    healthcare: 100,
    environmentControl: 60,
    chemical: 80,
    bank: 100,
    religion: 40,
    lawEnforcement: 80,
    nuclearSector: 150,
    greenEnergy: 100,
    alternativeMedicine: 50,
    recycling: 40,
    government: 80,
};
