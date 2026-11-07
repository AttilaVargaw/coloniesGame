import { describe, it, expect } from "vitest"
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
