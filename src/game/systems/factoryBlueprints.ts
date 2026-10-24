// import { IndustryReducerReturn, type IndustryReducer } from "./";
// import type { IndustrialSectors } from "../components/Factories";
import { industrialSectors, IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

type FactoryBlueprint = {
    name: string,
    goodsRequirements: Partial<Goods>,
    workerRequirement: Partial<Record<keyof Population, number>>,
    goodsProduction: Partial<Goods>,
    efficiencyBonus?: number
    capitalGoods?: Partial<Record<keyof Goods, number>>
    capitalEfficiency?: number
    capitalEfficiencyDecay?: number
    nonEssentialGoods?: Set<keyof Goods>
    optionalGoods?: (keyof Goods)[]
    productionMethods?: Map<string, ProductionMethod>
    secondaryProductionMethod?: Map<string, ProductionMethod>
}

type ProductionMethod = {
    goodsRequirements?: Partial<Goods>,
    workerRequirement?: Partial<Record<keyof Population, number>>,
    goodsProduction?: Partial<Goods>,
    efficiencyBonus?: number
    capitalGoods?: Partial<Record<keyof Goods, number>>
    capitalEfficiency?: number
    capitalEfficiencyDecay?: number
    nonEssentialGoods?: Set<keyof Goods>
    optionalGoods?: (keyof Goods)[]
    desc?: string
    prerequisites?: Set<string>
}

const basicProductionMethod = {
    goodsRequirements: {},
    workerRequirement: {},
    goodsProduction: {},
    efficiencyBonus: 0,
    capitalGoods: {},
    capitalEfficiency: 0,
    capitalEfficiencyDecay: 0,
    nonEssentialGoods: new Set<keyof Goods>(),
    optionalGoods: [],
}

function createRobotized(descOverride?: string): ["robotized", ProductionMethod] {
    return ["robotized", {
        desc: descOverride || "The most complicated parts of the manufacturing processes are handled by highly specialized purpose built robots, the most complicated parts are still done by human workers",
        goodsRequirements: {},
        workerRequirement: {},
        goodsProduction: {},
        efficiencyBonus: 0,
        capitalGoods: {},
        capitalEfficiency: 0,
        capitalEfficiencyDecay: 0,
        nonEssentialGoods: new Set<keyof Goods>(),
        optionalGoods: [],
        prerequisites: new Set(["synteticLifeformUnit"])
    }]
}

function createFullyRobotized(descOverride?: string): ["robotized", ProductionMethod] {
    return ["robotized", {
        desc: descOverride || "Very high performance equipment handled by a robotic workforce, only few human supervisors are needed",
        goodsRequirements: {},
        workerRequirement: {},
        goodsProduction: {},
        efficiencyBonus: 0,
        capitalGoods: {},
        capitalEfficiency: 0,
        capitalEfficiencyDecay: 0,
        nonEssentialGoods: new Set<keyof Goods>(),
        optionalGoods: [],
        prerequisites: new Set(["synteticLifeformUnit"])
    }]
}

const workerReqStandard = { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 } as const
const workerReqTechnical = { worker: 84, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1 } as const
const workerReqMaritime = { worker: 89, engineer: 5, clerks: 5, healtcarePersonal: 1 } as const
const goodsReqHeavyVehicle = { environmentFactor: 2, paper: 1, electricity: 15, governance: 2, electronics: 1 } as const
const goodsReqSpaceShipyard = { paper: 1, environmentFactor: 2, electricity: 28, governance: 2, electronics: 1 } as const
const usualNonEssentialGoods = ["electronics", "governance", "paper", "water", "vehicles", "electricity", "services", "environmentFactor", "retail", "itServices"] as const

export const industrySectorBlueprints = new Map<keyof IndustrialSectors, FactoryBlueprint>([
    ["mine", {
        name: "mine",
        goodsRequirements: {
            paper: 1,
            electricity: 5, governance: 2, environmentFactor: 2
        },
        workerRequirement: workerReqStandard,
        goodsProduction: { ore: 150, waste: 2 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01, },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["dieselEngines", {
                desc: "Traditional machinery powered by onsite diesel motors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: [],
            }], ["nuclear", {
                desc: "Laser mining lasers powered by onsite nuclear reactors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: [],
            }],
            ["tylium", {
                desc: "Very high power mining lasers powered by onsite tylium reactors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: []
            }],
            ["robotized", {
                desc: "Very high power mining equipment handled by a robotic workforce, only few human supervisors are needed",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: []
            }]
        ])
    }],
    ["oilRig", ({
        name: "oilRig", goodsRequirements: {
            paper: 1, environmentFactor: 2, electricity: 1, governance: 2
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { oil: 150, waste: 2 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01, },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["dieselEngines", {
                desc: "Traditional machinery powered by onsite diesel motors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: [],
            }], ["nuclear", {
                desc: "Traditional machinery powered by onsite nuclear reactors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: [],
            }],
            ["tylium", {
                desc: "Traditional machinery powered by powered by onsite tylium reactors",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: []
            }],
            ["robotized", {
                desc: "Very high power mining equipment handled by a robotic workforce, only few human supervisors are needed",
                goodsRequirements: {},
                workerRequirement: {},
                goodsProduction: {},
                efficiencyBonus: 0,
                capitalGoods: {},
                capitalEfficiency: 0,
                capitalEfficiencyDecay: 0,
                nonEssentialGoods: new Set<keyof Goods>(),
                optionalGoods: []
            }]
        ])
    })],
    ["forestry", ({
        name: "forestry", goodsRequirements: {
            paper: 1, ammunition: 1, chemicals: 3, governance: 2
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 },
        goodsProduction: { wood: 180, meat: 20, environmentFactor: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.01, buildings: 0.01, vehicles: 0.01 },
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "ammunition", "chemicals"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional"
            }],
            ["Forest reserve", {

            }],
            ["Industrial wood plantations", {

            }],

        ])
    })],
    ["farm", ({
        name: "farm", goodsRequirements: {
            paper: 1, environmentFactor: 2, water: 4, chemicals: 8, governance: 2,
        }, workerRequirement: {
            farmer: 90, clerks: 5, engineer: 5, healtcarePersonal: 1
        }, goodsProduction: { agriculturalGoods: 100, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["chemicals", "electronics", "paper"]),
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01, vehicles: 0.1 },
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            ["hydroponics", {
                desc: "hydroponics",
            }]
        ])
    })],
    ["fishery", {
        name: "fishery", goodsRequirements: {
            paper: 1,
            governance: 2,
            environmentFactor: 2,
        },
        workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 },
        goodsProduction: { meat: 100 },
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01, ships: 0.01 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    }],
    ["foodFactory", ({
        name: "foodFactory",
        goodsRequirements: { paper: 1, environmentFactor: 2, agriculturalGoods: 20, governance: 2, retail: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { food: 150 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01 },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["meat", ({
        name: "meat",
        goodsRequirements: { paper: 1, environmentFactor: 2, electricity: 18, governance: 2, retail: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { meat: 100, },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01, },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["waterTreatment", ({
        name: "waterTreatment", goodsRequirements: {
            paper: 1, environmentFactor: 2, electricity: 20, chemicals: 8, governance: 2
        },
        workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { water: 1500 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "chemicals"]),
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01 },
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["powerPlant", ({
        name: "powerPlant", goodsRequirements: {
            environmentFactor: 2,
            paper: 1,
            oil: 14,
            governance: 2,
        },
        workerRequirement: {
            worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1
        }, goodsProduction: { electricity: 250, waste: 1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        capitalGoods: { machinery: 0.05, electronics: 0.01, buildings: 0.01 },
        productionMethods: new Map([
            ["Fossil", {
                desc: "Fossil",
            }]
        ])
    })],
    ["metalFactory", ({
        name: "metalFactory", goodsRequirements: {
            environmentFactor: 3,
            paper: 1,
            electricity: 20,
            ore: 100,
            governance: 2,
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { metals: 60, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["lumberMill", ({
        name: "lumberMill", goodsRequirements: {
            environmentFactor: 2,
            wood: 30,
            paper: 1,
            governance: 2,
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { lumber: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.04, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized()
        ])
    })],
    ["machineryFactory", ({
        name: "machineryFactory", goodsRequirements: {
            environmentFactor: 2,
            paper: 1,
            metals: 8,
            electricity: 15,
            governance: 2
        },
        workerRequirement: {
            worker: 89,
            clerks: 5,
            engineer: 5,
            healtcarePersonal: 1
        },
        goodsProduction: { machinery: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["medicineFactory", ({
        name: "medicineFactory", goodsRequirements: {
            environmentFactor: 2,
            paper: 1, chemicals: 5, electricity: 14, governance: 2, electronics: 1
        }, workerRequirement: { worker: 85, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { medicine: 35 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, buildings: 0.02 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["consumerFactory", ({
        name: "consumerFactory", goodsRequirements: {
            environmentFactor: 2,
            paper: 1, chemicals: 6, electricity: 22, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { consumerGoods: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, buildings: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["furnitureFactory", ({
        name: "furnitureFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 20, lumber: 10, chemicals: 4, electricity: 20, governance: 2 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { furniture: 50 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["ammunitionFactory", ({
        name: "ammunitionFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 10, chemicals: 5, electricity: 20, governance: 2 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { ammunition: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["weaponFactory", ({
        name: "weaponFactory", goodsRequirements: { paper: 1, environmentFactor: 2, retail: 10, electricity: 20, governance: 2 }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { weapons: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, metals: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["spaceInfrastructure", ({
        name: "spaceport", goodsRequirements: {
            electricity: 25,
            governance: 2,
            paper: 1,
            environmentFactor: 2,
        }, workerRequirement: { worker: 79, clerks: 5, engineer: 5, scientist: 10, healtcarePersonal: 1 }, goodsProduction: { spaceTransport: 5 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, electronics: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("Space infrastructure handled by universal robots")
        ])
    })],
    ["spaceShips", ({
        name: "spaceShipyard", goodsRequirements: goodsReqSpaceShipyard,
        workerRequirement: workerReqStandard,
        goodsProduction: { spaceTransport: 8 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.1, metals: 0.08, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["orbitalFactory", ({
        name: "orbitalFactory", goodsRequirements: {
            paper: 1, environmentFactor: 2, electricity: 28, tylium: 5, governance: 2, electronics: 1
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { tylium: 12 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.1, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1, productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["construction", ({
        name: "construction", goodsRequirements: {
            paper: 1,
            electricity: 4,
            governance: 2,
            environmentFactor: 3,
            water: 10,
            lumber: 10,
            metals: 10
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { buildings: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["services", ({
        name: "services", goodsRequirements: {
            paper: 1, environmentFactor: 1, retail: 50, electricity: 22, furniture: 8, governance: 2
        }, workerRequirement: { healtcarePersonal: 1, serviceWorker: 94, clergy: 5 }, goodsProduction: { services: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.01, furniture: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["tourism", ({
        name: "tourism", goodsRequirements: {
            paper: 1, environmentFactor: 3, retail: 50, services: 12, meat: 6, governance: 2
        }, workerRequirement: { worker: 20, clerks: 5, serviceWorker: 70, healtcarePersonal: 5 }, goodsProduction: { tourism: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.02, luxuryFurniture: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["education", ({
        name: "education", goodsRequirements: {
            electricity: 10, services: 6, governance: 2, paper: 2, itServices: 1
        }, workerRequirement: { teacher: 89, clerks: 10, worker: 5, healtcarePersonal: 1 }, goodsProduction: { education: 300 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.02, electronics: 0.01, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("All of the non teaching staff is replaced by robots, because teacher are still cheaper")
        ])
    })],
    ["healthcare", ({
        name: "healthcare", goodsRequirements: {
            paper: 1, retail: 20, medicine: 3, electricity: 8, governance: 2, itServices: 1
        }, workerRequirement: { healtcarePersonal: 90, clerks: 5, worker: 5 }, goodsProduction: { healthcare: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.01, machinery: 0.02, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["environmentControl", ({
        name: "environmentControl",
        goodsRequirements: {
            paper: 1, electricity: 14, medicine: 3, chemicals: 3, governance: 2
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1, }, goodsProduction: { environmentFactor: 30 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.03, buildings: 0.02, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.08,
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["chemical", ({
        name: "chemical", goodsRequirements: {
            paper: 1, environmentFactor: 3, oil: 8, electricity: 15, governance: 2
        }, workerRequirement: { worker: 89, clerks: 5, engineer: 5, healtcarePersonal: 1 }, goodsProduction: { chemicals: 70, waste: 4 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["bank", ({
        name: "bank", goodsRequirements: {
            paper: 1, electricity: 14, services: 8, governance: 2, itServices: 1
        }, workerRequirement: { worker: 19, clerks: 80, healtcarePersonal: 1 }, goodsProduction: { monetaryServices: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.02, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["religion", ({
        name: "religion",
        goodsRequirements: {
            paper: 1, services: 12, governance: 2
        }, workerRequirement: { clergy: 89, clerks: 5, worker: 5, healtcarePersonal: 1 }, goodsProduction: { faith: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.02 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("Robot assistants, instead of employing deacons, who can clean and maintain the temples and assist the priests")
        ]),
        secondaryProductionMethod: new Map([
            ["ultraOrtodox", {
                desc: "Teaching literal interpretation of the Sacred Scrolls. They are regarded as the most fundamentalist version of our religion as it makes people follow very strict rules in their everyday life. Because of this, they are very popular among the people"
            }],
            ["traditional", {
                desc: "Teaching the old, most accepted, canon version of the Sacred Scrolls. They are teachings in metaphors, rather than a literal interpretation. As there is no proof about their authenticity, most people will disregard them as religious texts, nothing more"
            }],
            ["originalScrolls", {
                desc: "Teaching the original scrolls, as they were written. They are teaching in a more literal interpretation, rather than metaphors, this way more people will engage with religion"
            }],
            ["extendedScrolls", {
                desc: "As there is proof that we came from Kobol, we can also teach the other scrolls too, even though their authenticity and precision is questionable. This way religion will become more comprehensive and engaging, as real history mixes with spirituality"
            }],
            ["theOne", {
                desc: "Instead of worshipping the 12 Lords of Kobol, we can worship the One, who created the universe and leads us according his plan into our planned end. He works in a mysterious way, but we can see his work in the world around us. This is the most antagonized faith in the world of men, because it's fundamentally different concept that we are used to."
            }],
        ])
    })],
    ["lawEnforcement", ({
        name: "lawEnforcement",
        goodsRequirements: { paper: 1, electricity: 12, weapons: 3, governance: 2, itServices: 1 },
        workerRequirement: { policeMen: 89, worker: 5, clerks: 5, healtcarePersonal: 1 }, goodsProduction: { lawEnforcement: 80 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("The future of law enforcement is here!")
        ])
    })],
    ["nuclearSector", ({
        name: "nuclearSector", goodsRequirements:
            { ore: 20, paper: 1, electricity: 10, governance: 2, environmentFactor: 1 },
        workerRequirement: { scientist: 5, worker: 69, clerks: 5, engineer: 20, healtcarePersonal: 1 },
        goodsProduction: { uranium: 10, waste: 3 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["alternativeMedicine", ({
        name: "alternativeMedicine", goodsRequirements: {
            paper: 1, environmentFactor: 1, retail: 20, agriculturalGoods: 25, governance: 2
        }, workerRequirement: { worker: 94, clerks: 5, healtcarePersonal: 1 }, goodsProduction: { healthcare: 120 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.02, buildings: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["recycling", ({
        name: "recycling",
        goodsRequirements: { waste: 20, electricity: 4, paper: 1, governance: 2, environmentFactor: 2, },
        workerRequirement: workerReqStandard,
        goodsProduction: { metals: 6, lumber: 4, water: 30, chemicals: 2, oil: 4 },
        capitalGoods: { machinery: 0.04, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["government", ({
        name: "government",
        goodsRequirements: { paper: 1, services: 5, environmentFactor: 1, itServices: 1 },
        workerRequirement: { clerks: 79, worker: 20, healtcarePersonal: 1 },
        goodsProduction: { governance: 150 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "itServices"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("A highly effective, AI powered automatic government")
        ])
    })],
    ["automotive", ({
        name: "automotive",
        goodsRequirements: {
            environmentFactor: 3,
            paper: 1,
            retail: 20,
            oil: 6,
            electricity: 15,
            water: 2,
            governance: 2,
            electronics: 1,
        },
        workerRequirement: { worker: 89, scientist: 5, clerks: 5, healtcarePersonal: 1 },
        goodsProduction: { vehicles: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
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
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["electronics", ({
        name: "electronics",
        goodsRequirements: {
            environmentFactor: 2, paper: 1, retail: 20, chemicals: 5, electricity: 18, governance: 2
        },
        workerRequirement: {
            worker: 84, scientist: 5, clerks: 5, engineer: 5, healtcarePersonal: 1
        },
        goodsProduction: { electronics: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08 },
        capitalEfficiency: 0.0012,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["railroadVehicles", ({
        name: "railroadVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { railroadVehicles: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["militaryVehicles", ({
        name: "militaryVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { militaryVehicles: 50, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["railroadInfrastructure", ({
        name: "railroadInfrastructure",
        goodsRequirements: {
            retail: 1, environmentFactor: 2,
            paper: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, railroadVehicles: 10
        },
        workerRequirement: { worker: 84, clerks: 5, serviceWorker: 5, engineer: 5, healtcarePersonal: 1 },
        goodsProduction: { railroadMobility: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, metals: 0.02, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["ships", ({
        name: "ships",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { ships: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["shipInfrastructure", ({
        name: "shipInfrastructure",
        goodsRequirements: {
            retail: 1, environmentFactor: 2, paper: 1,
            oil: 50, electricity: 1, buildings: 10, governance: 2, ships: 10
        },
        workerRequirement: workerReqMaritime,
        goodsProduction: { shipMobility: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, metals: 0.02, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["aircraft", ({
        name: "aircraft",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { aircraft: 100, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, metals: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["aircraftInfrastructure", ({
        name: "aircraftInfrastructure",
        goodsRequirements: { retail: 1, environmentFactor: 2, paper: 1, oil: 50, electricity: 1, buildings: 10, governance: 2, aircraft: 10 },
        workerRequirement: { worker: 84, engineer: 5, clerks: 5, serviceWorker: 5, healtcarePersonal: 1 },
        goodsProduction: { airMobility: 100, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, metals: 0.02, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("With self driving planes.")
        ])
    })],
    ["clothing", ({
        name: "clothing",
        goodsRequirements: { environmentFactor: 3, paper: 1, retail: 50, chemicals: 2, electricity: 15, water: 2, governance: 2, agriculturalGoods: 10 },
        workerRequirement: workerReqStandard,
        goodsProduction: { clothing: 100, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["paperFactory", ({
        name: "paperFactory",
        goodsRequirements: { environmentFactor: 3, wood: 20, chemicals: 8, electricity: 16, governance: 2 },
        workerRequirement: workerReqStandard,
        goodsProduction: { paper: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.06, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["postalServices", ({
        name: "postalServices",
        goodsRequirements: { environmentFactor: 2, retail: 50, electricity: 15, governance: 2, paper: 10, aircraft: 1, railroadVehicles: 1 },
        workerRequirement: { worker: 79, clerks: 5, serviceWorker: 15, healtcarePersonal: 1 },
        goodsProduction: { post: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { vehicles: 0.05, machinery: 0.03, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized("A fully robotized postal service is a system where automated sorting facilities, drones, and AI-driven logistics manage mail delivery without human intervention.")
        ])
    })],
    ["entertainmentIndustry", ({
        name: "entertainmentIndustry",
        goodsRequirements: { environmentFactor: 2, retail: 50, electricity: 15, governance: 2, paper: 10 },
        workerRequirement: { worker: 49, clerks: 5, engineer: 5, serviceWorker: 40, healtcarePersonal: 1 },
        goodsProduction: { entertainment: 100, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.04, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["informationTechnology", ({
        name: "informationTechnology",
        goodsRequirements: { retail: 10, environmentFactor: 2, electricity: 15, governance: 2, paper: 10 },
        workerRequirement: { worker: 39, clerks: 5, engineer: 45, serviceWorker: 10, healtcarePersonal: 1 },
        goodsProduction: { itServices: 15, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.05, buildings: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["retail", ({
        name: "retail",
        goodsRequirements: { environmentFactor: 2, electricity: 15, governance: 2, paper: 10 },
        workerRequirement: { worker: 34, clerks: 5, serviceWorker: 60, healtcarePersonal: 1 },
        goodsProduction: { waste: 1, retail: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["defense", ({
        name: "retail",
        goodsRequirements: {
            militaryVehicles: 10,
            electricity: 15,
            governance: 2,
            paper: 10,
            ammunition: 100,
            weapons: 100,
            ordnance: 50
        },
        workerRequirement: { worker: 85, clerks: 5, healtcarePersonal: 5, engineer: 5 },
        goodsProduction: { defense: 200, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, vehicles: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance", "electronics"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized("A fully autonomus robot army, lead by powerful AIs, which can wage wars without any human intervention. May the Gods have mercy on -our- *their enemies.")
        ])
    }),],
    ["spaceGoodsTransport", {
        name: "spaceGoodsTransport",
        goodsRequirements: {
            environmentFactor: 2,
            electricity: 15,
            governance: 2,
            paper: 10
        },
        workerRequirement: {
            worker: 34,
            clerks: 5,
            serviceWorker: 60,
            healtcarePersonal: 1
        },
        goodsProduction: { waste: 1, retail: 100 },
        capitalGoods: { vehicles: 0.05, machinery: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance"]),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized("A merchant marine which is fully automated by AI.")
        ])
    }]
])


// console.log([...industrialSectors].reduce((acc, [, value]) => {
//     return acc + value.size
// }, 0), industrySectorBlueprints.size)