import { generateIndustrialSector } from "./generateIndustrialSector";

export const industryReducers = Object.entries({
    mine: generateIndustrialSector({
        name: "mine", goodsRequirements: { machinery: 10, electricity: 1, buildings: 5 }, workerRequirement: { miner: 10, clerks: 1 }, goodsProduction: { metals: 70, uranium: 6, tylium: 2 }
    }),
    oilRig: generateIndustrialSector({
        name: "oilRig", goodsRequirements: { machinery: 10, electricity: 1, buildings: 5 }, workerRequirement: { worker: 20, clerks: 5 }, goodsProduction: { oil: 150 }
    }),
    forestry: generateIndustrialSector({
        name: "forestry", goodsRequirements: { ammunition: 1, chemicals: 5, buildings: 3 }, workerRequirement: { worker: 3, clergy: 1 }, goodsProduction: { wood: 180, agriculturalGoods: 20, basicFood: 10 }
    }),
    farm: generateIndustrialSector({
        name: "farm", goodsRequirements: { machinery: 5, water: 10, chemicals: 10, buildings: 4 }, workerRequirement: { farmer: 5, clerks: 1 }, goodsProduction: { agriculturalGoods: 100, basicFood: 60 }
    }),
    fishery: generateIndustrialSector({
        name: "fishery", goodsRequirements: { machinery: 3, buildings: 3 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { basicFood: 80, agriculturalGoods: 30 }
    }),
    foodFactory: generateIndustrialSector({
        name: "foodFactory",
        goodsRequirements: { agriculturalGoods: 22, machinery: 8, buildings: 6 },
        workerRequirement: { worker: 5, clerks: 1 },
        goodsProduction: { food: 150, }
    }),
    luxuryFood: generateIndustrialSector({
        name: "luxuryFood",
        goodsRequirements: { machinery: 6, electricity: 18, buildings: 8 },
        workerRequirement: { worker: 10, clerks: 1 },
        goodsProduction: { luxuryFood: 22 }
    }),
    waterTreatment: generateIndustrialSector({
        name: "waterTreatment", goodsRequirements: { electricity: 8, machinery: 6, buildings: 6 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { water: 220 }
    }),
    powerPlant: generateIndustrialSector({
        name: "powerPlant", goodsRequirements: { oil: 14, machinery: 6, buildings: 10 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { electricity: 220 }
    }),
    metalFactory: generateIndustrialSector({
        name: "metalFactory", goodsRequirements: { metals: 12, machinery: 8, electricity: 20, buildings: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { metals: 55 }
    }),
    lumberMill: generateIndustrialSector({
        name: "lumberMill", goodsRequirements: { wood: 35, machinery: 6, buildings: 6 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { furniture: 40, lumber: 40 }
    }),
    machineryFactory: generateIndustrialSector({
        name: "machineryFactory", goodsRequirements: { metals: 12, electricity: 18, buildings: 8 }, workerRequirement: { worker: 1, clerks: 1 }, goodsProduction: { machinery: 14 }
    }),
    medicineFactory: generateIndustrialSector({
        name: "medicineFactory", goodsRequirements: { chemicals: 6, machinery: 6, electricity: 14, buildings: 8 }, workerRequirement: { worker: 10, clerks: 1, scientist: 1 }, goodsProduction: { medicine: 10 }
    }),
    consumerFactory: generateIndustrialSector({
        name: "consumerFactory", goodsRequirements: { furniture: 12, chemicals: 8, machinery: 8, electricity: 22, buildings: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { consumerGoods: 18 }
    }),
    furnitureFactory: generateIndustrialSector({
        name: "furnitureFactory", goodsRequirements: { lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { luxuryFurniture: 6 }
    }),
    ammunitionFactory: generateIndustrialSector({
        name: "ammunitionFactory", goodsRequirements: { metals: 12, chemicals: 8, machinery: 10, electricity: 22, buildings: 10 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { ammunition: 35 }
    }),
    weaponFactory: generateIndustrialSector({
        name: "weaponFactory", goodsRequirements: { metals: 14, machinery: 8, electricity: 26, buildings: 10 }, workerRequirement: { worker: 10 }, goodsProduction: { weapons: 7 }
    }),
    nuclearWeaponFactory: generateIndustrialSector({
        name: "nuclearWeaponFactory", goodsRequirements: { uranium: 5, machinery: 8, electricity: 28, buildings: 12 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { nuclearWeapons: 1 }
    }),
    ordnanceFactory: generateIndustrialSector({
        name: "ordnanceFactory", goodsRequirements: { metals: 14, chemicals: 8, machinery: 8, ammunition: 10, electricity: 24, buildings: 10 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { ordnance: 7 }
    }),
    spaceport: generateIndustrialSector({
        name: "spaceport", goodsRequirements: { machinery: 8, furniture: 10, electricity: 25, buildings: 15 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { spaceTransport: 4 }
    }),
    spaceShipyard: generateIndustrialSector({
        name: "spaceShipyard", goodsRequirements: { metals: 18, machinery: 14, electricity: 28, buildings: 15 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { spaceTransport: 7 }
    }),
    orbitalFactory: generateIndustrialSector({
        name: "orbitalFactory", goodsRequirements: { machinery: 12, electricity: 28, tylium: 5, buildings: 15 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { tylium: 10 }
    }),
    construction: generateIndustrialSector({
        name: "construction", goodsRequirements: { lumber: 15, metals: 12, chemicals: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { buildings: 40 }
    }),
    services: generateIndustrialSector({
        name: "services", goodsRequirements: { electricity: 22, furniture: 8, buildings: 5 }, workerRequirement: { serviceWorker: 1 }, goodsProduction: { services: 65 }
    }),
    tourism: generateIndustrialSector({
        name: "tourism", goodsRequirements: { services: 12, luxuryFood: 6, luxuryFurniture: 8, buildings: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { tourism: 12 }
    }),
    education: generateIndustrialSector({
        name: "education", goodsRequirements: { electricity: 14, services: 8, buildings: 8 }, workerRequirement: { teacher: 1, clerks: 1, worker: 1 }, goodsProduction: { dividents: 8 }
    }),
    healthcare: generateIndustrialSector({
        name: "healthcare", goodsRequirements: { medicine: 3, electricity: 8, buildings: 8 }, workerRequirement: { healtcarePersonal: 5, clerks: 1, worker: 1 }, goodsProduction: { healthcare: 40 }
    }),
    environmentControl: generateIndustrialSector({
        name: "environmentControl", goodsRequirements: { electricity: 14, medicine: 3, chemicals: 3, buildings: 6 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { environmentFactor: 8 }
    }),
    chemical: generateIndustrialSector({
        name: "chemical", goodsRequirements: { oil: 12, electricity: 15, buildings: 6 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { chemicals: 40 }
    }),
    bank: generateIndustrialSector({
        name: "bank", goodsRequirements: { electricity: 14, services: 8, buildings: 6 }, workerRequirement: { worker: 1, clerks: 3 }, goodsProduction: { money: 35 }
    }),
    religion: generateIndustrialSector({
        name: "religion", goodsRequirements: { services: 12, money: 15, buildings: 6 }, workerRequirement: { clergy: 6, clerks: 3, worker: 1 }, goodsProduction: { faith: 200 }
    }),
    lawEnforcement: generateIndustrialSector({
        name: "lawEnforcement", goodsRequirements: { electricity: 12, weapons: 3, buildings: 8 }, workerRequirement: { policeMen: 5, worker: 1, clerks: 1 }, goodsProduction: { lawEnforcement: 35 }
    }),
    nuclearSector: generateIndustrialSector({
        name: "nuclearSector", goodsRequirements: { uranium: 8, machinery: 8, electricity: 10, buildings: 12 }, workerRequirement: { scientist: 2, worker: 8, clerks: 2 }, goodsProduction: { electricity: 320 }
    }),
});
