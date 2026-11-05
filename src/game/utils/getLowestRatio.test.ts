import { describe, it, expect } from "vitest"
import { getLowestRatio } from "./getLowestRatio"

describe("getLowestRatio", () => {
    it("returns 1 when no requirements", () => {
        const result = getLowestRatio({}, () => 100, 1, 1)
        expect(result).toBe(1)
    })

    it("returns 1 when all requirements are fully covered", () => {
        // requirement=10, available=100, level=1, workerRatio=1 → available - 10 = 90 > 0 → ratio=1
        const result = getLowestRatio({ oil: 10 }, () => 100, 1, 1)
        expect(result).toBe(1)
    })

    it("returns partial ratio when available is less than requirement", () => {
        // requirement=100, available=50, level=1, workerRatio=1 → 50/100 = 0.5
        const result = getLowestRatio({ oil: 100 }, () => 50, 1, 1)
        expect(result).toBeCloseTo(0.5)
    })

    it("takes minimum across multiple requirements", () => {
        // oil: available=50, req=100 → 0.5
        // paper: available=10, req=10 → 1.0
        // min = 0.5
        const result = getLowestRatio({ oil: 100, paper: 10 }, (key) => key === "oil" ? 50 : 10, 1, 1)
        expect(result).toBeCloseTo(0.5)
    })

    it("scales by level", () => {
        // requirement=10, available=100, level=2, workerRatio=1 → available - 10*2 = 80 > 0 → ratio=1
        const result = getLowestRatio({ oil: 10 }, () => 100, 2, 1)
        expect(result).toBe(1)
    })

    it("scales by workerRatio", () => {
        // requirement=10, available=5, level=1, workerRatio=1 → 5/10 = 0.5
        const result = getLowestRatio({ oil: 10 }, () => 5, 1, 1)
        expect(result).toBeCloseTo(0.5)

        // requirement=10, available=5, level=1, workerRatio=0.5 → effective req=5 → 5/5=1
        const result2 = getLowestRatio({ oil: 10 }, () => 5, 1, 0.5)
        expect(result2).toBe(1)
    })

    it("clamps to 0 when nothing is available", () => {
        const result = getLowestRatio({ oil: 100 }, () => 0, 1, 1)
        expect(result).toBe(0)
    })

    it("clamps to 1 max", () => {
        // Even with huge available, ratio should not exceed 1
        const result = getLowestRatio({ oil: 10 }, () => 1000000, 1, 1)
        expect(result).toBe(1)
    })
})
