import { describe, it, expect } from "vitest"
import { shallowDiff } from "./shallowDiff"
import { shallowObjectsEqual } from "./shallowObjectsEqual"
import { populationDiff } from "./populationDiff"
import { populationGroupDiff } from "./populationGroupDiff"
import { populationUpdateDiff } from "./populationUpdateDiff"
import { sectorResultChanged } from "./sectorResultChanged"
import { buildSectorResultsPatch } from "./sectorResultsPatch"
import { buildAdjustedSalaries, updateWageMemory } from "./wageSystem"
import { computeMarketRatios } from "./industryTickHelpers"
import { Population, PopulationBreakdown, baseSalaries } from "../data/Population"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import type { SectorResult } from "../systems/generateIndustrialSector"

describe("pure diff utilities", () => {
    describe("shallowDiff", () => {
        it("returns newObj when oldObj is undefined", () => {
            const result = shallowDiff(undefined, { a: 1, b: 2 })
            expect(result).toEqual({ a: 1, b: 2 })
        })

        it("returns null when nothing changed", () => {
            const result = shallowDiff({ a: 1, b: 2 }, { a: 1, b: 2 })
            expect(result).toBeNull()
        })

        it("returns only changed fields", () => {
            const result = shallowDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 })
            expect(result).toEqual({ b: 99 })
        })

        it("detects added keys", () => {
            const result = shallowDiff({ a: 1 }, { a: 1, b: 2 })
            expect(result).toEqual({ b: 2 })
        })

        it("detects removed keys", () => {
            // shallowDiff only iterates newObj keys, so removed keys are not detected
            const result = shallowDiff({ a: 1, b: 2 }, { a: 1 })
            expect(result).toBeNull()
        })
    })

    describe("shallowObjectsEqual", () => {
        it("returns true for equal objects", () => {
            expect(shallowObjectsEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
        })

        it("returns false for different values", () => {
            expect(shallowObjectsEqual({ a: 1 }, { a: 2 })).toBe(false)
        })

        it("returns false for different key counts", () => {
            expect(shallowObjectsEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
        })

        it("returns true for empty objects", () => {
            expect(shallowObjectsEqual({}, {})).toBe(true)
        })
    })
})

describe("population diff utilities", () => {
    const makePop = (number: number): PopulationBreakdown => ({
        number,
        wealth: 1,
        wealthLevel: 1,
        qol: 50,
        expectedQol: 50,
        populationChange: 0,
        mortality: 0,
        salary: 200,
        birthRate: 1,
    })

    describe("populationGroupDiff", () => {
        it("returns newGroup when old is undefined", () => {
            const result = populationGroupDiff(undefined, makePop(100))
            expect(result).toEqual(makePop(100))
        })

        it("returns null when nothing changed", () => {
            const result = populationGroupDiff(makePop(100), makePop(100))
            expect(result).toBeNull()
        })

        it("returns only changed fields", () => {
            const result = populationGroupDiff(makePop(100), makePop(150))
            expect(result).toEqual({ number: 150 })
        })
    })

    describe("populationDiff", () => {
        it("returns newPop when old is undefined", () => {
            const newPop: Population = {
                ...createStarterPopulation(1000),
            }
            const result = populationDiff(undefined, newPop)
            expect(result).toEqual(newPop)
        })

        it("returns null when nothing changed", () => {
            const pop: Population = {
                ...createStarterPopulation(1000),
            }
            const result = populationDiff(pop, pop)
            expect(result).toBeNull()
        })

        it("detects changes in a population group", () => {
            const oldPop: Population = {
                ...createStarterPopulation(1000),
            }
            const newPop: Population = {
                ...oldPop,
                worker: { ...oldPop.worker, number: oldPop.worker.number + 10 },
            }
            const result = populationDiff(oldPop, newPop)
            expect(result).not.toBeNull()
            expect(result!.worker).toEqual({ number: oldPop.worker.number + 10 })
        })
    })
})

describe("populationUpdateDiff", () => {
    const makeUpdate = (overrides: Partial<{
        qol: number
        expectedQol: number
        populationChange: number
        wealth: number
        number: number
        requirements: Record<string, number>
    }> = {}) => ({
        qol: 50,
        expectedQol: 50,
        populationChange: 0,
        wealth: 1,
        number: 100,
        requirements: {},
        ...overrides,
    })

    it("returns true when any field changed", () => {
        expect(populationUpdateDiff(makeUpdate({ qol: 50 }), makeUpdate({ qol: 51 }))).toBe(true)
        expect(populationUpdateDiff(makeUpdate({ expectedQol: 50 }), makeUpdate({ expectedQol: 51 }))).toBe(true)
        expect(populationUpdateDiff(makeUpdate({ populationChange: 0 }), makeUpdate({ populationChange: 5 }))).toBe(true)
        expect(populationUpdateDiff(makeUpdate({ wealth: 1 }), makeUpdate({ wealth: 2 }))).toBe(true)
        expect(populationUpdateDiff(makeUpdate({ number: 100 }), makeUpdate({ number: 101 }))).toBe(true)
    })

    it("returns true when requirements changed", () => {
        const oldReq = makeUpdate({ requirements: { food: 10 } })
        const newReq = makeUpdate({ requirements: { food: 11 } })
        expect(populationUpdateDiff(oldReq, newReq)).toBe(true)
    })

    it("returns false when nothing changed", () => {
        const u = makeUpdate()
        expect(populationUpdateDiff(u, u)).toBe(false)
    })
})

describe("sector result utilities", () => {
    const makeSectorResult = (overrides: Partial<SectorResult> = {}): SectorResult => ({
        name: "test",
        consumedGoods: {},
        producedGoods: {},
        workersEmployed: {},
        productionRatio: 1,
        inputLevel: 1,
        outputLevel: 1,
        ...overrides,
    })

    describe("sectorResultChanged", () => {
        it("returns false when nothing changed", () => {
            const r = makeSectorResult()
            expect(sectorResultChanged(r, r)).toBe(false)
        })

        it("returns true when productionRatio changed", () => {
            expect(sectorResultChanged(makeSectorResult({ productionRatio: 1 }), makeSectorResult({ productionRatio: 0.5 }))).toBe(true)
        })

        it("returns true when inputLevel changed", () => {
            expect(sectorResultChanged(makeSectorResult({ inputLevel: 1 }), makeSectorResult({ inputLevel: 0 }))).toBe(true)
        })

        it("returns true when outputLevel changed", () => {
            expect(sectorResultChanged(makeSectorResult({ outputLevel: 1 }), makeSectorResult({ outputLevel: 0 }))).toBe(true)
        })

        it("returns true when consumedGoods changed", () => {
            expect(sectorResultChanged(
                makeSectorResult({ consumedGoods: {} }),
                makeSectorResult({ consumedGoods: { oil: 100 } }),
            )).toBe(true)
        })

        it("returns true when producedGoods changed", () => {
            expect(sectorResultChanged(
                makeSectorResult({ producedGoods: {} }),
                makeSectorResult({ producedGoods: { energy: 1000 } }),
            )).toBe(true)
        })

        it("returns true when workersEmployed changed", () => {
            expect(sectorResultChanged(
                makeSectorResult({ workersEmployed: {} }),
                makeSectorResult({ workersEmployed: { worker: 100 } }),
            )).toBe(true)
        })
    })

    describe("buildSectorResultsPatch", () => {
        it("returns null when nothing changed", () => {
            const old = { a: makeSectorResult() }
            const newResults = { a: makeSectorResult() }
            const result = buildSectorResultsPatch(old, newResults)
            expect(result).toBeNull()
        })

        it("detects changed sectors", () => {
            const old = { a: makeSectorResult({ productionRatio: 1 }) }
            const newResults = { a: makeSectorResult({ productionRatio: 0.5 }) }
            const result = buildSectorResultsPatch(old, newResults)
            expect(result).not.toBeNull()
            expect(result!.changed).toHaveProperty("a")
        })

        it("detects added sectors", () => {
            const old = {}
            const newResults = { a: makeSectorResult() }
            const result = buildSectorResultsPatch(old, newResults)
            expect(result).not.toBeNull()
            expect(result!.changed).toHaveProperty("a")
        })

        it("detects removed sectors", () => {
            const old = { a: makeSectorResult() }
            const newResults = {}
            const result = buildSectorResultsPatch(old, newResults)
            expect(result).not.toBeNull()
            expect(result!.removed).toContain("a")
        })

        it("returns null when old is undefined and nothing new", () => {
            const result = buildSectorResultsPatch(undefined, {})
            expect(result).toBeNull()
        })
    })
})

describe("wage system", () => {
    describe("buildAdjustedSalaries", () => {
        it("returns base salaries when wageMemory is empty", () => {
            const result = buildAdjustedSalaries({})
            for(const key of Object.keys(baseSalaries) as (keyof Population)[]) {
                expect(result[key]).toBe(baseSalaries[key])
            }
        })

        it("uses wageMemory values when present", () => {
            const memory: Partial<Record<keyof Population, number>> = { worker: 500 }
            const result = buildAdjustedSalaries(memory)
            expect(result.worker).toBe(500)
        })
    })

    describe("updateWageMemory", () => {
        const fullRatios = (workerRatio: number): Record<keyof Population, number> => ({
            worker: workerRatio,
            clergy: 0,
            clerks: 0,
            engineer: 0,
            farmer: 0,
            healtcarePersonal: 0,
            policeMen: 0,
            teacher: 0,
            serviceWorker: 0,
            student: 0,
            retired: 0,
            stayAtHome: 0,
            serviceMan: 0,
            scientist: 0,
        })

        it("applies damping when ratio > 0", () => {
            const memory: Partial<Record<keyof Population, number>> = {}
            const ratios = fullRatios(0.5)
            const result = updateWageMemory(memory, ratios)

            // ratio=0.5 → multiplier=2 → clamped to wageMaxMultiplier=2.0 → targetWage=200*2=400
            // damped = 200 + (400-200)*0.3 = 260
            expect(result.worker).toBeCloseTo(260, 4)
        })

        it("uses wageMaxMultiplier when ratio is 0", () => {
            const memory: Partial<Record<keyof Population, number>> = {}
            const ratios = fullRatios(0)
            const result = updateWageMemory(memory, ratios)

            // ratio=0 → multiplier=wageMaxMultiplier=2.0 → targetWage=400
            // damped = 200 + (400-200)*0.3 = 260
            expect(result.worker).toBeCloseTo(260, 4)
        })

        it("clamps multiplier to wageMinMultiplier", () => {
            const memory: Partial<Record<keyof Population, number>> = {}
            const ratios = fullRatios(10) // multiplier = 0.1, clamped to 0.5
            const result = updateWageMemory(memory, ratios)

            // multiplier=0.1 → clamped to 0.5 → targetWage=200*0.5=100
            // damped = 200 + (100-200)*0.3 = 170
            expect(result.worker).toBeCloseTo(170, 4)
        })

        it("clamps multiplier to wageMaxMultiplier", () => {
            const memory: Partial<Record<keyof Population, number>> = {}
            const ratios = fullRatios(0.01) // multiplier=100, clamped to 2.0
            const result = updateWageMemory(memory, ratios)

            // multiplier=100 → clamped to 2.0 → targetWage=400
            // damped = 200 + (400-200)*0.3 = 260
            expect(result.worker).toBeCloseTo(260, 4)
        })
    })
})

describe("computeMarketRatios", () => {
    it("returns 1 when demand is 0", () => {
        const demands: Record<string, number> = { worker: 0 }
        const available: Record<string, number> = { worker: 100 }
        const result = computeMarketRatios(demands, available)
        expect(result.worker).toBe(1)
    })

    it("returns 1 when available >= demand", () => {
        const demands: Record<string, number> = { worker: 50 }
        const available: Record<string, number> = { worker: 100 }
        const result = computeMarketRatios(demands, available)
        expect(result.worker).toBe(1)
    })

    it("returns ratio < 1 when demand > available", () => {
        const demands: Record<string, number> = { worker: 200 }
        const available: Record<string, number> = { worker: 100 }
        const result = computeMarketRatios(demands, available)
        expect(result.worker).toBe(0.5)
    })

    it("handles multiple keys", () => {
        const demands: Record<string, number> = { worker: 200, clerks: 10 }
        const available: Record<string, number> = { worker: 100, clerks: 100 }
        const result = computeMarketRatios(demands, available)
        expect(result.worker).toBe(0.5)
        expect(result.clerks).toBe(1)
    })
})
