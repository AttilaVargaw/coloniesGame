import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

type SectorBlueprint = {
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

export type ProductionMethod = {
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
    // Gamification modifiers applied when this method is selected
    efficiencyMultiplier?: number   // output multiplier
    workerMultiplier?: number       // divides worker demand (<1 = fewer workers needed)
    materialMultiplier?: number     // multiplies material demand (<1 = less material)
    capitalMultiplier?: number      // multiplies capital stock effectiveness
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
        prerequisites: new Set(["synteticLifeformUnit"]),
        workerMultiplier: 0.4,
        efficiencyMultiplier: 1.3,
        capitalMultiplier: 1.2,
    }]
}

function createLLM() {
    return ["llm", {
        desc: "Most of the manufacturing processes are handled by large language models, less humans needed",
        goodsRequirements: {},
        workerRequirement: {},
        goodsProduction: {},
        efficiencyBonus: 0,
        capitalGoods: {},
        capitalEfficiency: 0,
        capitalEfficiencyDecay: 0,
        nonEssentialGoods: new Set<keyof Goods>(),
        optionalGoods: [],
        prerequisites: new Set(["largeLanguageModel"]),
        workerMultiplier: 0.5,
        efficiencyMultiplier: 1.2,
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
        prerequisites: new Set(["synteticLifeformUnit"]),
        workerMultiplier: 0.25,
        efficiencyMultiplier: 1.6,
        capitalMultiplier: 1.4,
    }]
}

function createTraditional(descOverride?: string): ["traditional", ProductionMethod] {
    return ["traditional", {
        desc: descOverride || "Traditional manufacturing processes, all parts are handled by human workers",
        goodsRequirements: {},
        workerRequirement: {},
        goodsProduction: {},
        efficiencyBonus: 0,
        capitalGoods: {},
        capitalEfficiency: 0,
        capitalEfficiencyDecay: 0,
        nonEssentialGoods: new Set<keyof Goods>(),
        optionalGoods: [],
        prerequisites: new Set(),
        workerMultiplier: 1.0,
        efficiencyMultiplier: 1.0,
        capitalMultiplier: 1.0,
    }]
}

const workerReqStandard = { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 } as const
const workerReqTechnical = { worker: 840, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10 } as const
const workerReqMaritime = { worker: 890, engineer: 50, clerks: 50, healtcarePersonal: 10 } as const
const goodsReqHeavyVehicle = { environmentFactor: 20, paper: 10, electricity: 150, governance: 20, electronics: 10 } as const
const goodsReqSpaceShipyard = { paper: 10, environmentFactor: 20, electricity: 280, governance: 20, electronics: 10 } as const
const usualNonEssentialGoods = ["electronics", "governance", "paper", "water", "vehicles", "electricity", "services", "environmentFactor", "retail", "itServices"] as const

export const industrySectorBlueprints = new Map<string, SectorBlueprint>([
    ["greenEnergy", {
        name: "greenEnergy",
        goodsRequirements: {
            paper: 1,
            electricity: 50, governance: 20, environmentFactor: 20
        },
        workerRequirement: workerReqStandard,
        goodsProduction: { electricity: 300_000, waste: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            createTraditional(),
            createFullyRobotized()
        ])
    }],
    ["mine", {
        name: "mine",
        goodsRequirements: {
            paper: 1,
            electricity: 50, governance: 20, environmentFactor: 20
        },
        workerRequirement: workerReqStandard,
        goodsProduction: { ore: 15_000, waste: 20 },
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
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { oil: 2_000, waste: 20 },
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
        goodsProduction: { wood: 50_000, meat: 2_000, environmentFactor: 1_000_00 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.1, buildings: 0.1, vehicles: 0.1 },
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "ammunition", "chemicals"]),
    })],
    ["farm", ({
        name: "farm", goodsRequirements: {
            paper: 10, environmentFactor: 20, water: 40, chemicals: 80, governance: 20,
        }, workerRequirement: {
            farmer: 900, clerks: 50, engineer: 50, healtcarePersonal: 10
        }, goodsProduction: { agriculturalGoods: 1000, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["chemicals", "electronics", "paper", "environmentFactor"]),
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
        goodsProduction: { meat: 300_000 },
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1, ships: 0.1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["paper", "governance", "electronics", "environmentFactor"]),
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
        goodsProduction: { food: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1 },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["meat", ({
        name: "meat",
        goodsRequirements: { paper: 10, environmentFactor: 20, electricity: 180, governance: 20, retail: 200 },
        workerRequirement: workerReqStandard,
        goodsProduction: { meat: 1_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, },
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["waterTreatment", ({
        name: "waterTreatment", goodsRequirements: {
            paper: 10, environmentFactor: 20, electricity: 200, chemicals: 80, governance: 20
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { water: 500_000 },
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
        }, goodsProduction: { electricity: 400_000, waste: 10 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        capitalGoods: { machinery: 0.5, electronics: 0.1, buildings: 0.1 },
        productionMethods: new Map([
            ["Fossil", {
                desc: "Fossil",
            }],
            ["Nuclear", {
                desc: "Nuclear energy generation",
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
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { metals: 100_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
    })],
    ["lumberMill", ({
        name: "lumberMill", goodsRequirements: {
            environmentFactor: 2,
            wood: 30,
            paper: 1,
            governance: 2,
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { lumber: 100_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.4, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
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
        goodsProduction: { machinery: 4_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
    })],
    ["medicineFactory", ({
        name: "medicineFactory", goodsRequirements: {
            environmentFactor: 20,
            paper: 10, chemicals: 50, electricity: 140, governance: 20, electronics: 10
        }, workerRequirement: { worker: 850, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { medicine: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.2, electronics: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
    })],
    ["consumerFactory", ({
        name: "consumerFactory", goodsRequirements: {
            environmentFactor: 20,
            paper: 10, chemicals: 60, electricity: 220, governance: 20, electronics: 10
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { consumerGoods: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
    })],
    ["furnitureFactory", ({
        name: "furnitureFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 200, lumber: 100, chemicals: 40, electricity: 200, governance: 20 },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { furniture: 10_000, luxuryFurniture: 1_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
    })],
    ["ammunitionFactory", ({
        name: "ammunitionFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 100, chemicals: 50, electricity: 200, governance: 20 },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { ammunition: 1_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["weaponFactory", ({
        name: "weaponFactory", goodsRequirements: { paper: 10, environmentFactor: 20, retail: 100, electricity: 200, governance: 20 },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { weapons: 10_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, metals: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
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
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["spaceShips", ({
        name: "spaceShipyard", goodsRequirements: goodsReqSpaceShipyard,
        workerRequirement: workerReqStandard,
        goodsProduction: { spaceTransport: 8_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 1, metals: 0.8, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
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
        goodsProduction: { buildings: 100_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, electronics: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["services", ({
        name: "services", goodsRequirements: {
            paper: 10, environmentFactor: 10, retail: 500, electricity: 220, furniture: 80, governance: 20
        },
        workerRequirement: { healtcarePersonal: 10, serviceWorker: 940, clergy: 50 },
        goodsProduction: { services: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, furniture: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["tourism", ({
        name: "tourism",
        goodsRequirements: {
            paper: 10, environmentFactor: 30, retail: 500, services: 120, meat: 60, governance: 20
        }, workerRequirement: { worker: 200, clerks: 50, serviceWorker: 700, healtcarePersonal: 50 }, goodsProduction: { tourism: 1_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, luxuryFurniture: 0.1, electronics: 0.1, furniture: 0.1 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["education", ({
        name: "education", goodsRequirements: {
            electricity: 100, services: 60, governance: 20, paper: 20, itServices: 10
        }, workerRequirement: { teacher: 890, clerks: 100, worker: 50, healtcarePersonal: 10 },
        goodsProduction: { education: 300_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, electronics: 0.1, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized("All of the non teaching staff is replaced by robots, because teacher are still cheaper")
        ])
    })],
    ["healthcare", ({
        name: "healthcare", goodsRequirements: {
            paper: 10, retail: 200, medicine: 30, electricity: 80, governance: 20, itServices: 10
        }, workerRequirement: { healtcarePersonal: 900, clerks: 50, worker: 50 }, goodsProduction: { healthcare: 2_000 },
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
        goodsProduction: { environmentFactor: 3_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.3, buildings: 0.2, electronics: 0.1 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.08,
    })],
    ["chemical", ({
        name: "chemical", goodsRequirements: {
            paper: 10, environmentFactor: 30, oil: 80, electricity: 150, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { chemicals: 7_000, waste: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["bank", ({
        name: "bank", goodsRequirements: {
            paper: 10, electricity: 140, services: 80, governance: 20, itServices: 10
        }, workerRequirement: { worker: 190, clerks: 800, healtcarePersonal: 10 }, goodsProduction: { monetaryServices: 800_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, electronics: 0.1 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["religion", ({
        name: "religion",
        goodsRequirements: {
            paper: 10, services: 120, governance: 20
        }, workerRequirement: { clergy: 890, clerks: 50, worker: 50, healtcarePersonal: 10 }, goodsProduction: { faith: 2_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["lawEnforcement", ({
        name: "lawEnforcement",
        goodsRequirements: { paper: 10, electricity: 120, weapons: 30, governance: 20, itServices: 10 },
        workerRequirement: { policeMen: 890, worker: 50, clerks: 50, healtcarePersonal: 10 },
        goodsProduction: { lawEnforcement: 800_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
        productionMethods: new Map([
            ["traditional", {
                desc: "Traditional",
            }],
            createFullyRobotized("The future of law enforcement is here!")
        ])
    })],
    ["nuclearSector", ({
        name: "nuclearSector", goodsRequirements:
            { ore: 200, paper: 10, electricity: 100, governance: 20, environmentFactor: 10 },
        workerRequirement: { scientist: 50, worker: 690, clerks: 50, engineer: 200, healtcarePersonal: 10 },
        goodsProduction: { uranium: 1_000, waste: 30, electricity: 10_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["alternativeMedicine", ({
        name: "alternativeMedicine", goodsRequirements: {
            paper: 10, environmentFactor: 10, retail: 200, agriculturalGoods: 250, governance: 20
        }, workerRequirement: { worker: 940, clerks: 50, healtcarePersonal: 10 }, goodsProduction: { healthcare: 100_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.2, buildings: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
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
    })],
    ["government", ({
        name: "government",
        goodsRequirements: { paper: 10, services: 50, environmentFactor: 10, itServices: 10 },
        workerRequirement: { clerks: 790, worker: 200, healtcarePersonal: 10 },
        goodsProduction: { governance: 150_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "itServices"]),
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
        goodsProduction: { vehicles: 150_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["automotiveInfrastructure", ({
        name: "automotiveInfrastructure",
        goodsRequirements: {
            environmentFactor: 30, paper: 10, oil: 500, governance: 20, metals: 10
        },
        capitalGoods: { machinery: 0.1, buildings: 0.1, electronics: 0.1, vehicles: 0.1, },
        workerRequirement: {
            worker: 840, clerks: 50, serviceWorker: 50, engineer: 50, healtcarePersonal: 10
        },
        goodsProduction: { automotiveMobility: 1_500_000, waste: 10 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set(["environmentFactor", "paper", "electronics",]),
    })],
    ["electronics", ({
        name: "electronics",
        goodsRequirements: {
            environmentFactor: 20, paper: 10, retail: 200, chemicals: 50, electricity: 180, governance: 20
        },
        workerRequirement: {
            worker: 840, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10
        },
        goodsProduction: { electronics: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8 },
        capitalEfficiency: 0.0012,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["railroadVehicles", ({
        name: "railroadVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { railroadVehicles: 150_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["militaryVehicles", ({
        name: "militaryVehicles",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqTechnical,
        goodsProduction: { militaryVehicles: 50_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["railroadInfrastructure", ({
        name: "railroadInfrastructure",
        goodsRequirements: {
            retail: 10, environmentFactor: 20,
            paper: 10, oil: 500, electricity: 10, buildings: 100, governance: 20, railroadVehicles: 100
        },
        workerRequirement: { worker: 804, clerks: 50, serviceWorker: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { railroadMobility: 1500, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["ships", ({
        name: "ships",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { ships: 150_000, waste: 10 },
        efficiencyBonus: 0.1,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["shipInfrastructure", ({
        name: "shipInfrastructure",
        goodsRequirements: {
            retail: 10, environmentFactor: 20, paper: 10,
            oil: 500, electricity: 10, buildings: 10, governance: 20
        },
        workerRequirement: workerReqMaritime,
        goodsProduction: { shipMobility: 1500, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1, ships: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["aircraft", ({
        name: "aircraft",
        goodsRequirements: goodsReqHeavyVehicle,
        workerRequirement: workerReqMaritime,
        goodsProduction: { aircraft: 10_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["aircraftInfrastructure", ({
        name: "aircraftInfrastructure",
        goodsRequirements: { retail: 10, environmentFactor: 20, paper: 10, oil: 500, electricity: 10, buildings: 100, governance: 20 },
        workerRequirement: { worker: 840, engineer: 50, clerks: 50, serviceWorker: 50, healtcarePersonal: 10 },
        goodsProduction: { airMobility: 100_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, metals: 0.2, buildings: 0.1, electronics: 0.1, aircraft: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["clothing", ({
        name: "clothing",
        goodsRequirements: { environmentFactor: 30, paper: 10, retail: 500, chemicals: 20, electricity: 150, water: 20, governance: 20, agriculturalGoods: 100 },
        workerRequirement: workerReqStandard,
        goodsProduction: { clothing: 200_000, waste: 1 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.05, buildings: 0.01, electronics: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["paperFactory", ({
        name: "paperFactory",
        goodsRequirements: { environmentFactor: 30, wood: 200, chemicals: 80, electricity: 160, governance: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { paper: 20_00_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["postalServices", ({
        name: "postalServices",
        goodsRequirements: { environmentFactor: 20, retail: 50, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 790, clerks: 50, serviceWorker: 150, healtcarePersonal: 10 },
        goodsProduction: { post: 15000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { vehicles: 0.5, machinery: 0.3, buildings: 0.1, electronics: 0.1, aircraft: 0.1, railroadVehicles: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["entertainmentIndustry", ({
        name: "entertainmentIndustry",
        goodsRequirements: { environmentFactor: 20, retail: 500, electricity: 150, governance: 2, paper: 100 },
        workerRequirement: { worker: 490, clerks: 50, engineer: 50, serviceWorker: 400, healtcarePersonal: 10 },
        goodsProduction: { entertainment: 1_000_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.4, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: new Set(usualNonEssentialGoods),
    })],
    ["informationTechnology", ({
        name: "informationTechnology",
        goodsRequirements: { retail: 100, environmentFactor: 20, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 390, clerks: 50, engineer: 450, serviceWorker: 100, healtcarePersonal: 10 },
        goodsProduction: { itServices: 1_050_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { electronics: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance"]),
    })],
    ["retail", ({
        name: "retail",
        goodsRequirements: { environmentFactor: 20, electricity: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 340, clerks: 50, serviceWorker: 600, healtcarePersonal: 10 },
        goodsProduction: { waste: 1, retail: 100_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: new Set(["paper", "governance", "electronics", "environmentFactor"]),
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
        workerRequirement: { serviceMan: 850, clerks: 50, healtcarePersonal: 50, engineer: 50 },
        goodsProduction: { defense: 2000000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, vehicles: 0.5, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance", "electronics", "ordnance", "militaryVehicles", "electricity", "environmentFactor"]),
        productionMethods: new Map([
            createTraditional(),
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
        goodsProduction: { waste: 10 },
        capitalGoods: { vehicles: 0.5, machinery: 0.5, buildings: 0.1, electronics: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: new Set(["paper", "governance", "environmentFactor"]),
        productionMethods: new Map([
            createTraditional(),
            createFullyRobotized("A merchant marine which is fully automated by AI.")
        ])
    }]
])

industrySectorBlueprints.forEach((sector) => {
    if(sector.productionMethods === undefined) sector.productionMethods = new Map([createFullyRobotized(), createRobotized(), createTraditional()])
})