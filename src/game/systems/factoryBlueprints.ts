import { generateIndustrialSector } from "./generateIndustrialSector";

export const industryReducers = Object.entries({
    mine: generateIndustrialSector({
        name: "mine", goodsRequirements: {}, workerRequirement: { miner: 10, clerks: 1 }, goodsProduction: { metals: 70, uranium: 6, tylium: 2 }
    }),
    oilRig: generateIndustrialSector({
        name: "oilRig", goodsRequirements: {}, workerRequirement: { worker: 20, clerks: 5 }, goodsProduction: { oil: 150 }
    }),
    forestry: generateIndustrialSector({
        name: "forestry", goodsRequirements: {}, workerRequirement: { worker: 3, clergy: 1 }, goodsProduction: { wood: 180 }
    }),
    farm: generateIndustrialSector({
        name: "farm", goodsRequirements: {}, workerRequirement: { farmer: 5, clerks: 1 }, goodsProduction: { agriculturalGoods: 100, basicFood: 60 }
    }),
    foodFactory: generateIndustrialSector({
        name: "foodFactory",
        goodsRequirements: { agriculturalGoods: 22 },
        workerRequirement: { worker: 5, clerks: 1 },
        goodsProduction: { food: 45, luxuryFood: 6 }
    }),
    waterTreatment: generateIndustrialSector({
        name: "waterTreatment", goodsRequirements: { electricity: 8 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { water: 220 }
    }),
    powerPlant: generateIndustrialSector({
        name: "powerPlant", goodsRequirements: { oil: 14 }, workerRequirement: { worker: 5, clerks: 1 }, goodsProduction: { electricity: 220 }
    }),
    metalFactory: generateIndustrialSector({
        name: "metalFactory", goodsRequirements: { electricity: 18 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { metals: 55 }
    }),
    lumberMill: generateIndustrialSector({
        name: "lumberMill", goodsRequirements: { wood: 35 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { furniture: 40 }
    }),
    machineryFactory: generateIndustrialSector({
        name: "machineryFactory", goodsRequirements: { metals: 12, electricity: 18 }, workerRequirement: { worker: 1, clerks: 1 }, goodsProduction: { machinery: 14 }
    }),
    medicineFactory: generateIndustrialSector({
        name: "medicineFactory", goodsRequirements: { machinery: 6, electricity: 14 }, workerRequirement: { worker: 10, clerks: 1, scientist: 1 }, goodsProduction: { medicine: 10 }
    }),
    consumerFactory: generateIndustrialSector({
        name: "consumerFactory", goodsRequirements: { furniture: 12, machinery: 8, electricity: 22 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { consumerGoods: 18 }
    }),
    furnitureFactory: generateIndustrialSector({
        name: "furnitureFactory", goodsRequirements: { furniture: 10, electricity: 18 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { luxuryFurniture: 6 }
    }),
    ammunitionFactory: generateIndustrialSector({
        name: "ammunitionFactory", goodsRequirements: { metals: 12, electricity: 20 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { ammunition: 35 }
    }),
    weaponFactory: generateIndustrialSector({
        name: "weaponFactory", goodsRequirements: { metals: 14, machinery: 8, electricity: 24 }, workerRequirement: { worker: 10 }, goodsProduction: { weapons: 7 }
    }),
    nuclearWeaponFactory: generateIndustrialSector({
        name: "nuclearWeaponFactory", goodsRequirements: { uranium: 5, machinery: 8, electricity: 28 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { nuclearWeapons: 1 }
    }),
    ordnanceFactory: generateIndustrialSector({
        name: "ordnanceFactory", goodsRequirements: { metals: 14, ammunition: 10, electricity: 24 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { ordnance: 7 }
    }),
    spaceport: generateIndustrialSector({
        name: "spaceport", goodsRequirements: { machinery: 12, furniture: 10, electricity: 25 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { spaceTransport: 4 }
    }),
    spaceShipyard: generateIndustrialSector({
        name: "spaceShipyard", goodsRequirements: { metals: 18, machinery: 14, electricity: 28 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { spaceTransport: 7 }
    }),
    orbitalFactory: generateIndustrialSector({
        name: "orbitalFactory", goodsRequirements: { machinery: 12, electricity: 28, tylium: 5 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { tylium: 10 }
    }),
    construction: generateIndustrialSector({
        name: "construction", goodsRequirements: { metals: 12, wood: 15, electricity: 22 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { money: 40 }
    }),
    services: generateIndustrialSector({
        name: "services", goodsRequirements: { electricity: 22, furniture: 8 }, workerRequirement: { serviceWorker: 1 }, goodsProduction: { services: 65 }
    }),
    tourism: generateIndustrialSector({
        name: "tourism", goodsRequirements: { services: 12, luxuryFood: 6, luxuryFurniture: 8 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { tourism: 12 }
    }),
    education: generateIndustrialSector({
        name: "education", goodsRequirements: { electricity: 14, services: 8 }, workerRequirement: { teacher: 1, clerks: 1, worker: 1 }, goodsProduction: { dividents: 8 }
    }),
    healthcare: generateIndustrialSector({
        name: "healthcare", goodsRequirements: { medicine: 3, electricity: 8 }, workerRequirement: { healtcarePersonal: 5, clerks: 1, worker: 1 }, goodsProduction: { healthcare: 40 }
    }),
    environmentControl: generateIndustrialSector({
        name: "environmentControl", goodsRequirements: { electricity: 14, medicine: 3 }, workerRequirement: { worker: 10, clerks: 1 }, goodsProduction: { environmentFactor: 8 }
    }),
    bank: generateIndustrialSector({
        name: "bank", goodsRequirements: { electricity: 14, services: 8 }, workerRequirement: { worker: 1, clerks: 3 }, goodsProduction: { money: 35 }
    }),
    religion: generateIndustrialSector({
        name: "religion", goodsRequirements: { services: 12, money: 15 }, workerRequirement: { clergy: 6, clerks: 3, worker: 1 }, goodsProduction: { faith: 60 }
    }),
    lawEnforcement: generateIndustrialSector({
        name: "lawEnforcement", goodsRequirements: { electricity: 12, weapons: 3 }, workerRequirement: { policeMen: 5, worker: 1, clerks: 1 }, goodsProduction: { lawEnforcement: 35 }
    }),
});
