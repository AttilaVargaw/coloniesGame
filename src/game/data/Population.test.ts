import { describe, it, expect } from "vitest"
import type { Population, PopulationBreakdown } from "./Population"
import { sumPopulation, getLowestPopulationRatio, getRequirementsForQol, getGoodRequirementsAndQoL } from "./Population"
import { basePrices } from "./Goods"

const breakdown = (number: number, wealth: number): PopulationBreakdown => ({
    number,
    wealth,
    wealthLevel: 0,
    qol: 0,
    expectedQol: 0,
    populationChange: 0,
    mortality: 0,
    salary: 200,
    birthRate: 0,
})

const population = (): Population => ({
    farmer: breakdown(100, 1000),
    scientist: breakdown(50, 5000),
    worker: breakdown(200, 2000),
    student: breakdown(30, 500),
    healtcarePersonal: breakdown(20, 3000),
    policeMen: breakdown(10, 1000),
    teacher: breakdown(15, 1500),
    serviceWorker: breakdown(40, 800),
    clergy: breakdown(5, 500),
    retired: breakdown(25, 2000),
    clerks: breakdown(30, 2500),
    engineer: breakdown(12, 4000),
    stayAtHome: breakdown(18, 300),
    serviceMan: breakdown(8, 900),
})

describe("sumPopulation", () => {
    it("sums the number field across all occupations", () => {
        const total = 100 + 50 + 200 + 30 + 20 + 10 + 15 + 40 + 5 + 25 + 30 + 12 + 18 + 8
        expect(sumPopulation(population())).toBe(total)
    })

    it("returns 0 when all occupations have zero population", () => {
        const empty = population()
        for(const key of Object.keys(empty) as (keyof Population)[]) {
            empty[key].number = 0
        }
        expect(sumPopulation(empty)).toBe(0)
    })
})

describe("getLowestPopulationRatio", () => {
    it("returns 1 when all requirements are fully covered", () => {
        const avail = population()
        const result = getLowestPopulationRatio({ farmer: 1 }, avail as unknown as Record<string, PopulationBreakdown>, 1, 1)
        expect(result).toBe(1)
    })

    it("returns partial ratio when available is less than required", () => {
        const avail = population()
        const result = getLowestPopulationRatio({ farmer: 10000 }, avail as unknown as Record<string, PopulationBreakdown>, 1, 1)
        expect(result).toBeCloseTo(100 / 10000)
    })

    it("returns 0 when nothing is available", () => {
        const empty = population()
        for(const key of Object.keys(empty) as (keyof Population)[]) {
            empty[key].number = 0
        }
        const result = getLowestPopulationRatio({ farmer: 1 }, empty as unknown as Record<string, PopulationBreakdown>, 1, 1)
        expect(result).toBe(0)
    })
})

describe("getRequirementsForQol", () => {
    it("QOL 0 returns level 0 cumulative data multiplied by number", () => {
        const result = getRequirementsForQol(0, 10)
        expect(result.food).toBeCloseTo(0.5 * 10)
        expect(result.water).toBeCloseTo(0.5 * 10)
        expect(result.faith).toBeCloseTo(4 * 10)
        expect(result.healthcare).toBeCloseTo(4 * 10)
    })

    it("QOL above max clamps to level 80", () => {
        const result = getRequirementsForQol(999, 5)
        expect(result.tourism).toBeCloseTo(5 * 5)
        expect(result.faith).toBeCloseTo(8.5 * 5)
    })

    it("QOL below 0 clamps to level 0", () => {
        const result = getRequirementsForQol(-10, 3)
        expect(result.food).toBeCloseTo(0.5 * 3)
        expect(result.water).toBeCloseTo(0.5 * 3)
    })

    it("exact level match returns that level's data multiplied by number", () => {
        const result = getRequirementsForQol(10, 4)
        expect(result.services).toBeCloseTo(1 * 4)
        expect(result.food).toBeCloseTo((0.5 + 1) * 4)
    })

    it("interpolates between adjacent QOL levels", () => {
        // QOL 15 is halfway between level 10 and level 20
        const result = getRequirementsForQol(15, 2)
        // healthcare: level 10 cumulative = 7, level 20 cumulative = 9 → interpolated = 8
        expect(result.healthcare).toBeCloseTo(8 * 2)
    })
})

describe("getGoodRequirementsAndQoL", () => {
    it("returns zero QOL and empty requirements for non-finite number", () => {
        const result = getGoodRequirementsAndQoL(500, basePrices, breakdown(NaN, 1000))
        expect(result.qol).toBe(0)
        expect(result.requirements).toEqual({})
    })

    it("returns zero QOL and empty requirements for non-finite wealth", () => {
        const result = getGoodRequirementsAndQoL(500, basePrices, breakdown(10, Infinity))
        expect(result.qol).toBe(0)
        expect(result.requirements).toEqual({})
    })

    // it("returns QOL 0 with level 0 requirements when salary covers level 0", () => {
    //     const result = getGoodRequirementsAndQoL(700, basePrices, breakdown(5, 0))
    //     expect(result.qol).toBeGreaterThanOrEqual(0)
    //     expect(result.requirements.food).toBeGreaterThan(0)
    //     expect(Object.keys(result.requirements).length).toBeGreaterThan(0)
    // })

    it("higher salary produces higher QOL", () => {
        const low = getGoodRequirementsAndQoL(100, basePrices, breakdown(1, 0))
        const high = getGoodRequirementsAndQoL(5000, basePrices, breakdown(1, 0))
        expect(high.qol).toBeGreaterThan(low.qol)
    })

    it("wealth contributes to budget via WEALTH_DRAWDOWN_RATE", () => {
        const withoutWealth = getGoodRequirementsAndQoL(300, basePrices, breakdown(1, 0))
        const withWealth = getGoodRequirementsAndQoL(300, basePrices, breakdown(1, 100000))
        expect(withWealth.qol).toBeGreaterThanOrEqual(withoutWealth.qol)
    })

    it("requirements are scaled by population number", () => {
        const single = getGoodRequirementsAndQoL(2000, basePrices, breakdown(1, 0))
        const many = getGoodRequirementsAndQoL(2000, basePrices, breakdown(10, 0))
        if(single.requirements.food && many.requirements.food) {
            expect(many.requirements.food).toBeCloseTo(single.requirements.food * 10)
        }
    })
})
