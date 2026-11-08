import { describe, it, expect } from "vitest"
import { buildSectorBid } from "./buildSectorBid"
import type { SectorDecisions } from "../systems/sectorBehaviorTree/bt"

const decisions: SectorDecisions = {
    stopProduction: false,
    sectorInvestment: 0,
    laborAssigned: 0,
    restartProduction: false,
    buyCapital: false,
}

const prices: Record<string, number> = {
    oil: 100,
    paper: 20,
    environmentFactor: 50,
    governance: 40,
    machinery: 50,
    electronics: 60,
    buildings: 20,
}

const salaries: Record<string, number> = {
    worker: 10,
    clerks: 20,
    engineer: 40,
    healtcarePersonal: 20,
}

function makeBid(sectorKey: string, capitalStock: Record<string, number>, money = 1_000_000) {
    const bid = buildSectorBid(
        sectorKey as any,
        prices as any,
        1,
        0,
        capitalStock,
        salaries as any,
        0,
        decisions,
        { sectorStartingMoney: money },
    )
    return bid
}

describe("buildSectorBid capital adequacy scaling", () => {
    it("scales goods demand by capital adequacy when capital is abundant", () => {
        // powerPlant: capitalGoods = { machinery: 0.5, buildings: 0.1 }
        // With stock { machinery: 5, electronics: 1, buildings: 1 }:
        //   capitalRatio = min(5/0.5, 1/0.1, 1/0.1) = min(10, 10, 10) = 10
        //   oil demand = 140 * 1 * 10 = 1400
        const bid = makeBid("powerPlant", { machinery: 5, electronics: 1, buildings: 1 })
        expect(bid).not.toBeNull()
        expect(bid!.idealGoodsDemand.oil).toBe(1400)
    })

    it("limits goods demand when capital stock is scarce", () => {
        // powerPlant with stock { machinery: 0.1, electronics: 0.01, buildings: 0.01 }:
        //   capitalRatio = min(0.1/0.5, 0.01/0.1, 0.01/0.1) = min(0.2, 0.1, 0.1) = 0.1
        //   oil demand = 140 * 1 * 0.1 = 14
        const bid = makeBid("powerPlant", { machinery: 0.1, electronics: 0.01, buildings: 0.01 })
        expect(bid).not.toBeNull()
        expect(bid!.idealGoodsDemand.oil).toBeCloseTo(14)
    })

    it("scales goods demand to zero when capital stock is empty", () => {
        // powerPlant with empty capital stock: stock/req = 0 for all goods → capitalRatio = 0
        // No capital = no production capacity
        const bid = makeBid("powerPlant", {})
        expect(bid).not.toBeNull()
        expect(bid!.idealGoodsDemand.oil).toBe(0)
    })

    it("scales all goods requirements equally by capitalRatio", () => {
        // capitalRatio = 10: oil=140*10=1400, governance=20*10=200, environmentFactor=20*10=200
        const bid = makeBid("powerPlant", { machinery: 5, buildings: 1 }, 1_000_000)
        expect(bid).not.toBeNull()
        expect(bid!.idealGoodsDemand.governance).toBe(200)
        expect(bid!.idealGoodsDemand.environmentFactor).toBe(200)
        expect(bid!.idealGoodsDemand.oil).toBe(1400)
    })

    it("scales worker demand by capital adequacy", () => {
        // powerPlant workerRequirement: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 }
        // capitalRatio = 10: worker demand = 890 * 1 * 10 = 8900
        const bid = makeBid("powerPlant", { machinery: 5, electronics: 1, buildings: 1 }, 1_000_000)
        expect(bid).not.toBeNull()
        expect(bid!.idealWorkerDemand.worker).toBe(8900)
        expect(bid!.idealWorkerDemand.clerks).toBe(500)
        expect(bid!.idealWorkerDemand.engineer).toBe(500)
        expect(bid!.idealWorkerDemand.healtcarePersonal).toBe(100)
    })

    it("limits worker demand to zero when capital stock is empty", () => {
        const bid = makeBid("powerPlant", {})
        expect(bid).not.toBeNull()
        expect(bid!.idealWorkerDemand.worker).toBe(0)
    })

    it("uses capitalRatio of 1 for sectors without capital goods", () => {
        // metalFactory has capitalGoods: { machinery: 0.08, buildings: 0.1 }
        // With full stock: capitalRatio = min(8/0.08, 10/0.1) = min(100, 100) = 100
        // environmentFactor demand = 30 * 100 = 3000
        const bid = makeBid("metalFactory", { machinery: 8, buildings: 10 })
        expect(bid).not.toBeNull()
        expect(bid!.idealGoodsDemand.environmentFactor).toBe(3000)
    })

    it("applies inputLevel multiplier to goods demand", () => {
        // inputLevel comes from decisions.stopProduction ? 0 : 1
        // With stopProduction = true, inputLevel = 0 → all goods demand = 0
        const stoppedBid = buildSectorBid(
            "powerPlant" as any,
            prices as any,
            1,
            0,
            { machinery: 5, buildings: 1 },
            salaries as any,
            0,
            { ...decisions, stopProduction: true } as SectorDecisions,
            { sectorStartingMoney: 1_000_000 },
        )
        expect(stoppedBid).not.toBeNull()
        expect(stoppedBid!.idealGoodsDemand.oil).toBe(0)
        expect(stoppedBid!.idealWorkerDemand.worker).toBe(0)
    })

    it("uses budgetRatio as actualScale when money is insufficient", () => {
        // With money = 1000 and costPerUnit = 28100 (16000 goods + 12100 labor),
        // budgetRatio = 1000/28100 ≈ 0.0356
        const bid = makeBid("powerPlant", { machinery: 5, electronics: 1, buildings: 1 }, 1000)
        expect(bid).not.toBeNull()
        expect(bid!.budgetRatio).toBeGreaterThan(0)
        expect(bid!.budgetRatio).toBeLessThan(1)
        expect(bid!.actualScale).toBe(bid!.budgetRatio)
    })
})

describe("buildSectorBid null cases", () => {
    it("returns null for unknown sector", () => {
        const bid = buildSectorBid(
            "nonexistentSector" as any,
            prices as any,
            1,
            0,
            {},
            salaries as any,
            0,
            decisions,
        )
        expect(bid).toBeNull()
    })
})
