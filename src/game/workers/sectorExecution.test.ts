import { describe, it, expect } from "vitest"
import { applyGoodConstraint, executeSectors } from "./sectorExecution"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import type { Population } from "../data/Population"
import type { Goods } from "../data/Goods"
import type { SectorBid } from "./SectorBid"

function makePopulation(overrides: Partial<Population> = {}): Population {
    const createBreakdown = (number: number): any => ({
        number,
        wealth: 1,
        wealthLevel: 1,
        qol: 50,
        expectedQol: 50,
        populationChange: 0,
        mortality: 0,
        salary: 200,
        birthRate: 0,
    })
    return {
        farmer: createBreakdown(100),
        scientist: createBreakdown(100),
        worker: createBreakdown(1000),
        student: createBreakdown(100),
        healtcarePersonal: createBreakdown(100),
        policeMen: createBreakdown(100),
        teacher: createBreakdown(100),
        serviceWorker: createBreakdown(100),
        clergy: createBreakdown(100),
        retired: createBreakdown(100),
        clerks: createBreakdown(100),
        engineer: createBreakdown(100),
        stayAtHome: createBreakdown(500),
        serviceMan: createBreakdown(100),
        ...overrides,
    } as Population
}

function populationWorker(number: number): Partial<Population> {
    return { worker: createBreakdownHelper(number) }
}

function createBreakdownHelper(number: number): any {
    return {
        number,
        wealth: 1,
        wealthLevel: 1,
        qol: 50,
        expectedQol: 50,
        populationChange: 0,
        mortality: 0,
        salary: 200,
        birthRate: 0,
    }
}

function makeGoods(overrides: Partial<Goods> = {}): Goods {
    return {
        food: 0,
        tourism: 0,
        consumerGoods: 0,
        water: 0,
        energy: 0,
        services: 0,
        agriculturalGoods: 0,
        tylium: 0,
        metals: 0,
        fissionMaterial: 0,
        machinery: 0,
        medicine: 0,
        lumber: 0,
        oil: 0,
        spaceShips: 0,
        nuclearWeapons: 0,
        vehicles: 0,
        environmentFactor: 0,
        faith: 0,
        healthcare: 0,
        chemicals: 0,
        buildings: 0,
        waste: 0,
        logistics: 0,
        paper: 0,
        entertainment: 0,
        education: 0,
        monetaryServices: 0,
        mobility: 0,
        militaryEquipment: 0,
        ...overrides,
    }
}

function makeSectorBid(overrides: Partial<SectorBid> = {}): SectorBid {
    return {
        name: "testSector",
        level: 1,
        budgetRatio: 1,
        actualScale: 1,
        inputCost: 0,
        laborCost: 0,
        capitalMultiplier: 1,
        idealWorkerDemand: {},
        idealGoodsDemand: {},
        idealGoodsProduction: {},
        nonEssentialGoods: new Set<keyof Goods>(),
        outputLevel: 1,
        inputLevel: 1,
        ...overrides,
    }
}

const basePrices: Record<string, number> = {
    oil: 100,
    paper: 20,
    environmentFactor: 50,
    governance: 40,
    machinery: 50,
    electronics: 60,
    buildings: 20,
    water: 10,
}

const baseSalaries: Record<string, number> = {
    worker: 200,
    clerks: 500,
    engineer: 500,
    healtcarePersonal: 500,
}

describe("applyGoodConstraint", () => {
    const emptyMarketRatios: Record<string, number> = {}

    it("returns currentConstraint when market ratio is 1 and inventory covers demand", () => {
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 1000 } as any, false)
        expect(result).toBe(1)
    })

    it("returns market ratio when market constraint is the limiting factor", () => {
        const result = applyGoodConstraint(1, "oil", 100, { oil: 0.3 } as any, { oil: 50 } as any, false)
        expect(result).toBeCloseTo(0.3)
    })

    it("applies inventory constraint when inventory is scarce (essential good)", () => {
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 10 } as any, false)
        expect(result).toBeCloseTo(0.1)
    })

    it("applies inventory constraint for non-essential goods (no floor)", () => {
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 10 } as any, true)
        expect(result).toBeCloseTo(0.1)
    })

    it("takes minimum of marketConstraint and inventoryConstraint", () => {
        const result = applyGoodConstraint(1, "oil", 1000, { oil: 0.8 } as any, { oil: 100 } as any, false)
        expect(result).toBeCloseTo(0.1)
    })

    it("handles zero demandPerTick", () => {
        const result = applyGoodConstraint(0.5, "oil", 0, emptyMarketRatios, {} as any, false)
        expect(result).toBe(0.5)
    })
})

describe("executeSectors", () => {
    const emptyPopulation = createStarterPopulation(0)

    it("handles empty sector bids", () => {
        const result = executeSectors(
            [],
            emptyPopulation,
            {} as any,
            // makeGoods(),
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorResults).toEqual({})
        expect(result.sectorProfits).toEqual({})
        expect(result.sectorRevenue).toEqual({})
        expect(result.sectorLaborCosts).toEqual({})
        expect(result.sectorInputCosts).toEqual({})
        expect(result.sectorUtilization).toEqual({})
        expect(result.sectorStopReason).toEqual({})
        expect(result.sumGoodsRequirements).toEqual(makeGoods())
        expect(result.sumGoodsProduction).toEqual(makeGoods())
    })

    it("executes a single sector with full scale", () => {
        const bid = makeSectorBid({
            name: "powerPlant",
            actualScale: 1,
            idealGoodsDemand: { oil: 100 },
            idealGoodsProduction: { energy: 50 },
            idealWorkerDemand: { worker: 100, clerks: 10 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 10000 })
        const inputSectorGoods = { powerPlant: makeGoods({ oil: 500 }) } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // Consumed goods should reflect actual consumption
        expect(result.sectorResults["powerPlant"]?.consumedGoods).toEqual({ oil: 100 })
        expect(result.sectorResults["powerPlant"]?.producedGoods).toEqual({ energy: 50 })
        expect(result.sectorResults["powerPlant"]?.workersEmployed).toEqual({ worker: 100, clerks: 10 })
        expect(result.sectorResults["powerPlant"]?.productionRatio).toBe(1)

        // Revenue = energy * price = 50 * 20 = 1000
        // Input costs = 100 * 100 = 10000
        expect(result.sectorInputCosts["powerPlant"]).toBeCloseTo(10000)

        // Labor costs = 100 * 200 + 10 * 500 = 20000 + 5000 = 25000
        expect(result.sectorLaborCosts["powerPlant"]).toBeCloseTo(25000)

        // Workers should be deducted from remaining
        expect(result.remainingWorkers.worker.number).toBe(900)
        expect(result.remainingWorkers.clerks.number).toBe(90)
    })

    it("does not auto-generate revenue from production (revenue comes from sales)", () => {
        const bid = makeSectorBid({
            name: "oilRig",
            actualScale: 1,
            idealGoodsProduction: { oil: 50 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { oilRig: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // Revenue comes from actual sales (allocatePopulationSales), not production volume
        expect(result.sectorRevenue["oilRig"]).toBeCloseTo(0)
        // Profit starts as negative costs (no input or labor costs here)
        expect(result.sectorProfits["oilRig"]).toBeCloseTo(0)
    })

    it("calculates costs-only profit (revenue added later from sales)", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            idealGoodsDemand: { oil: 10 },
            idealGoodsProduction: { paper: 100 },
            idealWorkerDemand: { worker: 5 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 1000 })
        const inputSectorGoods = { factory: makeGoods({ oil: 100 }) } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // Revenue = 0 (comes from allocatePopulationSales later)
        // Input costs = 10 * 100 = 1000
        // Labor costs = 5 * 200 = 1000
        // Profit = -(1000 + 1000) = -2000 (revenue added later)
        expect(result.sectorRevenue["factory"]).toBeCloseTo(0)
        expect(result.sectorInputCosts["factory"]).toBeCloseTo(1000)
        expect(result.sectorLaborCosts["factory"]).toBeCloseTo(1000)
        expect(result.sectorProfits["factory"]).toBeCloseTo(-2000)
    })

    it("stopped sector (actualScale = 0) produces no goods and has stop reason", () => {
        const bid = makeSectorBid({
            name: "stoppedPlant",
            actualScale: 0,
            budgetRatio: 0,
            idealGoodsDemand: { oil: 100 },
            idealGoodsProduction: {},
            idealWorkerDemand: { worker: 10 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { stoppedPlant: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorResults["stoppedPlant"]?.productionRatio).toBe(0)
        expect(result.sectorResults["stoppedPlant"]?.consumedGoods).toEqual({})
        expect(result.sectorResults["stoppedPlant"]?.producedGoods).toEqual({})
        expect(result.sectorResults["stoppedPlant"]?.workersEmployed).toEqual({})
        expect(result.sectorStopReason["stoppedPlant"]).toBe("No money")
        // sectorUtilization is 0 for stopped sectors (actualScale <= 0)
        expect(result.sectorUtilization["stoppedPlant"]).toBe(0)
    })

    it("determines stop reason as No workers when zero workers available", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 0,
            budgetRatio: 1,
            idealGoodsDemand: {},
            idealWorkerDemand: { worker: 10 }, // any demand > 0 with 0 available
        })

        const population = makePopulation({ ...populationWorker(0) })
        const colonyGoods = makeGoods()
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("Bottlenecked")
    })

    it("determines stop reason as No materials when zero goods available", () => {
        const bid = makeSectorBid({
            name: "factory",
            budgetRatio: 1,
            idealGoodsDemand: { oil: 100 },
            idealWorkerDemand: {},
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 0 }) // zero available
        const inputSectorGoods = { factory: makeGoods({ oil: 0 }) } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("No materials")
    })

    it("determines stop reason as Bottlenecked when scale <= 0 but all resources available", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 0,
            budgetRatio: 1,
            idealGoodsDemand: {},
            idealWorkerDemand: {},
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("Bottlenecked")
    })

    it("determines stop reason as Low budget when budgetRatio < actualScale", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 0.5, // budget constrains production
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("Low budget")
    })

    it("determines stop reason as Worker shortage when workers are the bottleneck", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 1,
            idealGoodsDemand: {},
            idealWorkerDemand: { worker: 2000 }, // more than remaining 1000
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("Worker shortage")
    })

    it("determines stop reason as Material shortage when goods are the bottleneck", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 1,
            idealGoodsDemand: { oil: 5000 }, // more than available 1000
            idealWorkerDemand: {},
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 1000 })
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sectorStopReason["factory"]).toBe("Material shortage")
    })

    it("tracks remaining workers across multiple sectors", () => {
        const bid1 = makeSectorBid({
            name: "sector1",
            actualScale: 1,
            idealWorkerDemand: { worker: 300 },
        })
        const bid2 = makeSectorBid({
            name: "sector2",
            actualScale: 1,
            idealWorkerDemand: { worker: 400 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = {
            sector1: makeGoods(),
            sector2: makeGoods(),
        } as any

        const result = executeSectors(
            [bid1, bid2],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // 1000 - 300 - 400 = 300 remaining
        expect(result.remainingWorkers.worker.number).toBe(300)
        // Working workers accumulated: 300 + 400 = 700
        expect(result.workingWorkers.worker.number).toBe(700)
    })

    it("accumulates sumGoodsRequirements across sectors", () => {
        const bid1 = makeSectorBid({
            name: "sector1",
            actualScale: 1,
            idealGoodsDemand: { oil: 100, paper: 50 },
        })
        const bid2 = makeSectorBid({
            name: "sector2",
            actualScale: 1,
            idealGoodsDemand: { oil: 200 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 10000, paper: 1000 })
        const inputSectorGoods = {
            sector1: makeGoods(),
            sector2: makeGoods(),
        } as any

        const result = executeSectors(
            [bid1, bid2],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sumGoodsRequirements.oil).toBeCloseTo(300)
        expect(result.sumGoodsRequirements.paper).toBeCloseTo(50)
    })

    it("accumulates sumGoodsProduction across sectors", () => {
        const bid1 = makeSectorBid({
            name: "sector1",
            actualScale: 1,
            idealGoodsProduction: { energy: 100 },
        })
        const bid2 = makeSectorBid({
            name: "sector2",
            actualScale: 1,
            idealGoodsProduction: { energy: 200 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = {
            sector1: makeGoods(),
            sector2: makeGoods(),
        } as any

        const result = executeSectors(
            [bid1, bid2],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        expect(result.sumGoodsProduction.energy).toBeCloseTo(300)
    })

    it("finalizes stayAtHome as always working", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            idealGoodsDemand: {},
            idealWorkerDemand: {},
        })

        const population = makePopulation()
        const colonyGoods = makeGoods()
        const inputSectorGoods = { factory: makeGoods() } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // stayAtHome should be set to full population number
        expect(result.workingWorkers.stayAtHome.number).toBe(500)
        // stayAtHome remaining should be 0
        expect(result.remainingWorkers.stayAtHome.number).toBe(0)
    })

    it("scales consumption by actualScale", () => {
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 0.5, // half production
            idealGoodsDemand: { oil: 100 },
            idealGoodsProduction: { paper: 200 },
            idealWorkerDemand: { worker: 100 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 10000 })
        const inputSectorGoods = { powerPlant: makeGoods({ oil: 500 }) } as any

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            // inputSectorGoods,
            basePrices as any,
            baseSalaries as any,
        )

        // Consumed: 100 * 0.5 = 50 oil
        expect(result.sectorResults["factory"]?.consumedGoods).toEqual({ oil: 50 })
        // Produced: 200 * 0.5 = 100 paper
        expect(result.sectorResults["factory"]?.producedGoods).toEqual({ paper: 100 })
        // Workers: 100 * 0.5 = 50
        expect(result.sectorResults["factory"]?.workersEmployed).toEqual({ worker: 50 })
        expect(result.sectorResults["factory"]?.productionRatio).toBe(0.5)
    })

    it("does not consume more goods than available in inventory", () => {
        // demand=1000 but 0 oil available in colony goods
        const bid = makeSectorBid({
            name: "powerPlant",
            actualScale: 1,
            idealGoodsDemand: { oil: 1000 },
        })

        const population = makePopulation()
        const colonyGoods = makeGoods() // oil: 0

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            basePrices,
            baseSalaries,
        )

        // With zero inventory, the sector cannot execute at all
        expect(result.sectorResults["powerPlant"]?.consumedGoods).toEqual({})
        expect(result.sectorResults["powerPlant"]?.productionRatio).toBe(0)
        expect(result.sectorStopReason["powerPlant"]).toBe("No materials")
    })

    it("aggregate sumGoodsRequirements matches per-sector consumedGoods", () => {
        // Reconciles the aggregate accounting fields against individual
        // sector results, catching any divergence between sumGoodsRequirements
        // / sumGoodsProduction and the per-sector consumedGoods / producedGoods.
        const bids = [
            makeSectorBid({
                name: "powerPlant",
                actualScale: 1,
                idealGoodsDemand: { oil: 100 },
                idealGoodsProduction: { energy: 50 },
                idealWorkerDemand: { worker: 10 },
            }),
            makeSectorBid({
                name: "factory",
                actualScale: 0.5,
                idealGoodsDemand: { oil: 200 },
                idealGoodsProduction: { consumerGoods: 30 },
                idealWorkerDemand: { worker: 20 },
            }),
        ]

        const population = makePopulation()
        const colonyGoods = makeGoods({ oil: 100000 })
        const result = executeSectors(
            bids,
            population,
            colonyGoods,
            basePrices as any,
            baseSalaries as any,
        )

        const consumed: Partial<Goods> = {}
        const produced: Partial<Goods> = {}

        for(const sector of Object.values(result.sectorResults)) {
            for(const [key, amount] of Object.entries(
                sector.consumedGoods ?? {},
            )) {
                const good = key as keyof Goods
                consumed[good] = (consumed[good] ?? 0) + (amount ?? 0)
            }
            for(const [key, amount] of Object.entries(
                sector.producedGoods ?? {},
            )) {
                const good = key as keyof Goods
                produced[good] = (produced[good] ?? 0) + (amount ?? 0)
            }
        }

        const requirementKeys = Object.keys(result.sumGoodsRequirements) as (keyof Goods)[]
        for(const key of requirementKeys) {
            expect(result.sumGoodsRequirements[key] ?? 0).toBeCloseTo(
                consumed[key] ?? 0,
                8,
            )
        }

        const productionKeys = Object.keys(result.sumGoodsProduction) as (keyof Goods)[]
        for(const key of productionKeys) {
            expect(result.sumGoodsProduction[key] ?? 0).toBeCloseTo(
                produced[key] ?? 0,
                8,
            )
        }
    })

    it("deterministic partial purchase: two inputs scaled proportionally", () => {
        // Sector demands 10 oil + 5 machinery per tick at full scale, produces 500 paper.
        // Partial purchase: 5 oil + 2.5 machinery (50% each) → materialRatio = 0.5,
        // finalScale = actualScale(1) * materialRatio(0.5) = 0.5.
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 1,
            idealGoodsDemand: { oil: 10, machinery: 5 },
            idealGoodsProduction: { paper: 500 },
            idealWorkerDemand: { worker: 5 },
        })

        const population = makePopulation({ worker: createBreakdownHelper(1000) })
        const colonyGoods = makeGoods({ oil: 1000, machinery: 1000 })

        const purchasedBySector = {
            factory: { oil: 5, machinery: 2.5 },
        } as Record<string, Partial<Record<keyof Goods, number>>>

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            basePrices as any,
            baseSalaries as any,
            undefined,
            purchasedBySector,
        )

        const sectorResult = result.sectorResults["factory"]

        // Material ratio = min(5/10, 2.5/5) = 0.5
        expect(sectorResult.productionRatio).toBeCloseTo(0.5, 8)
        expect(result.sectorUtilization["factory"]).toBeCloseTo(0.5, 8)

        // Consumed goods scaled by finalScale: demand * 0.5
        expect(sectorResult.consumedGoods.oil).toBeCloseTo(5, 8)
        expect(sectorResult.consumedGoods.machinery).toBeCloseTo(2.5, 8)

        // Produced goods scaled by finalScale: output * 0.5
        expect(sectorResult.producedGoods.paper).toBeCloseTo(250, 8)

        // Aggregate sums match per-sector values
        expect(result.sumGoodsRequirements.oil).toBeCloseTo(5, 8)
        expect(result.sumGoodsRequirements.machinery).toBeCloseTo(2.5, 8)
        expect(result.sumGoodsProduction.paper).toBeCloseTo(250, 8)

        // No unaccounted goods in aggregates
        for(const key of Object.keys(result.sumGoodsRequirements) as (keyof Goods)[]) {
            if(key === "oil" || key === "machinery") continue
            expect(result.sumGoodsRequirements[key]).toBeCloseTo(0, 8)
        }
        for(const key of Object.keys(result.sumGoodsProduction) as (keyof Goods)[]) {
            if(key === "paper") continue
            expect(result.sumGoodsProduction[key]).toBeCloseTo(0, 8)
        }
    })

    it("deterministic full purchase: two inputs consumed at full scale", () => {
        // Full purchase → materialRatio = 1, finalScale = actualScale(1) * 1 = 1.
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 1,
            idealGoodsDemand: { oil: 10, machinery: 5 },
            idealGoodsProduction: { paper: 500 },
            idealWorkerDemand: { worker: 5 },
        })

        const population = makePopulation({ worker: createBreakdownHelper(1000) })
        const colonyGoods = makeGoods({ oil: 1000, machinery: 1000 })

        const purchasedBySector = {
            factory: { oil: 10, machinery: 5 },
        } as Record<string, Partial<Record<keyof Goods, number>>>

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            basePrices as any,
            baseSalaries as any,
            undefined,
            purchasedBySector,
        )

        const sectorResult = result.sectorResults["factory"]

        expect(sectorResult.productionRatio).toBeCloseTo(1, 8)
        expect(sectorResult.consumedGoods.oil).toBeCloseTo(10, 8)
        expect(sectorResult.consumedGoods.machinery).toBeCloseTo(5, 8)
        expect(sectorResult.producedGoods.paper).toBeCloseTo(500, 8)
        expect(result.sumGoodsRequirements.oil).toBeCloseTo(10, 8)
        expect(result.sumGoodsRequirements.machinery).toBeCloseTo(5, 8)
        expect(result.sumGoodsProduction.paper).toBeCloseTo(500, 8)
    })

    it("deterministic bottleneck: one input limiting, finalScale reflects bottleneck", () => {
        // oil at 50%, machinery at 100% → materialRatio = 0.5 (oil limits)
        const bid = makeSectorBid({
            name: "factory",
            actualScale: 1,
            budgetRatio: 1,
            idealGoodsDemand: { oil: 10, machinery: 5 },
            idealGoodsProduction: { paper: 500 },
            idealWorkerDemand: { worker: 5 },
        })

        const population = makePopulation({ worker: createBreakdownHelper(1000) })
        const colonyGoods = makeGoods({ oil: 1000, machinery: 1000 })

        const purchasedBySector = {
            factory: { oil: 5, machinery: 5 },
        } as Record<string, Partial<Record<keyof Goods, number>>>

        const result = executeSectors(
            [bid],
            population,
            colonyGoods,
            basePrices as any,
            baseSalaries as any,
            undefined,
            purchasedBySector,
        )

        const sectorResult = result.sectorResults["factory"]

        // oil: 5/10 = 0.5, machinery: 5/5 = 1 → materialRatio = min(0.5, 1) = 0.5
        expect(sectorResult.productionRatio).toBeCloseTo(0.5, 8)
        expect(sectorResult.consumedGoods.oil).toBeCloseTo(5, 8)
        expect(sectorResult.consumedGoods.machinery).toBeCloseTo(2.5, 8)
        expect(sectorResult.producedGoods.paper).toBeCloseTo(250, 8)
    })
})
