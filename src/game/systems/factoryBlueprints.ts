// import { IndustryReducerReturn, type IndustryReducer } from "./";
// import type { IndustrialSectors } from "../components/Factories";
import { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

type FactoryBlueprint = {
    name: string,
    goodsRequirements: Partial<Goods>,
    workerRequirement: Partial<Record<keyof Population, number>>,
    goodsProduction: Partial<Goods>,
    efficiencyBonus?: number
    outputLevelModifier?: (lvl: number) => number
    capitalGoods?: Partial<Record<keyof Goods, number>>
    capitalEfficiency?: number
    capitalEfficiencyDecay?: number
    nonEssentialGoods?: Set<keyof Goods>
    optionalGoods?: (keyof Goods)[]
}

const workerReqStandard = { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 } as const
const workerReqTechnical = { worker: 84, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1 } as const
const workerReqMaritime = { worker: 89, engineer: 5, clerks: 5, healtcarePersonal: 1 } as const
const goodsReqHeavyVehicle = { environmentFactor: 2, paper: 1, machinery: 8, oil: 6, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10 } as const
const goodsReqSpaceShipyard = { paper: 1, environmentFactor: 2, vehicles: 0.1, metals: 16, machinery: 14, electricity: 28, buildings: 8, governance: 2, electronics: 1 } as const
const usualNonEssentialGoods: ReadonlyArray<keyof Goods> = ["electronics", "governance", "paper", "water", "vehicles", "electricity", "services", "environmentFactor"] as const

export const industrySectorBlueprints = new Map<keyof IndustrialSectors, FactoryBlueprint>([
    ["mine", {
        name: "mine",
        goodsRequirements: {
            paper: 1,
            machinery: 8, electricity: 5, buildings: 4, governance: 2, electronics: 1, vehicles: 0.1, environmentFactor: 2
        },
        workerRequirement: workerReqStandard,
        goodsProduction: { ore: 100, waste: 2 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set([]),
    }],
    ["oilRig", ({
        name: "oilRig", goodsRequirements: {
            paper: 1, environmentFactor: 2, vehicles: 0.1, machinery: 8, electricity: 1, buildings: 4, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { oil: 80, waste: 2 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),

    })],
    ["forestry", ({
        name: "forestry", goodsRequirements: {
            paper: 1, vehicles: 0.1, ammunition: 1, chemicals: 3, buildings: 3, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { wood: 180, agriculturalGoods: 20, environmentFactor: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["farm", ({
        name: "farm", goodsRequirements: {
            paper: 1, environmentFactor: 2, vehicles: 0.1, machinery: 5, water: 4, chemicals: 8, buildings: 4, governance: 2, electronics: 1
        }, workerRequirement: {
            farmer: 90, clerks: 5, engineer: 5, healtcarePersonal: 1
        }, goodsProduction: { agriculturalGoods: 100, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["chemicals", "electronics", "paper"]),
    })],
    ["fishery", {
        name: "fishery", goodsRequirements: {
            paper: 1,
            vehicles: 0.05,
            machinery: 3,
            buildings: 3,
            governance: 2,
            electronics: 1,
            ships: 0.5,
            environmentFactor: 2,
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { agriculturalGoods: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"]),
    }],
    ["foodFactory", ({
        name: "foodFactory",
        goodsRequirements: { paper: 1, environmentFactor: 2, vehicles: 0.1, agriculturalGoods: 20, machinery: 8, buildings: 3, governance: 2, electronics: 1, retail: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { food: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["luxuryFood", ({
        name: "luxuryFood",
        goodsRequirements: { paper: 1, environmentFactor: 2, vehicles: 0.1, machinery: 6, electricity: 18, buildings: 3, governance: 2, electronics: 1, retail: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { luxuryFood: 22, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["waterTreatment", ({
        name: "waterTreatment", goodsRequirements: {
            paper: 1, environmentFactor: 2, vehicles: 0.1, electricity: 20, machinery: 12, chemicals: 8, buildings: 6, governance: 2, electronics: 1
        },
        workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { water: 1500 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["powerPlant", ({
        name: "powerPlant", goodsRequirements: {
            environmentFactor: 2,
            paper: 1,
            vehicles: 0.1,
            oil: 14, machinery: 6,
            buildings: 3,
            governance: 2,
            electronics: 1
        },
        workerRequirement: {
            worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1
        }, goodsProduction: { electricity: 220, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["metalFactory", ({
        name: "metalFactory", goodsRequirements: {
            environmentFactor: 3,
            vehicles: 0.1,
            paper: 1,
            machinery: 8,
            electricity: 20,
            ore: 100,
            buildings: 3,
            governance: 2,
            electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { metals: 60, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(["paper", "governance"]),
    })],
    ["lumberMill", ({
        name: "lumberMill", goodsRequirements: {
            environmentFactor: 2,
            vehicles: 0.1,
            wood: 30,
            machinery: 6,
            paper: 1,
            buildings: 3,
            governance: 2,
            electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { lumber: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.04 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["machineryFactory", ({
        name: "machineryFactory", goodsRequirements: {
            environmentFactor: 2,
            paper: 1,
            vehicles: 0.1, metals: 8, electricity: 15, buildings: 3, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { machinery: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.1, metals: 0.05 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["medicineFactory", ({
        name: "medicineFactory", goodsRequirements: {
            environmentFactor: 2,
            vehicles: 0.1, paper: 1, chemicals: 5, machinery: 6, electricity: 14, buildings: 3, governance: 2, electronics: 1
        }, workerRequirement: { worker: 85, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { medicine: 35 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["consumerFactory", ({
        name: "consumerFactory", goodsRequirements: {
            environmentFactor: 2,
            vehicles: 0.1, paper: 1, chemicals: 6, machinery: 8, electricity: 22, buildings: 3, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { consumerGoods: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["luxuryFurnitureFactory", ({
        name: "luxuryFurnitureFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 50, vehicles: 0.1, lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { luxuryFurniture: 14 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["furnitureFactory", ({
        name: "furnitureFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 20, vehicles: 0.1, lumber: 10, chemicals: 4, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { furniture: 50 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["ammunitionFactory", ({
        name: "ammunitionFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 10, vehicles: 0.1, metals: 8, chemicals: 5, machinery: 8, electricity: 20, buildings: 8, governance: 2, electronics: 1 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { ammunition: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["weaponFactory", ({
        name: "weaponFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 10, vehicles: 0.1, metals: 10, machinery: 6, electricity: 20, buildings: 3, governance: 2, electronics: 1 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { weapons: 20 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["nuclearWeaponFactory", ({
        name: "nuclearWeaponFactory", goodsRequirements: { paper: 1, environmentFactor: 2, vehicles: 0.1, uranium: 5, machinery: 8, electricity: 28, buildings: 12, governance: 2, electronics: 1 }, workerRequirement: { worker: 85, clerks: 5, engineer: 5, scientist: 5, healtcarePersonal: 1 }, goodsProduction: { nuclearWeapons: 5 },
        efficiencyBonus: 0.01
    })],
    ["ordnanceFactory", ({
        name: "ordnanceFactory", goodsRequirements: { paper: 1, environmentFactor: 2, vehicles: 0.1, metals: 12, chemicals: 6, machinery: 8, ammunition: 10, electricity: 24, buildings: 10, governance: 2, electronics: 1 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { ordnance: 30 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["spaceInfrastructure", ({
        name: "spaceport", goodsRequirements: {
            vehicles: 0.1,
            machinery: 8,
            furniture: 10,
            electricity: 25,
            buildings: 8,
            governance: 2,
            paper: 1,
            electronics: 1,
            environmentFactor: 2,
        }, workerRequirement: { worker: 79, clerks: 5, engineer: 5, scientist: 10, healtcarePersonal: 1 }, goodsProduction: { spaceTransport: 5 },
        efficiencyBonus: 0.01
    })],
    ["spaceShips", ({
        name: "spaceShipyard", goodsRequirements: goodsReqSpaceShipyard,
        workerRequirement: workerReqStandard,
        goodsProduction: { spaceTransport: 8 },
        efficiencyBonus: 0.01
    })],
    ["luxurySpaceShips", ({
        name: "spaceShipyard", goodsRequirements: goodsReqSpaceShipyard,
        workerRequirement: workerReqStandard,
        goodsProduction: { spaceTransport: 8 },
        efficiencyBonus: 0.01
    })],
    ["orbitalFactory", ({
        name: "orbitalFactory", goodsRequirements: {
            paper: 1, environmentFactor: 2, vehicles: 0.1, machinery: 12, electricity: 28, tylium: 5, buildings: 8, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { tylium: 12 },
        efficiencyBonus: 0.01
    })],
    ["construction", ({
        name: "construction", goodsRequirements: {
            vehicles: 0.1,
            lumber: 8,
            metals: 6,
            chemicals: 4,
            paper: 1,
            electricity: 4,
            governance: 2,
            electronics: 1,
            constructionMaterials: 10,
            retail: 20,
            environmentFactor: 3,
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { buildings: 80 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, constructionMaterials: 0.03 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.08,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["services", ({
        name: "services", goodsRequirements: {
            paper: 1, environmentFactor: 1, retail: 50, vehicles: 0.1, electricity: 22, furniture: 8, buildings: 3, governance: 2, electronics: 1
        }, workerRequirement: { healtcarePersonal: 1, serviceWorker: 94, clergy: 5 }, goodsProduction: { services: 65 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["tourism", ({
        name: "tourism", goodsRequirements: {
            paper: 1, environmentFactor: 3, retail: 50, vehicles: 0.1, services: 12, luxuryFood: 6, luxuryFurniture: 8, buildings: 8, governance: 2, electronics: 1
        }, workerRequirement: { worker: 20, clerks: 5, serviceWorker: 70, healtcarePersonal: 5 }, goodsProduction: { tourism: 12 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["education", ({
        name: "education", goodsRequirements: {
            vehicles: 0.1, electricity: 10, services: 6, buildings: 2, governance: 2, electronics: 1, paper: 2, itServices: 1
        }, workerRequirement: { teacher: 89, clerks: 10, worker: 5, healtcarePersonal: 1 }, goodsProduction: { education: 300 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["healthcare", ({
        name: "healthcare", goodsRequirements: {
            paper: 1, retail: 20, vehicles: 0.1, medicine: 3, electricity: 8, buildings: 2, governance: 2, electronics: 1, itServices: 1
        }, workerRequirement: { healtcarePersonal: 90, clerks: 5, worker: 5 }, goodsProduction: { healthcare: 200 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["environmentControl", ({
        name: "environmentControl",
        goodsRequirements: {
            paper: 1, vehicles: 0.1, electricity: 14, medicine: 3, chemicals: 3, buildings: 6, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { environmentFactor: 30 },
        efficiencyBonus: 0.01
    })],
    ["chemical", ({
        name: "chemical", goodsRequirements: {
            paper: 1, environmentFactor: 3, vehicles: 0.1, oil: 8, electricity: 15, buildings: 2, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { chemicals: 70, waste: 4 },
        efficiencyBonus: 0.01,
    })],
    ["bank", ({
        name: "bank", goodsRequirements: {
            paper: 1, vehicles: 0.1, electricity: 14, services: 8, buildings: 2, governance: 2, electronics: 1, itServices: 1
        }, workerRequirement: { worker: 19, clerks: 80, healtcarePersonal: 1 }, goodsProduction: { monetaryServices: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["religion", ({
        name: "religion",
        goodsRequirements: {
            paper: 1, vehicles: 0.1, services: 12, buildings: 2, governance: 2, electronics: 1
        }, workerRequirement: { clergy: 89, clerks: 5, worker: 5, healtcarePersonal: 1 }, goodsProduction: { faith: 200 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["lawEnforcement", ({
        name: "lawEnforcement",
        goodsRequirements: { paper: 1, vehicles: 0.1, electricity: 12, weapons: 3, buildings: 2, governance: 2, electronics: 1, itServices: 1 },
        workerRequirement: { policeMen: 89, worker: 5, clerks: 5, healtcarePersonal: 1 }, goodsProduction: { lawEnforcement: 80 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["nuclearSector", ({
        name: "nuclearSector", goodsRequirements:
            { vehicles: 0.1, ore: 20, paper: 1, machinery: 8, electricity: 10, buildings: 4, governance: 2, electronics: 1, environmentFactor: 1 },
        workerRequirement: { scientist: 5, worker: 69, clerks: 5, engineer: 20, healtcarePersonal: 1 },
        goodsProduction: { uranium: 10, waste: 3 },
        efficiencyBonus: 0.01
    })],
    ["nuclearEnergy", {
        name: "nuclearSector", goodsRequirements:
            { vehicles: 0.1, ore: 20, paper: 1, machinery: 8, electricity: 10, buildings: 4, governance: 2, electronics: 1, environmentFactor: 2, uranium: 20 },
        workerRequirement: {
            scientist: 5, worker: 69, clerks: 5, engineer: 20, healtcarePersonal: 1
        },
        goodsProduction: { waste: 3 },
        efficiencyBonus: 0.01
    }],
    ["greenEnergy", ({
        name: "greenEnergy", goodsRequirements: {
            paper: 1, vehicles: 0.1, machinery: 6, buildings: 8, governance: 2, electronics: 1
        }, workerRequirement: {
            worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1
        }, goodsProduction: { electricity: 160 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["alternativeMedicine", ({
        name: "alternativeMedicine", goodsRequirements: {
            paper: 1, environmentFactor: 1, retail: 20, vehicles: 0.1, agriculturalGoods: 25, buildings: 1, governance: 2, electronics: 1
        }, workerRequirement: { worker: 94, clerks: 5, healtcarePersonal: 1 }, goodsProduction: { healthcare: 120 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["recycling", ({
        name: "recycling",
        goodsRequirements: { waste: 20, electricity: 4, paper: 1, buildings: 3, governance: 2, electronics: 1, vehicles: 0.1, environmentFactor: 2, },
        workerRequirement: workerReqStandard,
        goodsProduction: { metals: 6, lumber: 4, water: 30, chemicals: 2, oil: 4 },
        //outputLevelModifier: (level) => level * (1 + 0.08 * (level - 1))
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["government", ({
        name: "government",
        goodsRequirements: { vehicles: 0.1, paper: 1, services: 5, buildings: 2, electronics: 1, environmentFactor: 1, itServices: 1 },
        workerRequirement: { clerks: 79, worker: 20, healtcarePersonal: 1 },
        goodsProduction: { governance: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "itServices"])
    })],
    ["automotive", ({
        name: "automotive",
        goodsRequirements: {
            environmentFactor: 3,
            paper: 1,
            retail: 20,
            machinery: 8,
            oil: 6,
            electricity: 15,
            buildings: 3,
            water: 2,
            governance: 2,
            electronics: 1,
            metals: 10
        },
        workerRequirement: { worker: 89, scientist: 5, clerks: 5, healtcarePersonal: 1 },
        goodsProduction: { vehicles: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["automotiveInfrastructure", ({
        name: "automotiveInfrastructure",
        goodsRequirements: {
            environmentFactor: 3, paper: 1, machinery: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, electronics: 1, metals: 1, vehicles: 10
        },
        workerRequirement: {
            worker: 84, clerks: 5, serviceWorker: 5, engineer: 5, healtcarePersonal: 1
        },
        goodsProduction: { automotiveMobility: 15, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["electronics", ({
        name: "electronics",
        goodsRequirements: {
            environmentFactor: 2, paper: 1, retail: 20, vehicles: 0.1, machinery: 6, chemicals: 5, electricity: 18, buildings: 3, governance: 2
        },
        workerRequirement: {
            worker: 84, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1
        },
        goodsProduction: { electronics: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, electronics: 0.05 },
        capitalEfficiency: 0.0012,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["railroadVehicles", ({
        name: "railroadVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { railroadVehicles: 15, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["militaryVehicles", ({
        name: "militaryVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { militaryVehicles: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["railroadInfrastructure", ({
        name: "railroadInfrastructure",
        goodsRequirements: {
            retail: 1, environmentFactor: 2,
            paper: 1, machinery: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, electronics: 1, metals: 1, railroadVehicles: 10
        },
        workerRequirement: { worker: 84, clerks: 5, serviceWorker: 5, engineer: 5, healtcarePersonal: 1 },
        goodsProduction: { railroadMobility: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["ships", ({
        name: "ships",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { ships: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["shipInfrastructure", ({
        name: "shipInfrastructure",
        goodsRequirements: {
            retail: 1, environmentFactor: 2, paper: 1,
            machinery: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, electronics: 1, metals: 1, ships: 10
        },
        workerRequirement: workerReqMaritime,
        goodsProduction: { shipMobility: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["luxuryShips", ({
        name: "luxuryShips",
        goodsRequirements: {
            environmentFactor: 2, paper: 1, retail: 20,
            machinery: 8, oil: 10, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, metals: 10
        },
        workerRequirement: workerReqMaritime,
        goodsProduction: { luxuryShips: 15, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["aircraft", ({
        name: "aircraft",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { aircraft: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["aircraftInfrastructure", ({
        name: "aircraftInfrastructure",
        goodsRequirements: { retail: 1, environmentFactor: 2, paper: 1, machinery: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, electronics: 1, metals: 1, aircraft: 10 },
        workerRequirement: { worker: 84, engineer: 5, clerks: 5, serviceWorker: 5, healtcarePersonal: 1 },
        goodsProduction: { airMobility: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["clothing", ({
        name: "clothing",
        goodsRequirements: { environmentFactor: 3, paper: 1, retail: 50, machinery: 8, chemicals: 2, electricity: 15, buildings: 3, water: 2, governance: 2, electronics: 1, agriculturalGoods: 10 },
        workerRequirement: workerReqStandard,
        goodsProduction: { clothing: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["constructionMaterials", ({
        name: "constructionMaterials",
        goodsRequirements: { environmentFactor: 3, paper: 2, machinery: 8, oil: 2, electricity: 15, buildings: 3, water: 20, governance: 2, electronics: 1, lumber: 10, metals: 10 },
        workerRequirement: workerReqMaritime,
        goodsProduction: { constructionMaterials: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["paperFactory", ({
        name: "paperFactory",
        goodsRequirements: { environmentFactor: 3, vehicles: 0.1, wood: 20, chemicals: 8, machinery: 6, electricity: 16, buildings: 3, governance: 2, electronics: 1 },
        workerRequirement: workerReqStandard,
        goodsProduction: { paper: 180 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["postalServices", ({
        name: "postalServices",
        goodsRequirements: { environmentFactor: 2, retail: 50, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10, aircraft: 1, railroadVehicles: 1 },
        workerRequirement: { worker: 79, clerks: 5, serviceWorker: 15, healtcarePersonal: 1 },
        goodsProduction: { post: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["entertainmentIndustry", ({
        name: "entertainmentIndustry",
        goodsRequirements: { environmentFactor: 2, retail: 50, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 49, clerks: 5, engineer: 5, serviceWorker: 40, healtcarePersonal: 1 },
        goodsProduction: { entertainment: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(usualNonEssentialGoods)
    })],
    ["informationTechnology", ({
        name: "informationTechnology",
        goodsRequirements: { retail: 10, environmentFactor: 2, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: { worker: 39, clerks: 5, engineer: 45, serviceWorker: 10, healtcarePersonal: 1 },
        goodsProduction: { itServices: 15, waste: 1 },
        efficiencyBonus: 0.01, nonEssentialGoods: new Set(["paper", "governance"])
    })],
    ["alcoholicDrinkIndustry", ({
        name: "alcoholicDrinkIndustry",
        goodsRequirements: { environmentFactor: 2, retail: 20, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: workerReqStandard,
        goodsProduction: { alcoholDrinks: 15, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"])
    })],
    ["stimulantDrinkIndustry", ({
        name: "stimulantDrinkIndustry",
        goodsRequirements: { environmentFactor: 2, retail: 20, electricity: 15, buildings: 3, governance: 2, electronics: 1, paper: 10 },
        workerRequirement: workerReqStandard,
        goodsProduction: { stimulantDrinks: 15, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"])
    })],
    ["retail", ({
        name: "retail",
        goodsRequirements: { environmentFactor: 2, electricity: 15, buildings: 3, governance: 2, paper: 10 },
        workerRequirement: { worker: 34, clerks: 5, serviceWorker: 60, healtcarePersonal: 1 },
        goodsProduction: { waste: 1, retail: 100 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"])
    })],
    ["defense", ({
        name: "retail",
        goodsRequirements: {
            militaryVehicles: 10,
            electricity: 15,
            buildings: 3,
            governance: 2,
            electronics: 10,
            paper: 10,
            ammunition: 100,
            weapons: 100,
            ordnance: 50
        },
        workerRequirement: { worker: 85, clerks: 5, healtcarePersonal: 5, engineer: 5 },
        goodsProduction: { defense: 150, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"])
    }),],
    ["spaceGoodsTransport", {
        name: "spaceGoodsTransport",
        goodsRequirements: {
            environmentFactor: 2,
            electricity: 15,
            buildings: 3,
            governance: 2,
            electronics: 1,
            paper: 10
        },
        workerRequirement: {
            worker: 34,
            clerks: 5,
            serviceWorker: 60,
            healtcarePersonal: 1
        },
        goodsProduction: { waste: 1, retail: 100 },
        nonEssentialGoods: new Set(["paper", "governance"])
    }]
])

export function getSectorOutputLevel(name: keyof IndustrialSectors, level: number): number {
    const config = industrySectorBlueprints.get(name)

    if(!config) { return level; }

    if(config.outputLevelModifier) {
        return config.outputLevelModifier(level);
    }

    if(config.efficiencyBonus && config.efficiencyBonus > 0) {
        return level * (1 + config.efficiencyBonus * (level - 1));

    }
    return level;
}
