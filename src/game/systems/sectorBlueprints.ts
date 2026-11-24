import { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

export type SectorBlueprint = {
    name: string,
    goodsRequirements: Partial<Goods>,
    workerRequirement: Partial<Record<keyof Population, number>>,
    goodsProduction: Partial<Goods>,
    efficiencyBonus?: number
    capitalGoods: Partial<Record<keyof Goods, number>>
    capitalEfficiency?: number
    capitalEfficiencyDecay?: number
    nonEssentialGoods?: Set<keyof Goods>
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
    desc?: string
    prerequisites?: Set<string>
    // Gamification modifiers applied when this method is selected
    efficiencyMultiplier?: number   // output multiplier
    workerMultiplier?: number       // divides worker demand (<1 = fewer workers needed)
    materialMultiplier?: number     // multiplies material demand (<1 = less material)
    capitalMultiplier?: number      // multiplies capital stock effectiveness
}

function createMethod<K extends string>(key: K, overrides?: Partial<ProductionMethod>): [K, ProductionMethod] {
    return [key, {
        desc: "",
        goodsRequirements: {},
        workerRequirement: {},
        goodsProduction: {},
        efficiencyBonus: 0,
        capitalGoods: {},
        capitalEfficiency: 0,
        capitalEfficiencyDecay: 0,
        ...overrides,
    }]
}

const robotizedDefaults = { prerequisites: new Set(["synteticLifeformUnit"]) }

function createRobotized(descOverride?: string): ["robotized", ProductionMethod] {
    return createMethod("robotized", {
        desc: descOverride || "The most complicated parts of the manufacturing processes are handled by highly specialized purpose built robots, the most complicated parts are still done by human workers",
        ...robotizedDefaults,
        workerMultiplier: 0.4,
        efficiencyMultiplier: 1.3,
        capitalMultiplier: 1.2,
    })
}

function createFullyRobotized(descOverride?: string): ["robotized", ProductionMethod] {
    return createMethod("robotized", {
        desc: descOverride || "Very high performance equipment handled by a robotic workforce, only few human supervisors are needed",
        ...robotizedDefaults,
        workerMultiplier: 0.25,
        efficiencyMultiplier: 1.6,
        capitalMultiplier: 1.4,
    })
}

function createTraditional(descOverride?: string): ["traditional", ProductionMethod] {
    return createMethod("traditional", {
        desc: descOverride || "Traditional manufacturing processes, all parts are handled by human workers",
        workerMultiplier: 1.0,
        efficiencyMultiplier: 1.0,
        capitalMultiplier: 1.0,
    })
}

const workerReqStandard = { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 } as const
const usualNonEssentialGoods = new Set<keyof Goods>(["governance", "water", "vehicles", "energy", "services", "environmentFactor"])

export const industrySectorBlueprints = new Map<keyof IndustrialSectors, SectorBlueprint>([
    ["oilRig", ({
        name: "oilRig", goodsRequirements: {
            environmentFactor: 20, energy: 10, governance: 20
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { oil: 5_000, waste: 20 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, },
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("dieselEngines", { desc: "Traditional machinery powered by onsite diesel motors" }),
            createMethod("nuclear", { desc: "Laser mining lasers powered by onsite nuclear reactors" }),
            createMethod("tylium", { desc: "Very high power mining lasers powered by onsite tylium reactors" }),
            createMethod("robotized", { desc: "Very high power mining equipment handled by a robotic workforce, only few human supervisors are needed" }),
        ])
    })],
    ["forestry", ({
        name: "forestry", goodsRequirements: {
            chemicals: 30, governance: 20
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { lumber: 500_000, environmentFactor: 1_000_00 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, vehicles: 0.1 },
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createTraditional("Traditional forestry, "),
            createMethod("Forestry with hunting", {
                goodsProduction: {
                    agriculturalGoods: 2_000,
                    environmentFactor: 1_100_00
                }
            }),
        ])
    })],
    ["farm", ({
        name: "farm", goodsRequirements: {
            governance: 20,
        }, workerRequirement: {
            farmer: 900, clerks: 50, engineer: 50, healtcarePersonal: 10
        }, goodsProduction: { agriculturalGoods: 100_000, },
        efficiencyBonus: 0.01,
        nonEssentialGoods: usualNonEssentialGoods,
        capitalGoods: { machinery: 0.5, buildings: 0.1, vehicles: 1 },
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }),
            createMethod("hydroponics", { desc: "hydroponics" }),
            createMethod("withWatering", { desc: "With artificial watering", goodsRequirements: { water: 40, environmentFactor: 10 } }),
            createMethod("withWatering", { desc: "With artificial watering and ", goodsRequirements: { water: 40, chemicals: 80, environmentFactor: 20 } }),
        ])
    })],
    ["fishery", {
        name: "fishery", goodsRequirements: {
            governance: 2,
            environmentFactor: 2,
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { agriculturalGoods: 300_000 },
        capitalGoods: { machinery: 0.5, buildings: 0.1, vehicles: 0.1 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }),
        ])
    }],
    ["foodFactory", ({
        name: "foodFactory",
        goodsRequirements: { environmentFactor: 20, agriculturalGoods: 200, governance: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { food: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["waterTreatment", ({
        name: "waterTreatment", goodsRequirements: {
            environmentFactor: 20, energy: 200, governance: 20
        },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }, goodsProduction: { water: 1_000_000 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: new Set([...usualNonEssentialGoods, "chemicals"]),
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }),
            createMethod("With advanced chemical processes", {
                desc: "It can create more drinking water even from bad quality water",
                goodsRequirements: { chemicals: 80, environmentFactor: 20 },
                goodsProduction: { water: 1_500_000 }
            })
        ])
    })],
    ["powerPlant", ({
        name: "powerPlant", goodsRequirements: {
            environmentFactor: 20,
            governance: 20,
        },
        workerRequirement: {
            worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10
        }, goodsProduction: { energy: 400_000, waste: 10 },
        efficiencyBonus: 0.01,
        nonEssentialGoods: usualNonEssentialGoods,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        productionMethods: new Map([
            createMethod("Fossil", { desc: "Fossil", goodsRequirements: { oil: 140 } }),
            createMethod("Nuclear", { desc: "Nuclear energy generation", goodsRequirements: { fissionMaterial: 5 } }),
        ])
    })],
    ["metalFactory", ({
        name: "metalFactory", goodsRequirements: {
            environmentFactor: 30,
            energy: 200,
            governance: 20,
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { metals: 100_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.08, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods
    })],
    ["machineryFactory", ({
        name: "machineryFactory", goodsRequirements: {
            environmentFactor: 20,
            metals: 80,
            energy: 150,
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
        capitalGoods: { buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["medicineFactory", ({
        name: "medicineFactory", goodsRequirements: {
            environmentFactor: 20,
            chemicals: 50, energy: 140, governance: 20
        }, workerRequirement: { worker: 850, scientist: 50, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { medicine: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.2, },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["consumerFactory", ({
        name: "consumerFactory", goodsRequirements: {
            environmentFactor: 20,
            chemicals: 60,
            energy: 220,
            governance: 20,
        }, workerRequirement: { worker: 890 * 4, clerks: 50 * 4, engineer: 50 * 4, healtcarePersonal: 10 * 4 },
        goodsProduction: { consumerGoods: 500_000 * 4 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 2, buildings: 0.1 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["spaceInfrastructure", ({
        name: "spaceport", goodsRequirements: {
            energy: 250,
            governance: 20,
            environmentFactor: 20,
        }, workerRequirement: { worker: 790, clerks: 50, engineer: 50, scientist: 100, healtcarePersonal: 10 },
        goodsProduction: { spaceShips: 50 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["spaceShips", ({
        name: "spaceShipyard", goodsRequirements: { environmentFactor: 20, energy: 280, governance: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { spaceShips: 8_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 1, metals: 0.8, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["construction", ({
        name: "construction", goodsRequirements: {
            energy: 40,
            governance: 20,
            environmentFactor: 30,
            water: 100,
            lumber: 100,
            metals: 100
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { buildings: 100_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6 },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["services", ({
        name: "services", goodsRequirements: {
            environmentFactor: 10,
            energy: 220,
            consumerGoods: 80,
            governance: 20
        },
        workerRequirement: { healtcarePersonal: 10, serviceWorker: 940, clergy: 50 },
        goodsProduction: { services: 500_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["tourism", ({
        name: "tourism",
        goodsRequirements: {
            environmentFactor: 30, food: 60, governance: 20
        }, workerRequirement: { worker: 200, clerks: 50, serviceWorker: 700, healtcarePersonal: 50 }, goodsProduction: { tourism: 1_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["education", ({
        name: "education", goodsRequirements: {
            energy: 100, governance: 20,
        }, workerRequirement: { teacher: 890, clerks: 100, worker: 50, healtcarePersonal: 10 },
        goodsProduction: { education: 300_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }),
            createFullyRobotized("All of the non teaching staff is replaced by robots, because teachers are still cheaper")
        ])
    })],
    ["healthcare", ({
        name: "healthcare", goodsRequirements: {
            medicine: 30, energy: 80, governance: 20
        }, workerRequirement: { healtcarePersonal: 900, clerks: 50, worker: 50 }, goodsProduction: { healthcare: 2_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, machinery: 0.2, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }), createFullyRobotized()
        ])
    })],
    ["environmentControl", ({
        name: "environmentControl",
        goodsRequirements: {
            energy: 140, medicine: 30, chemicals: 30, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10, },
        goodsProduction: { environmentFactor: 3_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.3, buildings: 0.2, },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.08,
    })],
    ["chemical", ({
        name: "chemical", goodsRequirements: {
            environmentFactor: 30, oil: 80, energy: 150, governance: 20
        }, workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { chemicals: 70_000, waste: 40 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["bank", ({
        name: "bank", goodsRequirements: {
            energy: 140, governance: 20
        }, workerRequirement: { worker: 190, clerks: 800, healtcarePersonal: 10 }, goodsProduction: { monetaryServices: 800_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2, vehicles: 0.01 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["religion", ({
        name: "religion",
        goodsRequirements: {
            governance: 20
        }, workerRequirement: { clergy: 890, clerks: 50, worker: 50, healtcarePersonal: 10 }, goodsProduction: { faith: 2_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.2 },
        capitalEfficiency: 0.0006,
        capitalEfficiencyDecay: 0.0006,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["lawEnforcement", ({
        name: "lawEnforcement",
        goodsRequirements: { energy: 120, governance: 20 },
        workerRequirement: { policeMen: 890, worker: 50, clerks: 50, healtcarePersonal: 10 },
        goodsProduction: { lawEnforcement: 800_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("traditional", { desc: "Traditional" }),
            createFullyRobotized("The future of law enforcement is here!")
        ])
    })],
    ["nuclearSector", ({
        name: "nuclearSector", goodsRequirements:
            { governance: 20, environmentFactor: 10 },
        workerRequirement: { scientist: 50, worker: 690, clerks: 50, engineer: 200, healtcarePersonal: 10 },
        goodsProduction: { fissionMaterial: 500, waste: 30, energy: 10_000_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 1, buildings: 0.1, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.1,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createMethod("Weapon grade only", { desc: "Creating only weapon grade fission material" }),
            createMethod("Energy production")
        ])
    })],
    ["recycling", ({
        name: "recycling",
        goodsRequirements: { waste: 200, energy: 40, governance: 20, environmentFactor: 20, },
        workerRequirement: workerReqStandard,
        goodsProduction: { metals: 60, lumber: 40, water: 300, chemicals: 20, oil: 40 },
        capitalGoods: { machinery: 0.4, buildings: 0.1, },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["government", ({
        name: "government",
        goodsRequirements: { environmentFactor: 10, energy: 100, paper: 10 },
        workerRequirement: { clerks: 790, worker: 200, healtcarePersonal: 10 },
        goodsProduction: { governance: 150_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 0.1, },
        capitalEfficiency: 0.0005,
        capitalEfficiencyDecay: 0.0005,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["automotive", ({
        name: "automotive",
        goodsRequirements: {
            environmentFactor: 30,
            oil: 60,
            energy: 150,
            water: 20,
            governance: 20,
        },
        workerRequirement: { worker: 890, scientist: 50, clerks: 50, healtcarePersonal: 10 },
        goodsProduction: { vehicles: 150_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, metals: 0.5 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["paperFactory", ({
        name: "paperFactory",
        goodsRequirements: { environmentFactor: 30, lumber: 200, chemicals: 80, energy: 160, governance: 20 },
        workerRequirement: workerReqStandard,
        goodsProduction: { paper: 20_00_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, buildings: 0.1, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["logistics", ({
        name: "logistics",
        goodsRequirements: { environmentFactor: 20, energy: 150, governance: 20, paper: 100 },
        workerRequirement: { worker: 790, clerks: 50, serviceWorker: 150, healtcarePersonal: 10 },
        goodsProduction: { logistics: 15000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { vehicles: 5, machinery: 0.5, buildings: 0.1, },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["entertainmentIndustry", ({
        name: "entertainmentIndustry",
        goodsRequirements: {
            environmentFactor: 20, energy: 150, governance: 2, paper: 100
        },
        workerRequirement: { worker: 490, clerks: 50, engineer: 50, serviceWorker: 400, healtcarePersonal: 10 },
        goodsProduction: { entertainment: 1_000_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.4, buildings: 0.1, },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["defense", ({
        name: "defense",
        goodsRequirements: {
            militaryEquipment: 10,
            energy: 15,
            governance: 2,
        },
        workerRequirement: { serviceMan: 850, clerks: 50, healtcarePersonal: 50, engineer: 50 },
        goodsProduction: { defense: 2000000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.8, militaryEquipment: 5, buildings: 0.1, },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods,
        productionMethods: new Map([
            createTraditional(),
            createFullyRobotized("A fully autonomus robot army, lead by powerful AIs, which can wage wars without any human intervention. May the Gods have mercy on -our- *their enemies.")
        ])
    })],
    ["militaryEquipment", ({
        name: "weaponFactory", goodsRequirements: { environmentFactor: 20, energy: 200, governance: 20 },
        workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { militaryEquipment: 50_000 },
        efficiencyBonus: 0.01,
        capitalGoods: { machinery: 0.6, metals: 0.5, buildings: 0.1 },
        capitalEfficiency: 0.001,
        capitalEfficiencyDecay: 0.001,
        nonEssentialGoods: usualNonEssentialGoods,
    })],
    ["mobility", ({
        name: "mobility",
        goodsRequirements: {
            environmentFactor: 20,
            oil: 500,
            energy: 10,
            governance: 20
        },
        workerRequirement: { worker: 804, clerks: 50, serviceWorker: 50, engineer: 50, healtcarePersonal: 10 },
        goodsProduction: { mobility: 15_000, waste: 10 },
        efficiencyBonus: 0.01,
        capitalGoods: { buildings: 100, governance: 20, vehicles: 100, },
        capitalEfficiency: 0.0008,
        capitalEfficiencyDecay: 0.0008,
        nonEssentialGoods: usualNonEssentialGoods,
    })]
])

industrySectorBlueprints.forEach((sector) => {
    if(sector.productionMethods === undefined) sector.productionMethods = new Map([createFullyRobotized(), createRobotized(), createTraditional()])
})