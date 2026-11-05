import { describe, it, expect } from "vitest"
import {
    UNIVERSE_SCALE,
    SHIP_RADIUS,
    TWO_PI,
    KEPLER_EPSILON,
    KEPLER_MAX_ITERATIONS,
    workingRatio,
    pensionerRatio,
    studentRatio,
    ColonyType,
    MASS,
} from "./constants"

describe("constants", () => {
    it("UNIVERSE_SCALE is 30", () => {
        expect(UNIVERSE_SCALE).toBe(30)
    })

    it("TWO_PI is 2 * Math.PI", () => {
        expect(TWO_PI).toBeCloseTo(2 * Math.PI)
    })

    it("KEPLER_EPSILON is small positive", () => {
        expect(KEPLER_EPSILON).toBeGreaterThan(0)
        expect(KEPLER_EPSILON).toBeLessThan(1)
    })

    it("KEPLER_MAX_ITERATIONS is 20", () => {
        expect(KEPLER_MAX_ITERATIONS).toBe(20)
    })

    it("workingRatio + pensionerRatio + studentRatio = 1.0", () => {
        expect(workingRatio + pensionerRatio + studentRatio).toBeCloseTo(1.0)
    })

    it("ColonyType has standard type", () => {
        expect(ColonyType.standard).toBe("standard")
        expect(ColonyType.asteroid).toBe("asteroid")
        expect(ColonyType.moon).toBe("moon")
        expect(ColonyType.orbital).toBe("orbital")
    })

    it("MASS has star, gasGiant, iceGiant, terrestrial, moon, dwarfPlanet, asteroid", () => {
        expect(MASS.star).toBe(100000)
        expect(MASS.gasGiant).toBe(500)
        expect(MASS.iceGiant).toBe(100)
        expect(MASS.terrestrial).toBe(10)
        expect(MASS.moon).toBe(1)
        expect(MASS.dwarfPlanet).toBe(0.5)
        expect(MASS.asteroid).toBe(0.1)
    })

    it("SHIP_RADIUS is 6", () => {
        expect(SHIP_RADIUS).toBe(6)
    })
})
