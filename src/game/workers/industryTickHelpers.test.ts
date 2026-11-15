import { describe, it, expect } from "vitest"
import { allocatePopulationSales } from "./transactionLedger"
import { distributePopulationSpending, pruneMemory, trySetPatchField } from "./industryTickHelpers"
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

describe("distributePopulationSpending", () => {
    const prices: Record<string, number> = { food: 30, oil: 100, energy: 20 }

    it("returns newMoney unchanged when there are no bids", () => {
        const bids: SectorBid[] = []
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {}
        const populationConsumption = { food: 100, oil: 50 }
        const newMoney = { sectorA: 1000 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        expect(result).toEqual({ sectorA: 1000 })
    })

    it("returns newMoney unchanged when sector has no result", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {}
        const populationConsumption = { food: 100 }
        const newMoney = { sectorA: 1000 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        expect(result).toEqual({ sectorA: 1000 })
    })

    it("distributes population spending proportionally to sector production share", () => {
        const bids = [
            makeBid("sectorA"),
            makeBid("sectorB"),
        ]
        // Total production: food = 200 (sectorA: 150, sectorB: 50)
        // Population spending on food = 100 * 30 = 3000
        // sectorA share = 3000 * (150/200) = 2250
        // sectorB share = 3000 * (50/200) = 750
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {
            sectorA: { producedGoods: { food: 150 } },
            sectorB: { producedGoods: { food: 50 } },
        }
        const populationConsumption = { food: 100 }
        const newMoney = { sectorA: 0, sectorB: 0 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        expect(result.sectorA).toBeCloseTo(2250, 4)
        expect(result.sectorB).toBeCloseTo(750, 4)
    })

    it("skips goods with zero or negative production", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {
            sectorA: { producedGoods: { food: 0, oil: -10, energy: 100 } },
        }
        const populationConsumption = { energy: 50 }
        const newMoney = { sectorA: 1000 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        // electricity: spending = 50 * 20 = 1000, sectorA produces all 100 → gets full 1000
        expect(result.sectorA).toBeCloseTo(2000, 4)
    })

    it("does not create new money entries for sectors with no revenue", () => {
        const bids = [makeBid("sectorA"), makeBid("sectorB")]
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {
            sectorA: { producedGoods: { food: 100 } },
            // sectorB produces nothing
        }
        const populationConsumption = { food: 100 }
        const newMoney = { sectorA: 100, sectorB: 200 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        expect(result.sectorA).toBeGreaterThan(100)
        expect(result.sectorB).toBe(200) // unchanged
    })

    it("ignores goods with no population spending", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {
            sectorA: { producedGoods: { oil: 100 } },
        }
        const populationConsumption = { food: 100 } // no oil consumption
        const newMoney = { sectorA: 1000 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        expect(result.sectorA).toBe(1000) // unchanged
    })

    it("adds to existing sector money", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults: Record<string, { producedGoods: Record<string, number> }> = {
            sectorA: { producedGoods: { food: 100 } },
        }
        const populationConsumption = { food: 100 }
        const newMoney = { sectorA: 5000 }

        const result = distributePopulationSpending(bids, sectorResults, populationConsumption, prices as any, newMoney)

        // food: spending = 100 * 30 = 3000, sectorA produces all 100 → gets 3000
        expect(result.sectorA).toBe(8000)
    })
})

describe("allocatePopulationSales", () => {
    const prices: Record<string, number> = { food: 30, oil: 100 }

    function makeResult(name: string, produced: Record<string, number>) {
        return { [name]: { producedGoods: produced } }
    }

    it("caps sales at actual production when demand exceeds supply", () => {
        const bids = [makeBid("sectorA")]
        // Population demands 100 food, but sector only produces 60
        const sectorResults = makeResult("sectorA", { food: 60 })
        const populationConsumption = { food: 100 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
        })

        // Actual sales = 60 (production), not 100 (demand)
        const totalSales = Object.values(result.salesQty).reduce(
            (sum, sq) => sum + Object.values(sq).reduce((a, b) => a + b, 0),
            0
        )
        expect(totalSales).toBe(60)

        // Unmet demand = 100 - 60 = 40
        expect(result.unmetDemandQty.food).toBe(40)

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
        const populationConsumption = { food: 100 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
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
        expect(result.unmetDemandQty.food).toBe(40)
    })

    it("sells full demand when production exceeds demand", () => {
        const bids = [makeBid("sectorA")]
        // Sector produces 150 food, demand is 100
        const sectorResults = makeResult("sectorA", { food: 150 })
        const populationConsumption = { food: 100 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
        })

        // Sells exactly demand (100), not all production (150)
        expect(result.salesQty.sectorA.food).toBe(100)
        expect(result.unsoldQty.sectorA.food).toBe(50)
        expect(result.unmetDemandQty.food).toBeUndefined()
        expect(result.sectorRevenue.sectorA).toBeCloseTo(3000, 4) // 100 * 30
    })

    it("no production means all demand is unmet", () => {
        const bids = [makeBid("sectorA")]
        const sectorResults = makeResult("sectorA", { food: 0 })
        const populationConsumption = { food: 100 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
        })

        expect(result.salesQty.sectorA.food).toBeUndefined()
        expect(result.unmetDemandQty.food).toBe(100)
        expect(result.sectorRevenue.sectorA).toBe(0)
    })

    it("sells zero-priced goods with zero revenue", () => {
        const zeroPrices: Record<string, number> = { food: 0, oil: 100 }
        const bids = [makeBid("sectorA")]
        // Sector produces 10 food, households demand 8, price is 0
        const sectorResults = makeResult("sectorA", { food: 10 })
        const populationConsumption = { food: 8 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: zeroPrices as any,
        })

        // 8 sold (all demand), 2 unsold, zero revenue, zero unmet
        expect(result.salesQty.sectorA.food).toBe(8)
        expect(result.unsoldQty.sectorA.food).toBe(2)
        expect(result.sectorRevenue.sectorA).toBe(0)
        expect(result.unmetDemandQty.food).toBeUndefined()
    })

    it("sells from available stock when there is no production", () => {
        const bids = [makeBid("sectorA")]
        // No production, but 50 food in warehouse stock, demand is 30
        const sectorResults = makeResult("sectorA", { food: 0 })
        const populationConsumption = { food: 30 }
        const availableStock = { food: 50 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
            availableStock: availableStock as any,
        })

        // 30 sold from warehouse, 20 stock remains, zero unmet demand
        expect(result.warehouseSalesQty.food).toBe(30)
        expect(result.salesQty.sectorA.food).toBeUndefined()
        expect(result.unmetDemandQty.food).toBeUndefined()
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
        const populationConsumption = { food: 100 }
        const availableStock = { food: 40 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
            availableStock: availableStock as any,
        })

        expect(result.salesQty.sectorA.food).toBe(30)
        expect(result.salesQty.sectorB.food).toBe(30)
        expect(result.warehouseSalesQty.food).toBe(40)
        expect(result.unmetDemandQty.food).toBeUndefined()

        // Revenue only from sector production sales: (30 + 30) * 30 = 1800
        expect(result.sectorRevenue.sectorA).toBeCloseTo(900, 4)
        expect(result.sectorRevenue.sectorB).toBeCloseTo(900, 4)
    })

    it("shortfall splits unmet demand across all sources", () => {
        const bids = [makeBid("sectorA")]
        // Sector produces 10, warehouse has 10, total supply = 20, demand = 100
        // coverage = min(1, 100/20) = 1 → all supply sold, 80 unmet
        const sectorResults = makeResult("sectorA", { food: 10 })
        const populationConsumption = { food: 100 }
        const availableStock = { food: 10 }

        const result = allocatePopulationSales({
            sectorBids: bids,
            sectorResults,
            populationConsumption: populationConsumption as any,
            prices: prices as any,
            availableStock: availableStock as any,
        })

        expect(result.salesQty.sectorA.food).toBe(10)
        expect(result.warehouseSalesQty.food).toBe(10)
        expect(result.unmetDemandQty.food).toBe(80)
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
