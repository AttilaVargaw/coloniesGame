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

const workerReqStandard = { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 } as const
const workerReqTechnical = { worker: 840, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10 } as const
const workerReqMaritime = { worker: 890, engineer: 50, clerks: 50, healtcarePersonal: 10 } as const
const goodsReqHeavyVehicle = { environmentFactor: 20, paper: 10, electricity: 150, governance: 20, electronics: 10 } as const
const goodsReqSpaceShipyard = { paper: 10, environmentFactor: 20, electricity: 280, governance: 20, electronics: 10 } as const
const usualNonEssentialGoods = ["electronics", "governance", "paper", "water", "vehicles", "electricity", "services", "environmentFactor", "retail", "itServices"] as const

export const industrySectorBlueprints = new Map<keyof IndustrialSectors, FactoryBlueprint>([
    ["mine", {
        name: "mine",
        goodsRequirements: {
            paper: 1,
            electricity: 50, governance: 20, environmentFactor: 20
        },
        workerRequirement: workerReqStandard,
        goodsProduction: { ore: 1500, waste: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, },
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
            paper: 10, environmentFactor: 20, electricity: 10, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { oil: 1500, waste: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, },
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
            paper: 10, ammunition: 10, chemicals: 30, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { wood: 1800, meat: 200, environmentFactor: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.1, buildings: 0.1, vehicles: 0.1 },
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
            paper: 10, environmentFactor: 20, water: 40, chemicals: 80, governance: 20,
        }, workerRequirement: {
            farmer: 900, clerks: 50, engineer: 50, healtcarePersonal: 10
        }, goodsProduction: { agriculturalGoods: 1000, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["chemicals", "electronics", "paper"]),
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, vehicles: 1 },
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
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { meat: 1000 },
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, ships: 0.1 },
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
        goodsRequirements: { paper: 10, environmentFactor: 20, agriculturalGoods: 200, governance: 20, retail: 200 },
        workerRequirement: workerReqStandard,
        goodsProduction: { food: 1500 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1 },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["meat", ({
        name: "meat",
        goodsRequirements: { paper: 10, environmentFactor: 20, electricity: 180, governance: 20, retail: 200 },
        workerRequirement: workerReqStandard,
        goodsProduction: { meat: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["waterTreatment", ({
        name: "waterTreatment", goodsRequirements: {
            paper: 10, environmentFactor: 20, electricity: 200, chemicals: 80, governance: 20
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { water: 15000 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "chemicals"]),
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1 },
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }]
        ])
    })],
    ["powerPlant", ({
        name: "powerPlant", goodsRequirements: {
            environmentFactor: 20,
            paper: 10,
            oil: 140,
            governance: 20,
        },
        workerRequirement: {
            worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10
        }, goodsProduction: { electricity: 2500, waste: 10 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1 },
        productionMethods: new Map([
            ["Fossil", {
                desc: "Fossil",
            }]
        ])
    })],
    ["metalFactory", ({
        name: "metalFactory", goodsRequirements: {
            environmentFactor: 30,
            paper: 10,
            electricity: 200,
            ore: 1000,
            governance: 20,
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { metals: 600, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, buildings: 0.1, electronics: 0.1 },
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
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { lumber: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.4, buildings: 0.1, electronics: 0.1 },
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
            environmentFactor: 20,
            paper: 10,
            metals: 80,
            electricity: 150,
            governance: 20
        },
        workerRequirement: {
            worker: 890,
            clerks: 50,
            engineer: 50,
            healtcarePersonal: 10
        },
        goodsProduction: { machinery: 400 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
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
            environmentFactor: 20,
            paper: 10, chemicals: 50, electricity: 140, governance: 20, electronics: 10
        }, workerRequirement: { worker: 850, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { medicine: 350 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.2, electronics: 0.1 },
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
            environmentFactor: 20,
            paper: 10, chemicals: 60, electricity: 220, governance: 20, electronics: 10
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { consumerGoods: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.1 },
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
        name: "furnitureFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 200, lumber: 100, chemicals: 40, electricity: 200, governance: 20 }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { furniture: 500 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
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
        name: "ammunitionFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 100, chemicals: 50, electricity: 200, governance: 20 }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { ammunition: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
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
        name: "weaponFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 100, electricity: 200, governance: 20 },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { weapons: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, metals: 0.5, buildings: 0.1 },
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
            electricity: 250,
            governance: 20,
            paper: 10,
            environmentFactor: 20,
        }, workerRequirement: { worker: 790, clerks: 50, engineer: 50, scientist: 100, healtcarePersonal: 10 },
        goodsProduction: { spaceTransport: 50 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, electronics: 0.5, buildings: 0.1 },
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
        goodsProduction: { spaceTransport: 80 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 1, metals: 0.8, buildings: 0.1 },
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
            paper: 10, environmentFactor: 20, electricity: 280, tylium: 50, governance: 20, electronics: 10
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { tylium: 120 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 1, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1, productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }], createFullyRobotized()
        ])
    })],
    ["construction", ({
        name: "construction", goodsRequirements: {
            paper: 10,
            electricity: 40,
            governance: 20,
            environmentFactor: 30,
            water: 100,
            lumber: 100,
            metals: 100
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { buildings: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, electronics: 0.1 },
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
            paper: 10, environmentFactor: 10, retail: 500, electricity: 220, furniture: 80, governance: 20
        },
        workerRequirement: { healtcarePersonal: 10, serviceWorker: 940, clergy: 50 },
        goodsProduction: { services: 2000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, furniture: 0.1, electronics: 0.1 },
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
        name: "tourism",
        goodsRequirements: {
            paper: 10, environmentFactor: 30, retail: 500, services: 120, meat: 60, governance: 20
        }, workerRequirement: { worker: 200, clerks: 50, serviceWorker: 700, healtcarePersonal: 50 }, goodsProduction: { tourism: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, luxuryFurniture: 0.1, electronics: 0.1, furniture: 0.1 },
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
            electricity: 100, services: 60, governance: 20, paper: 20, itServices: 10
        }, workerRequirement: { teacher: 890, clerks: 100, worker: 50, healtcarePersonal: 10 },
        goodsProduction: { education: 3000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, electronics: 0.1, },
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
            paper: 10, retail: 200, medicine: 30, electricity: 80, governance: 20, itServices: 10
        }, workerRequirement: { healtcarePersonal: 900, clerks: 50, worker: 50 }, goodsProduction: { healthcare: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, machinery: 0.2, electronics: 0.1 },
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
            paper: 10, electricity: 140, medicine: 30, chemicals: 30, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10, },
        goodsProduction: { environmentFactor: 300 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.3, buildings: 0.2, electronics: 0.1 },
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
            paper: 10, environmentFactor: 30, oil: 80, electricity: 150, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { chemicals: 700, waste: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, electronics: 0.1 },
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
            paper: 10, electricity: 140, services: 80, governance: 20, itServices: 10
        }, workerRequirement: { worker: 190, clerks: 800, healtcarePersonal: 10 }, goodsProduction: { monetaryServices: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, electronics: 0.1 },
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
            paper: 10, services: 120, governance: 20
        }, workerRequirement: { clergy: 890, clerks: 50, worker: 50, healtcarePersonal: 10 }, goodsProduction: { faith: 2000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized("Robot assistants, instead of employing deacons, who can clean the churches and assist the priests")
        ]),
        secondaryProductionMethod: new Map([
            ["ultraOrtodox", {
                desc: "Teaching literal interpretation of the Sacred Scrolls. They are regarded as the most fundamentalist version of colonial religion as it makes people follow very strict rules in their everyday life. Because of this, they are very popular among the most conservative people"
            }],
            ["traditional", {
                desc: "Teaching the old, most accepted, canon version of the Sacred Scrolls. They treat the stories as metaphors, rather than a literal historical events. As there is no proof about their authenticity, most people will disregard them as religious texts, nothing more"
            }],
            ["originalScrolls", {
                desc: "Teaching only from the original scrolls, as they were written. As there is proof which support the stories, much more people will engage with religion"
            }],
            ["atheistic", {
                desc: "There is no proof that we came from some kind of fallen paradise and who was left behind. The most reasonable explanation is that a great cataclysm destroyed our words and our ancestors rebuilt the civilization."
            }],
            ["atheisticWithScrolls", {
                desc: "We had modify our word view, because we have proof that we came from Kobol, but we still believe that Lords of Kobol or the One God are not real."
            }],
            ["extendedScrolls", {
                desc: "As there is proof that we came from Kobol, we can also teach the other scrolls too, even though their authenticity and precision is questionable. This way religion will become more comprehensive and engaging, as real history mixes with spirituality"
            }],
            ["theOne", {
                desc: "Instead of worshipping the 12 Lords of Kobol, we can worship the One, who created the universe and leads into our planned ends, according his grand plan. He works in a mysterious way, but we can see his work in the world around us. This is the most antagonized faith in the world of men, because it's fundamentally different concept that we are all used to."
            }],
        ])
    })],
    ["lawEnforcement", ({
        name: "lawEnforcement",
        goodsRequirements: { paper: 10, electricity: 120, weapons: 30, governance: 20, itServices: 10 },
        workerRequirement: { policeMen: 890, worker: 50, clerks: 50, healtcarePersonal: 10 },
        goodsProduction: { lawEnforcement: 800 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
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
            { ore: 200, paper: 10, electricity: 100, governance: 20, environmentFactor: 10 },
        workerRequirement: { scientist: 50, worker: 690, clerks: 50, engineer: 200, healtcarePersonal: 10 },
        goodsProduction: { uranium: 100, waste: 30 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, buildings: 0.1, electronics: 0.1 },
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
            paper: 10, environmentFactor: 10, retail: 200, agriculturalGoods: 250, governance: 20
        }, workerRequirement: { worker: 940, clerks: 50, healtcarePersonal: 10 }, goodsProduction: { healthcare: 1200 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.2, buildings: 0.1 },
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
        goodsRequirements: { waste: 200, electricity: 40, paper: 10, governance: 20, environmentFactor: 20, },
        workerRequirement: workerReqStandard,
        goodsProduction: { metals: 60, lumber: 40, water: 300, chemicals: 20, oil: 40 },
        capitalGoods: { machinery: 0.4, buildings: 0.1, electronics: 0.1 },
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
        goodsRequirements: { paper: 10, services: 50, environmentFactor: 10, itServices: 10 },
        workerRequirement: { clerks: 790, worker: 200, healtcarePersonal: 10 },
        goodsProduction: { governance: 1500 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
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
            environmentFactor: 30,
            paper: 10,
            retail: 200,
            oil: 60,
            electricity: 150,
            water: 20,
            governance: 20,
            electronics: 10,
        },
        workerRequirement: { worker: 890, scientist: 50, clerks: 50, healtcarePersonal: 10 },
        goodsProduction: { vehicles: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5 },
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
            environmentFactor: 30, paper: 10, machinery: 10, oil: 500, electricity: 10, buildings: 100, governance: 20, electronics: 10, metals: 10, vehicles: 100
        },
        workerRequirement: {
            worker: 840, clerks: 50, serviceWorker: 50, engineer: 50, healtcarePersonal: 10
        },
        goodsProduction: { automotiveMobility: 150, waste: 10 },
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
            environmentFactor: 20, paper: 10, retail: 200, chemicals: 50, electricity: 180, governance: 20
        },
        workerRequirement: {
            worker: 840, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10
        },
        goodsProduction: { electronics: 1000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8 },
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
        goodsProduction: { railroadVehicles: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1, },
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
        goodsProduction: { militaryVehicles: 500, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
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
            retail: 10, environmentFactor: 20,
            paper: 10, oil: 500, electricity: 10, buildings: 100, governance: 20, railroadVehicles: 100
        },
        workerRequirement: { worker: 804, clerks: 50, serviceWorker: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { railroadMobility: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1 },
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
        goodsProduction: { ships: 150, waste: 10 },
        efficiencyBonus: 0.1,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1, electronics: 0.1 },
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
            retail: 10, environmentFactor: 20, paper: 10,
            oil: 500, electricity: 10, buildings: 10, governance: 20
        },
        workerRequirement: workerReqMaritime,
        goodsProduction: { shipMobility: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1, ships: 0.1 },
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
        goodsProduction: { aircraft: 1000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
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
        goodsRequirements: { retail: 10, environmentFactor: 20, paper: 10, oil: 500, electricity: 10, buildings: 100, governance: 20 },
        workerRequirement: { worker: 840, engineer: 50, clerks: 50, serviceWorker: 50, healtcarePersonal: 10 },
        goodsProduction: { airMobility: 1000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1, aircraft: 0.1 },
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
        goodsRequirements: { environmentFactor: 30, paper: 10, retail: 500, chemicals: 20, electricity: 150, water: 20, governance: 20, agriculturalGoods: 100 },
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
        goodsRequirements: { environmentFactor: 30, wood: 200, chemicals: 80, electricity: 160, governance: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { paper: 200 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.1, electronics: 0.1 },
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
        goodsRequirements: { environmentFactor: 20, retail: 50, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 790, clerks: 50, serviceWorker: 150, healtcarePersonal: 10 },
        goodsProduction: { post: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { vehicles: 0.5, machinery: 0.3, buildings: 0.1, electronics: 0.1, aircraft: 0.1, railroadVehicles: 0.1 },
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
        goodsRequirements: { environmentFactor: 20, retail: 500, electricity: 150, governance: 2, paper: 100 },
        workerRequirement: { worker: 490, clerks: 50, engineer: 50, serviceWorker: 400, healtcarePersonal: 10 },
        goodsProduction: { entertainment: 1000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.4, buildings: 0.1, electronics: 0.1 },
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
        goodsRequirements: { retail: 100, environmentFactor: 20, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 390, clerks: 50, engineer: 450, serviceWorker: 100, healtcarePersonal: 10 },
        goodsProduction: { itServices: 150, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.5, buildings: 0.1 },
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
        goodsRequirements: { environmentFactor: 20, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 340, clerks: 50, serviceWorker: 600, healtcarePersonal: 10 },
        goodsProduction: { waste: 1, retail: 100 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
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
        workerRequirement: { worker: 850, clerks: 50, healtcarePersonal: 50, engineer: 50 },
        goodsProduction: { defense: 2000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, vehicles: 0.5, buildings: 0.1, electronics: 0.1 },
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
            environmentFactor: 20,
            electricity: 150,
            governance: 20,
            paper: 100
        },
        workerRequirement: {
            worker: 340,
            clerks: 50,
            serviceWorker: 600,
            healtcarePersonal: 10
        },
        goodsProduction: { waste: 10, retail: 1000 },
        capitalGoods: { vehicles: 0.5, machinery: 0.5, buildings: 0.1, electronics: 0.1 },
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