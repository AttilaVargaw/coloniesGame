import { describe, it, expect } from "vitest"
import { applyGoodConstraint } from "./sectorExecution"

describe("applyGoodConstraint", () => {
    const emptyMarketRatios: Record<string, number> = {}

    it("returns currentConstraint when market ratio is 1 and inventory covers demand", () => {
        // marketRatio=1, available=1000, demandPerTick=100 → maxScaleFromInventory=10 >= 1
        // Returns currentConstraint unchanged
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 1000 } as any, false)
        expect(result).toBe(1)
    })

    it("returns market ratio when market constraint is the limiting factor", () => {
        // marketRatio=0.3, demandPerTick=100, available=50 → maxScaleFromInventory=0.5
        // marketConstraint = min(1, 0.3) = 0.3
        // inventoryConstraint = 0.5 (essential)
        // result = min(0.3, 0.5) = 0.3
        const result = applyGoodConstraint(1, "oil", 100, { oil: 0.3 } as any, { oil: 50 } as any, false)
        expect(result).toBeCloseTo(0.3)
    })

    it("applies inventory constraint when inventory is scarce (essential good)", () => {
        // demandPerTick=100, available=10 → maxScaleFromInventory=0.1
        // marketRatio=1, essential good → inventoryConstraint=0.1 → returns 0.1
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 10 } as any, false)
        expect(result).toBeCloseTo(0.1)
    })

    it("applies floor of 0.5 for non-essential goods with inventory constraint", () => {
        // demandPerTick=100, available=10 → maxScaleFromInventory=0.1
        // non-essential → inventoryConstraint=max(0.5, 0.1)=0.5 → returns 0.5
        const result = applyGoodConstraint(1, "oil", 100, emptyMarketRatios, { oil: 10 } as any, true)
        expect(result).toBeCloseTo(0.5)
    })

    it("takes minimum of marketConstraint and inventoryConstraint", () => {
        // marketRatio=0.8, demandPerTick=1000, available=100 → maxScaleFromInventory=0.1
        // marketConstraint = min(1, 0.8) = 0.8
        // inventoryConstraint = 0.1
        // result = min(0.8, 0.1) = 0.1
        const result = applyGoodConstraint(1, "oil", 1000, { oil: 0.8 } as any, { oil: 100 } as any, false)
        expect(result).toBeCloseTo(0.1)
    })

    it("handles zero demandPerTick", () => {
        // demandPerTick=0 → maxScaleFromInventory=1 (since demandPerTick > 0 is false)
        // Returns currentConstraint unchanged
        const result = applyGoodConstraint(0.5, "oil", 0, emptyMarketRatios, {} as any, false)
        expect(result).toBe(0.5)
    })
})
