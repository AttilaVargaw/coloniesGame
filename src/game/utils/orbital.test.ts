import { describe, it, expect } from "vitest"
import { angularSpeed } from "./orbital"
import { G } from "../constants"

describe("angularSpeed", () => {
    it("returns sqrt(G * mass / r^3)", () => {
        const mass = 1000
        const radius = 10
        const expected = Math.sqrt(G * mass / radius ** 3)
        expect(angularSpeed(radius, mass)).toBe(expected)
    })

    it("clamps radius to minimum of 1", () => {
        const mass = 1000
        const expected = Math.sqrt(G * mass / 1 ** 3)
        expect(angularSpeed(0, mass)).toBe(expected)
        expect(angularSpeed(-5, mass)).toBe(expected)
        expect(angularSpeed(0.5, mass)).toBe(expected)
    })

    it("increases with mass", () => {
        expect(angularSpeed(10, 2000)).toBeGreaterThan(angularSpeed(10, 1000))
    })

    it("decreases with radius", () => {
        expect(angularSpeed(20, 1000)).toBeLessThan(angularSpeed(10, 1000))
    })

    it("is positive for positive mass and radius", () => {
        expect(angularSpeed(5, 100)).toBeGreaterThan(0)
    })
})
