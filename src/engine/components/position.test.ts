import { describe, it, expect } from "vitest"
import { PositionComponent } from "@engine/components/position"

describe("PositionComponent", () => {
    it("initializes x, y, and z from the constructor", () => {
        const component = new PositionComponent(10, 20, 5)

        expect(component.x).toBe(10)
        expect(component.y).toBe(20)
        expect(component.z).toBe(5)
    })

    it("defaults z to 0 when not provided", () => {
        const component = new PositionComponent(1, 2)

        expect(component.z).toBe(0)
    })
})