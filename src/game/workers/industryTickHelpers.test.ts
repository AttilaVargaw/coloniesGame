import { describe, it, expect } from "vitest"
import { allocatePopulationSales } from "./transactionLedger"
import { pruneMemory, trySetPatchField } from "./industryTickHelpers"
import { shallowDiff } from "./shallowDiff"
import type { SectorBid } from "./SectorBid"

function makeBid(name: string): SectorBid {
    return {
        name,
        level: 1,
        budgetRatio: 1,
        actualScale: 1,
        inputCost: 0,
        laborCost: 0,
        idealWorkerDemand: {},
        idealGoodsDemand: {},
        idealGoodsProduction: {},
        outputLevel: 1,
        inputLevel: 1,
    }
}

describe("allocatePopulationSales", () => {
    const prices: Record<string, number> = { food: 30, oil: 100 }

    function makeResult(name: string, produced: Record<string, number>) {
        return { [name]: { producedGoods: produced } }
    }

    function callAllocatePopulationSales(opts: {
        sectorBids: { name: string }[]
        sectorResults: Record<string, { producedGoods: Record<string, number> }>
        demandByPop: Record<string, Partial<Record<string, number>>>
        cashByPop: Record<string, number>
        prices: Record<string, number>
        availableStock?: Partial<Record<string, number>>
    }) {
        return allocatePopulationSales({
            sectorBids: opts.sectorBids,
            sectorResults: opts.sectorResults,
            demandByPop: opts.demandByPop as any,
            cashByPop: opts.cashByPop as any,
            prices: opts.prices as any,
            availableStock: opts.availableStock as any,
        })
    }

    it("caps sales at actual production when demand exceeds supply", () => {
        const bids = [makeBid("sectorA")]
        // Population demands 100 food, but sector only produces 60
        const sectorResults = makeResult("sectorA", { food: 60 })

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
        })

        // Actual sales = 60 (production), not 100 (demand)
        const totalSales = Object.values(result.salesQty).reduce(
            (sum, sq) => sum + Object.values(sq).reduce((a, b) => a + b, 0),
            0
        )
        expect(totalSales).toBe(60)

        // Unmet demand = 100 - 60 = 40
        expect(result.unmetDemandByPop.worker?.food).toBeCloseTo(40, 4)

        // Revenue = 60 * 30 = 1800
        expect(result.sectorRevenue.sectorA).toBeCloseTo(1800, 4)
    })

    it("fulfilled demand equals sum of salesQty across all sectors", () => {
        const bids = [makeBid("sectorA"), makeBid("sectorB")]
        // Two sectors produce 30 food each = 60 total; demand is 100
        const sectorResults = {
            sectorA: { producedGoods: { food: 30 } },
            sectorB: { producedGoods: { food: 30 } },
        }

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
        })

        // Each sector sells 30 (proportional: 30/60 * 100 = 50 each... wait)
        // demandCoverage = min(1, 100/60) = 1
        // soldQty = production * 1 = production for each
        // So sectorA sells 30, sectorB sells 30
        expect(result.salesQty.sectorA.food).toBe(30)
        expect(result.salesQty.sectorB.food).toBe(30)

        // Total fulfilled = 60
        const fulfilledDemandQty: Record<string, number> = {}
        for(const sectorSales of Object.values(result.salesQty)) {
            for(const [goodKey, qty] of Object.entries(sectorSales)) {
                fulfilledDemandQty[goodKey] = (fulfilledDemandQty[goodKey] ?? 0) + qty
            }
        }
        expect(fulfilledDemandQty.food).toBe(60)

        // Unmet = 40
        expect(result.unmetDemandByPop.worker?.food).toBeCloseTo(40, 4)
    })

    it("sells full demand when production exceeds demand", () => {
        const bids = [makeBid("sectorA")]
        // Sector produces 150 food, demand is 100
        const sectorResults = makeResult("sectorA", { food: 150 })

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
        })

        // Sells exactly demand (100), not all production (150)
        expect(result.salesQty.sectorA.food).toBe(100)
        expect(result.unsoldQty.sectorA.food).toBe(50)
        expect(result.unmetDemandByPop.worker?.food).toBeUndefined()
        expect(result.sectorRevenue.sectorA).toBeCloseTo(3000, 4) // 100 * 30
    })

    it("no production means all demand is unmet", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults = makeResult("sectorA", { food: 0 })

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
        })

        expect(result.salesQty.sectorA.food).toBeUndefined()
        expect(result.unmetDemandByPop.worker?.food).toBeCloseTo(100, 4)
        expect(result.sectorRevenue.sectorA).toBe(0)
    })

    it("sells zero-priced goods with zero revenue", () => {
        const zeroPrices: Record<string, number> = { food: 0, oil: 100 }
        const bids = [makeBid("sectorA")]
        // Sector produces 10 food, households demand 8, price is 0
        const sectorResults = makeResult("sectorA", { food: 10 })

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 8 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices: zeroPrices,
        })

        // 8 sold (all demand), 2 unsold, zero revenue, zero unmet
        expect(result.salesQty.sectorA.food).toBe(8)
        expect(result.unsoldQty.sectorA.food).toBe(2)
        expect(result.sectorRevenue.sectorA).toBe(0)
        expect(result.unmetDemandByPop.worker?.food).toBeUndefined()
    })

    it("sells from available stock when there is no production", () => {
        const bids = [makeBid("sectorA")]
        // No production, but 50 food in warehouse stock, demand is 30
        const sectorResults = makeResult("sectorA", { food: 0 })
        const availableStock = { food: 50 }

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 30 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
            availableStock,
        })

        // 30 sold from warehouse, 20 stock remains, zero unmet demand
        expect(result.warehouseSalesQty.food).toBe(30)
        expect(result.salesQty.sectorA.food).toBeUndefined()
        expect(result.unmetDemandByPop.worker?.food).toBeUndefined()
        expect(result.sectorRevenue.sectorA).toBe(0)
    })

    it("allocates between production and warehouse stock proportionally", () => {
        const bids = [makeBid("sectorA"), makeBid("sectorB")]
        // Sector A produces 30, sector B produces 30, warehouse has 40
        // Total supply = 100, demand = 100 → coverage = 1
        // Each sector sells 30, warehouse sells 40
        const sectorResults = {
            sectorA: { producedGoods: { food: 30 } },
            sectorB: { producedGoods: { food: 30 } },
        }
        const availableStock = { food: 40 }

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
            availableStock,
        })

        expect(result.salesQty.sectorA.food).toBe(30)
        expect(result.salesQty.sectorB.food).toBe(30)
        expect(result.warehouseSalesQty.food).toBe(40)
        expect(result.unmetDemandByPop.worker?.food).toBeUndefined()

        // Revenue only from sector production sales: (30 + 30) * 30 = 1800
        expect(result.sectorRevenue.sectorA).toBeCloseTo(900, 4)
        expect(result.sectorRevenue.sectorB).toBeCloseTo(900, 4)
    })

    it("shortfall splits unmet demand across all sources", () => {
        const bids = [makeBid("sectorA")]
        // Sector produces 10, warehouse has 10, total supply = 20, demand = 100
        // coverage = min(1, 100/20) = 1 → all supply sold, 80 unmet
        const sectorResults = makeResult("sectorA", { food: 10 })
        const availableStock = { food: 10 }

        const result = callAllocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            demandByPop: { worker: { food: 100 } },
            cashByPop: { worker: 10000, clerks: 10000 },
            prices,
            availableStock,
        })

        expect(result.salesQty.sectorA.food).toBe(10)
        expect(result.warehouseSalesQty.food).toBe(10)
        expect(result.unmetDemandByPop.worker?.food).toBeCloseTo(80, 4)
    })
})

describe("pruneMemory", () => {
    it("removes entries not in active entity ids", () => {
        const memory = new Map<string, number>([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ])
        const active = new Set(["a", "c"])

        pruneMemory(memory, active)

        expect(memory.has("a")).toBe(true)
        expect(memory.has("b")).toBe(false)
        expect(memory.has("c")).toBe(true)
    })

    it("does nothing when all entries are active", () => {
        const memory = new Map<string, number>([["a", 1], ["b", 2]])
        const active = new Set(["a", "b"])

        pruneMemory(memory, active)

        expect(memory.size).toBe(2)
        expect(memory.has("a")).toBe(true)
        expect(memory.has("b")).toBe(true)
    })

    it("clears memory when no entities are active", () => {
        const memory = new Map<string, number>([["a", 1], ["b", 2]])
        const active = new Set<string>()

        pruneMemory(memory, active)

        expect(memory.size).toBe(0)
    })

    it("handles empty memory", () => {
        const memory = new Map<string, number>()
        const active = new Set(["a"])

        pruneMemory(memory, active)

        expect(memory.size).toBe(0)
    })
})

describe("trySetPatchField", () => {
    it("sets field when diff returns a change", () => {
        const patch: any = {}
        const result = trySetPatchField(patch, "goods", { oil: 100 }, { oil: 200 }, shallowDiff)

        expect(result).toBe(true)
        expect(patch.goods).toEqual({ oil: 200 })
    })

    it("returns false and does not set field when diff returns null", () => {
        const patch: any = {}
        const result = trySetPatchField(patch, "goods", { oil: 100 }, { oil: 100 }, shallowDiff)

        expect(result).toBe(false)
        expect(patch.goods).toBeUndefined()
    })

    it("returns newObj when oldObj is undefined", () => {
        const patch: any = {}
        const result = trySetPatchField(patch, "goods", undefined, { oil: 100 }, shallowDiff)

        expect(result).toBe(true)
        expect(patch.goods).toEqual({ oil: 100 })
    })

    it("works with different diff functions", () => {
        const nullDiff = (): null => null
        const patch: any = {}
        const result = trySetPatchField(patch, "field", { a: 1 }, { a: 2 }, nullDiff)

        expect(result).toBe(false)
        expect(patch.field).toBeUndefined()
    })
})
