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

        it("calculates revenue, input costs, labor costs and profit", () => {
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], population, colonyGoods, basePrices as any, baseSalaries as any)

            // revenue = energy(400000 * 20) + waste(10 * 2) = 8_000_020
            expect(result.sectorRevenue["powerPlant"]).toBe(8_000_020)
            // inputCosts = oil(140*100) + envFactor(20*50) + governance(20*40) = 15800
            expect(result.sectorInputCosts["powerPlant"]).toBe(15_800)
            // laborCosts = worker(890*200) + clerks(50*500) + engineer(50*500) + health(10*500) = 233000
            expect(result.sectorLaborCosts["powerPlant"]).toBe(233_000)
            // profit = revenue - inputCosts - laborCosts = 8_000_020 - 15_800 - 233_000 = 7_751_220
            expect(result.sectorProfits["powerPlant"]).toBe(7_751_220)
        })

        it("limits workers employed when workers are insufficient", () => {
            const lowPop: any = {
                ...population,
                worker: { ...population.worker, number: 3 },
            }
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], lowPop, colonyGoods, basePrices as any, baseSalaries as any)

            // productionRatio stays at actualScale (budgetRatio = 1); only employed workers are capped
            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBe(1)
            expect(sectorResult!.workersEmployed.worker).toBe(3) // only 3 workers available
        })

        it("consumes full demand even when colony goods are low", () => {
            const lowGoods = createEmptyWarehouse()
            lowGoods.oil = 70
            lowGoods.environmentFactor = 10
            lowGoods.governance = 10

            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 })
            expect(bid).not.toBeNull()

            const result = executeSectors([bid!], population, lowGoods, basePrices as any, baseSalaries as any)

            // productionRatio stays at 1; goods are consumed at full demand (scaling happens upstream)
            const sectorResult = result.sectorResults["powerPlant"]
            expect(sectorResult!.productionRatio).toBe(1)
            expect(sectorResult!.consumedGoods.oil).toBe(140)
            expect(sectorResult!.producedGoods.energy).toBe(400_000)
        })

        it("scales everything proportionally when money is insufficient", () => {
            // costPerUnit = inputCost(15800) + laborCost(233000) = 248800
            // budgetRatio = 100000 / 248800 ≈ 0.4019
            const bid = makePowerPlantBid({ machinery: 0.5, buildings: 0.1 }, 100_000)
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

            // Revenue, costs and profit all scale proportionally
            expect(result.sectorRevenue["powerPlant"]).toBeCloseTo(8_000_020 * bid!.budgetRatio, 0)
            expect(result.sectorInputCosts["powerPlant"]).toBeCloseTo(15_800 * bid!.budgetRatio, 1)
            expect(result.sectorLaborCosts["powerPlant"]).toBeCloseTo(233_000 * bid!.budgetRatio, 1)
            expect(result.sectorProfits["powerPlant"]).toBeCloseTo(7_751_220 * bid!.budgetRatio, 0)

            // Stop reason reflects low budget
            expect(result.sectorStopReason["powerPlant"]).toBe("")
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
    })
})
