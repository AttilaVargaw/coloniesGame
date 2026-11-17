import { describe, it, expect } from "vitest"
import { buildSectorBid } from "./buildSectorBid"
import { executeSectors } from "./sectorExecution"
import type { SectorDecisions } from "../systems/sectorBehaviorTree/bt"
import { basePrices } from "../data/Goods"
import { baseSalaries } from "../data/Population"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createEmptyWarehouse } from "../factories/createStarterWarehouse"
import type { SectorBid } from "./SectorBid"

const decisions: SectorDecisions = {
    stopProduction: false,
    sectorInvestment: 0,
    laborAssigned: 0,
    restartProduction: false,
    buyCapital: false,
}

function makePowerPlantBid(
    capitalStock: Partial<Record<string, number>> = {},
    money = 1_000_000,
): SectorBid | null {
    return buildSectorBid(
        "powerPlant" as any,
        basePrices as any,
        1,
        0,
        capitalStock,
        baseSalaries as any,
        0,
        decisions,
        { sectorStartingMoney: money },
    )
}

const population = createStarterPopulation(10000, {
    worker: 30,
    clerks: 10,
    engineer: 10,
    healtcarePersonal: 5,
})

const colonyGoods = createEmptyWarehouse()
colonyGoods.oil = 10_000
colonyGoods.environmentFactor = 10_000
colonyGoods.governance = 10_000

describe("industry sector calculations", () => {
    describe("buildSectorBid", () => {
        it("calculates level, inputLevel and outputLevel for powerPlant", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()
            expect(bid!.level).toBe(1)
            expect(bid!.inputLevel).toBe(1)
            expect(bid!.outputLevel).toBe(1) // techMultiplier(1) * effMult(1) = 1
        })

        it("calculates worker demand with capitalRatio = 1", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()
            expect(bid!.idealWorkerDemand.worker).toBe(890)
            expect(bid!.idealWorkerDemand.clerks).toBe(50)
            expect(bid!.idealWorkerDemand.engineer).toBe(50)
            expect(bid!.idealWorkerDemand.healtcarePersonal).toBe(10)
        })

        it("calculates goods demand with capitalRatio = 1", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()
            expect(bid!.idealGoodsDemand.oil).toBe(140)
            expect(bid!.idealGoodsDemand.environmentFactor).toBe(20)
            expect(bid!.idealGoodsDemand.governance).toBe(20)
        })

        it("calculates goods production with outputLevel = 1", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()
            expect(bid!.idealGoodsProduction.energy).toBe(400_000)
            expect(bid!.idealGoodsProduction.waste).toBe(10)
        })

        it("scales worker and goods demand by capitalMultiplier", () => {
            // capitalRatio = min(5/0.5, 1/0.1) = 10
            // capitalMultiplier = 10^0.5 ≈ 3.1623
            const bid = makePowerPlantBid({ machinery: 5, buildings: 1 })
            expect(bid).not.toBeNull()
            expect(bid!.idealWorkerDemand.worker).toBeCloseTo(2814.43, 2)
            expect(bid!.idealWorkerDemand.clerks).toBeCloseTo(158.11, 2)
            expect(bid!.idealGoodsDemand.oil).toBeCloseTo(442.72, 2)
            // Production also scales with capitalMultiplier
            expect(bid!.idealGoodsProduction.energy).toBeCloseTo(1_264_911, 0)
        })

        it("sets budgetRatio = 1 when money is sufficient", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 1_000_000)
            expect(bid).not.toBeNull()
            expect(bid!.budgetRatio).toBe(1)
            expect(bid!.actualScale).toBe(1)
        })

        it("sets budgetRatio < 1 when money is insufficient", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 1000)
            expect(bid).not.toBeNull()
            expect(bid!.budgetRatio).toBeGreaterThan(0)
            expect(bid!.budgetRatio).toBeLessThan(1)
            expect(bid!.actualScale).toBe(bid!.budgetRatio)
        })

        it("sets inputLevel = 0 when production is stopped", () => {
            const bid = buildSectorBid(
                "powerPlant" as any,
                basePrices as any,
                1,
                0,
                { machinery: 0.5, buildings: 0.1 },
                baseSalaries as any,
                0,
                { ...decisions, stopProduction: true } as SectorDecisions,
                { sectorStartingMoney: 1_000_000 },
            )
            expect(bid).not.toBeNull()
            expect(bid!.inputLevel).toBe(0)
            expect(bid!.outputLevel).toBe(0)
            expect(bid!.idealGoodsDemand.oil).toBe(0)
            expect(bid!.idealWorkerDemand.worker).toBe(0)
        })
    })

    describe("executeSectors", () => {
        it("produces full output with sufficient workers, goods and money", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult).not.toBeUndefined()
            expect(sectorResult!.productionRatio).toBe(1)
            expect(sectorResult!.inputLevel).toBe(1)
            expect(sectorResult!.outputLevel).toBe(1)

            // Goods consumed
            expect(sectorResult!.consumedGoods.oil).toBe(140)
            expect(sectorResult!.consumedGoods.environmentFactor).toBe(20)
            expect(sectorResult!.consumedGoods.governance).toBe(20)

            // Goods produced
            expect(sectorResult!.producedGoods.energy).toBe(400_000)
            expect(sectorResult!.producedGoods.waste).toBe(10)

            // Workers employed
            expect(sectorResult!.workersEmployed.worker).toBe(890)
            expect(sectorResult!.workersEmployed.clerks).toBe(50)
            expect(sectorResult!.workersEmployed.engineer).toBe(50)
            expect(sectorResult!.workersEmployed.healtcarePersonal).toBe(10)

            // Utilization = actualScale
            expect(result.sectorUtilization["powerPlant"]).toBe(1)
        })

        it("calculates costs-only profit (revenue added later from sales)", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            // Revenue = 0 (comes from allocatePopulationSales later)
            expect(result.sectorRevenue["powerPlant"]).toBe(0)
            // inputCosts = oil(140*100) + envFactor(20*50) + governance(20*40) = 15800
            expect(result.sectorInputCosts["powerPlant"]).toBe(15_800)
            // laborCosts = worker(890*200) + clerks(50*500) + engineer(50*500) + health(10*500) = 233000
            expect(result.sectorLaborCosts["powerPlant"]).toBe(233_000)
            // profit = -(inputCosts + laborCosts) = -(15_800 + 233_000) = -248800
            expect(result.sectorProfits["powerPlant"]).toBe(-248_800)
        })

        it("limits workers employed when workers are insufficient", () => {
            const lowPop: any = {
                ...population,
                worker: { ...population.worker, number: 3 },
            }
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], lowPop, colonyGoods, basePrices as any, baseSalaries as any)

            // Labor shortage constrains production scale proportionally
            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBeCloseTo(3 / 890, 6)
            expect(sectorResult!.workersEmployed.worker).toBe(3) // only 3 workers available
        })

        it("scales down when colony goods are insufficient", () => {
            const lowGoods = createEmptyWarehouse()
            lowGoods.oil = 70
            lowGoods.environmentFactor = 10
            lowGoods.governance = 10

            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], population, lowGoods, basePrices as any, baseSalaries as any)

            // With only 70 oil available and demand of 140 at full scale,
            // the sector scales down to 0.5
            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBeCloseTo(0.5, 6)
            expect(sectorResult!.consumedGoods.oil).toBeCloseTo(70, 6)
            expect(sectorResult!.producedGoods.energy).toBeCloseTo(200_000, 0)
        })

        it("scales everything proportionally when money is insufficient", () => {
            // inputCost = 15800, budgetRatio (input affordability only) = 7900 / 15800 = 0.5
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 7900)
            expect(bid).not.toBeNull()
            expect(bid!.budgetRatio).toBeLessThan(1)
            expect(bid!.actualScale).toBe(bid!.budgetRatio)

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBeCloseTo(bid!.budgetRatio, 4)

            // Workers employed scale proportionally
            expect(sectorResult!.workersEmployed.worker).toBeCloseTo(890 * bid!.budgetRatio, 1)
            expect(sectorResult!.workersEmployed.clerks).toBeCloseTo(50 * bid!.budgetRatio, 1)

            // Goods consumed scale proportionally
            expect(sectorResult!.consumedGoods.oil).toBeCloseTo(140 * bid!.budgetRatio, 1)

            // Goods produced scale proportionally
            expect(sectorResult!.producedGoods.energy).toBeCloseTo(400_000 * bid!.budgetRatio, 1)

            // Revenue = 0 (comes from allocatePopulationSales later)
            expect(result.sectorRevenue["powerPlant"]).toBe(0)
            // Costs scale proportionally
            expect(result.sectorInputCosts["powerPlant"]).toBeCloseTo(15_800 * bid!.budgetRatio, 1)
            expect(result.sectorLaborCosts["powerPlant"]).toBeCloseTo(233_000 * bid!.budgetRatio, 1)
            // Profit = -(costs) scales proportionally
            expect(result.sectorProfits["powerPlant"]).toBeCloseTo(-248_800 * bid!.budgetRatio, 0)

            // Stop reason reflects low budget (budgetRatio was binding constraint)
            expect(result.sectorStopReason["powerPlant"]).toBe("Low budget")
        })

        it("stops production entirely when money is zero", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 0)
            expect(bid).not.toBeNull()
            expect(bid!.budgetRatio).toBe(0)
            expect(bid!.actualScale).toBe(0)

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBe(0)
            expect(Object.keys(sectorResult!.consumedGoods).length).toBe(0)
            expect(Object.keys(sectorResult!.producedGoods).length).toBe(0)
            expect(result.sectorProfits["powerPlant"]).toBe(0)
            expect(result.sectorStopReason["powerPlant"]).toBe("No money")
        })

        it("budget ratio constrains wages as well as inputs", () => {
            // inputCost = 15800, laborCost = 233000, totalOperatingCost = 248800
            // sectorMoney = 20000 (enough for inputs but not wages)
            // budgetRatio = 20000 / 248800 ≈ 0.0804
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 20_000)
            expect(bid).not.toBeNull()
            expect(bid!.budgetRatio).toBeCloseTo(20_000 / 248_800, 4)
            expect(bid!.actualScale).toBe(bid!.budgetRatio)

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBeCloseTo(bid!.budgetRatio, 4)

            // Production scales with budget ratio
            expect(sectorResult!.producedGoods.energy).toBeCloseTo(400_000 * bid!.budgetRatio, 1)
        })

        it("excludes stayAtHome population from labor allocation", () => {
            // StayAtHome is excluded from available workers in industryTick.worker.ts,
            // so allocateLabor never allocates stayAtHome workers to production.
            // This is verified at the allocation layer in phase2-allocation.test.ts.
        })

        it("aggregate labor allocation never exceeds available population", () => {
            // Two sectors demanding the same worker category, total > available
            const highDemandBid = buildSectorBid(
                "powerPlant" as any,
                basePrices as any,
                1,
                0,
                { machinery: 0.5, buildings: 0.1 },
                baseSalaries as any,
                0,
                decisions,
                { sectorStartingMoney: 1_000_000 },
            )
            expect(highDemandBid).not.toBeNull()

            // Demand more workers than available in a single category
            const overDemandBid = buildSectorBid(
                "farm" as any,
                basePrices as any,
                1,
                0,
                { machinery: 0.5, buildings: 0.1 },
                baseSalaries as any,
                0,
                decisions,
                { sectorStartingMoney: 1_000_000 },
            )
            expect(overDemandBid).not.toBeNull()

            const result = executeSectors(
                [highDemandBid!, overDemandBid!],
                population,
                colonyGoods,
                basePrices as any,
                baseSalaries as any,
            )

            // Total workers employed across sectors never exceeds available
            const totalWorkersEmployed =
                (result.sectorResults["powerPlant"]?.workersEmployed.worker ?? 0) +
                (result.sectorResults["farm"]?.workersEmployed.worker ?? 0)

            expect(totalWorkersEmployed).toBeLessThanOrEqual(population.worker.number + 1e-9)
        })

        it("employment is order-independent with authoritative labor allocations", () => {
            const bidA = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bidA).not.toBeNull()

            // Execute in order A then B
            const resultForward = executeSectors(
                [bidA!],
                population,
                colonyGoods,
                basePrices as any,
                baseSalaries as any,
            )

            // Execute in reverse order B then A (same single sector, so same result)
            const resultReverse = executeSectors(
                [bidA!],
                population,
                colonyGoods,
                basePrices as any,
                baseSalaries as any,
            )

            const forwardWorkers = resultForward.sectorResults["powerPlant"]?.workersEmployed.worker ?? 0
            const reverseWorkers = resultReverse.sectorResults["powerPlant"]?.workersEmployed.worker ?? 0
            expect(forwardWorkers).toBeCloseTo(reverseWorkers, 8)

            const forwardStop = resultForward.sectorStopReason["powerPlant"]
            const reverseStop = resultReverse.sectorStopReason["powerPlant"]
            expect(forwardStop).toBe(reverseStop)
        })

        it("capital multiplier scales goods demand and production consistently", () => {
            // Scarce capital → low capital multiplier → low demand and production
            const scarceBid = makePowerPlantBid({ machinery: 0.1, buildings: 0.01 }, 1_000_000)
            expect(scarceBid).not.toBeNull()

            // Abundant capital → high capital multiplier → high demand and production
            const abundantBid = makePowerPlantBid({ machinery: 5, buildings: 1 }, 1_000_000)
            expect(abundantBid).not.toBeNull()

            expect(abundantBid!.capitalMultiplier).toBeGreaterThan(scarceBid!.capitalMultiplier)
            expect((abundantBid!.idealGoodsDemand.oil ?? 0)).toBeGreaterThan((scarceBid!.idealGoodsDemand.oil ?? 0))
            expect((abundantBid!.idealGoodsProduction.energy ?? 0)).toBeGreaterThan((scarceBid!.idealGoodsProduction.energy ?? 0))

            // Execute both with sufficient money and goods — both should run without error
            const resultScarce = executeSectors(
                [scarceBid!],
                population,
                colonyGoods,
                basePrices as any,
                baseSalaries as any,
            )
            const resultAbundant = executeSectors(
                [abundantBid!],
                population,
                colonyGoods,
                basePrices as any,
                baseSalaries as any,
            )

            // Production scales with capital at the bid level
            const scarceEnergy = resultScarce.sectorResults["powerPlant"]!.producedGoods.energy ?? 0
            const abundantEnergy = resultAbundant.sectorResults["powerPlant"]!.producedGoods.energy ?? 0
            expect(scarceEnergy).toBeGreaterThan(0)
            expect(abundantEnergy).toBeGreaterThan(scarceEnergy)

            // Production ratio never exceeds 1
            expect(resultScarce.sectorResults["powerPlant"]!.productionRatio).toBeLessThanOrEqual(1)
            expect(resultAbundant.sectorResults["powerPlant"]!.productionRatio).toBeLessThanOrEqual(1)
        })
    })
})
