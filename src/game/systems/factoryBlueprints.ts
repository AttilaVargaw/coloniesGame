import { generateIndustrialSector } from "./generateIndustrialSector";

export const industryReducers = Object.entries({
    agriculturalFactory: generateIndustrialSector({
        name: "agriculturalFactory",
        goodsRequirements: {},
        workerRequirement: { worker: 1 },
        goodsProduction: { agriculturalGoods: 100_000, basicFood: 100_000, food: 100_000 }
    }),
    ammunitionFactory: generateIndustrialSector({ name: "ammunitionFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { ammunition: 1 } }),
    buildingSector: generateIndustrialSector({ name: "buildingSector", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    consumerFactory: generateIndustrialSector({
        name: "consumerFactory",
        goodsRequirements: {},
        workerRequirement: { worker: 1 },
        goodsProduction: { consumerGoods: 100_000 }
    }),
    electricityFactory: generateIndustrialSector({ name: "electricityFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { electricity: 1 } }),
    foodFactory: generateIndustrialSector({
        name: "foodFactory",
        goodsRequirements: {},
        workerRequirement: { worker: 1 },
        goodsProduction: { basicFood: 100_000_000, luxuryFood: 10_000, food: 100_000 }
    }),
    furnitureFactory: generateIndustrialSector({
        name: "furnitureFactory",
        goodsRequirements: {},
        workerRequirement: { worker: 1 },
        goodsProduction: { furniture: 100_000, luxuryFurniture: 10_000 }
    }),
    machineryFactory: generateIndustrialSector({ name: "machineryFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { machinery: 1 } }),
    medicineFactory: generateIndustrialSector({ name: "medicineFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { medicine: 1 } }),
    metalFactory: generateIndustrialSector({ name: "metalFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { metals: 1 } }),
    nuclearWeaponFactory: generateIndustrialSector({ name: "nuclearWeaponFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { nuclearWeapons: 1 } }),
    environmentFactor: generateIndustrialSector({ name: "environmentFactor", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { environmentFactor: 1 } }),
    forestry: generateIndustrialSector({ name: "forestry", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { wood: 1 } }),
    oilFactory: generateIndustrialSector({ name: "oilFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { oil: 1 } }),
    oilRig: generateIndustrialSector({ name: "oilRig", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { oil: 1 } }),
    orbitalBuildingSector: generateIndustrialSector({ name: "orbitalBuildingSector", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    orbitalFactory: generateIndustrialSector({ name: "orbitalFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    spaceport: generateIndustrialSector({ name: "spaceport", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { furniture: 1 } }),
    spaceTransport: generateIndustrialSector({ name: "spaceTransport", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { spaceTransport: 1 } }),
    uraniumFactory: generateIndustrialSector({ name: "uraniumFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { uranium: 1 } }),
    weaponFactory: generateIndustrialSector({ name: "weaponFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { weapons: 1 } }),
    services: generateIndustrialSector({ name: "services", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { services: 1 } }),
    tourism: generateIndustrialSector({ name: "tourism", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { tourism: 1 } }),
    waterFactory: generateIndustrialSector({ name: "waterFactory", goodsRequirements: {}, workerRequirement: { worker: 1 }, goodsProduction: { water: 1 } }),
});
