import { describe, it, expect } from "vitest"
import { birthRate, mortality, populationGrowth } from "../data/populationHelpers"

describe("populationHelpers edge cases", () => {
    describe("birthRate", () => {
        it("returns 4.5 for x <= 10", () => {
            expect(birthRate(1)).toBe(4.5)
            expect(birthRate(5)).toBe(4.5)
            expect(birthRate(10)).toBe(4.5)
        })

        it("linearly decreases between 10 and 25", () => {
            // birthRate(17.5) = 4.5 - (4.5 - 0.6) * (17.5 - 10) / 15 = 4.5 - 3.9 * 7.5 / 15 = 4.5 - 1.95 = 2.55
            expect(birthRate(17.5)).toBeCloseTo(2.55, 4)
        })

        it("returns 0.6 for x >= 25", () => {
            expect(birthRate(25)).toBeCloseTo(0.6, 4)
            expect(birthRate(30)).toBeCloseTo(0.6, 4)
            expect(birthRate(100)).toBeCloseTo(0.6, 4)
        })

        it("is continuous at x = 10", () => {
            // Left limit: 4.5. Right: 4.5 - (3.9) * (10 - 10) / 15 = 4.5
            expect(birthRate(10)).toBe(4.5)
        })

        it("is continuous at x = 25", () => {
            // Left: 4.5 - 3.9 * 15/15 = 0.6. Right: 0.6
            expect(birthRate(25)).toBeCloseTo(0.6, 4)
        })
    })

    describe("mortality", () => {
        it("linearly decreases from 5.3 at x=1 to 4.5 at x=5", () => {
            expect(mortality(1)).toBe(5.3)
            expect(mortality(5)).toBe(4.5)
        })

        it("linearly decreases from 4.5 at x=5 to 1.1 at x=15", () => {
            expect(mortality(5)).toBe(4.5)
            expect(mortality(15)).toBe(1.1)
        })

        it("linearly decreases from 1.1 at x=15 to 0.45 at x=25", () => {
            expect(mortality(15)).toBe(1.1)
            expect(mortality(25)).toBeCloseTo(0.45, 4)
        })

        it("returns 0.45 for x >= 25", () => {
            expect(mortality(25)).toBeCloseTo(0.45, 4)
            expect(mortality(30)).toBe(0.45)
            expect(mortality(100)).toBe(0.45)
        })

        it("interpolates at x=10 (segment 5-15)", () => {
            // mortality(10) = 4.5 - (4.5 - 1.1) * (10 - 5) / 10 = 4.5 - 3.4 * 0.5 = 4.5 - 1.7 = 2.8
            expect(mortality(10)).toBeCloseTo(2.8, 4)
        })

        it("is continuous at boundaries", () => {
            expect(mortality(5)).toBe(4.5)
            expect(mortality(15)).toBe(1.1)
            expect(mortality(25)).toBeCloseTo(0.45, 4)
        })
    })

    describe("populationGrowth", () => {
        it("goes from -0.05 at x=1 to 0.0 at x=10", () => {
            expect(populationGrowth(1)).toBe(-0.05)
            expect(populationGrowth(10)).toBe(0.0)
        })

        it("goes from 0.0 at x=10 to 0.05 at x=15", () => {
            expect(populationGrowth(10)).toBe(0.0)
            expect(populationGrowth(15)).toBe(0.05)
        })

        it("goes from 0.05 at x=15 down to 0.0 at x=25", () => {
            expect(populationGrowth(15)).toBe(0.05)
            expect(populationGrowth(25)).toBe(0.0)
        })

        it("returns 0.0 for x >= 25", () => {
            expect(populationGrowth(25)).toBe(0.0)
            expect(populationGrowth(30)).toBe(0.0)
            expect(populationGrowth(100)).toBe(0.0)
        })

        it("interpolates at x=12.5 (segment 10-15)", () => {
            // populationGrowth(12.5) = 0.0 + 0.05 * (12.5 - 10) / 5 = 0.05 * 2.5 / 5 = 0.025
            expect(populationGrowth(12.5)).toBeCloseTo(0.025, 4)
        })

        it("interpolates at x=20 (segment 15-25)", () => {
            // populationGrowth(20) = 0.05 - 0.05 * (20 - 15) / 10 = 0.05 - 0.025 = 0.025
            expect(populationGrowth(20)).toBeCloseTo(0.025, 4)
        })

        it("is continuous at boundaries", () => {
            expect(populationGrowth(10)).toBe(0.0)
            expect(populationGrowth(15)).toBe(0.05)
            expect(populationGrowth(25)).toBe(0.0)
        })
    })
})
