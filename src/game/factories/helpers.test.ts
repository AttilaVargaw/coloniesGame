import { describe, it, expect, vi } from "vitest"
import { createColonyClickHandler, createAttractorClickHandler } from "./helpers"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { SelectionManager } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"

describe("createEntityClickHandler", () => {
    it("dispatches SelectionChangedEvent on colony click even when nothing is selected", () => {
        const engine = {
            getSystem: vi.fn(),
            dispatchEvent: vi.fn(),
        } as any

        const body = { id: "body-1" } as any

        const handler = createColonyClickHandler(engine, body)
        handler({ event: { shiftKey: false }, worldX: 0, worldY: 0 })

        expect(engine.dispatchEvent).toHaveBeenCalledWith(
            new SelectionChangedEvent({ data: body, type: "colony" })
        )
    })

    it("dispatches SelectionChangedEvent on attractor click even when nothing is selected", () => {
        const engine = {
            getSystem: vi.fn(),
            dispatchEvent: vi.fn(),
        } as any

        const body = { id: "body-1" } as any

        const handler = createAttractorClickHandler(engine, body)
        handler({ event: { shiftKey: false }, worldX: 0, worldY: 0 })

        expect(engine.dispatchEvent).toHaveBeenCalledWith(
            new SelectionChangedEvent({ data: body, type: "attractor" })
        )
    })

    it("targets selected ship on colony shift-click when ship is selected", () => {
        const ship = { id: "ship-1" } as any
        const targetSystem = { setTarget: vi.fn() } as any
        const engine = {
            getSystem: vi.fn((cls) => {
                if (cls === SelectionManager) return { currentSelection: ship }
                if (cls === TargetSystem) return targetSystem
                return undefined
            }),
            dispatchEvent: vi.fn(),
        } as any

        const body = { id: "body-1" } as any

        const handler = createColonyClickHandler(engine, body)
        handler({ event: { shiftKey: true }, worldX: 100, worldY: 200 })

        expect(targetSystem.setTarget).toHaveBeenCalledWith(ship, body, 100, 200)
    })

    it("does not target when colony shift-click but no ship is selected", () => {
        const engine = {
            getSystem: vi.fn(() => undefined),
            dispatchEvent: vi.fn(),
        } as any

        const body = { id: "body-1" } as any

        const handler = createColonyClickHandler(engine, body)
        handler({ event: { shiftKey: true }, worldX: 100, worldY: 200 })

        expect(engine.dispatchEvent).not.toHaveBeenCalled()
    })
})
