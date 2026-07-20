import { describe, it, expect, } from "vitest"
import { CommandBus } from "./commandBus"

describe("CommandBus", () => {
    it("initializes with redraw and selectEntity queues", () => {
        const bus = new CommandBus()

        expect(bus.commands.get("redraw")).toBeInstanceOf(Object)
        expect(bus.commands.get("selectEntity")).toBeInstanceOf(Object)
        expect(bus.commands.size).toBe(2)
    })

    it("registerCommandQueue adds a new command queue", () => {
        const bus = new CommandBus()

        bus.registerCommandQueue("customCommand" as any)

        expect(bus.commands.get("customCommand")).toBeDefined()
    })

    it("returns itself from registerCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.registerCommandQueue("customCommand" as any)).toBe(bus)
    })

    it("removeCommandQueue removes a command queue", () => {
        const bus = new CommandBus()

        bus.removeCommandQueue("selectEntity")

        expect(bus.commands.get("selectEntity")).toBeUndefined()
        expect(bus.commands.size).toBe(1)
    })

    it("returns itself from removeCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.removeCommandQueue("selectEntity")).toBe(bus)
    })

    it("addCommand enqueues data to the specified queue", () => {
        const bus = new CommandBus()

        bus.addCommand("redraw", { reason: "tick" })

        const queue = bus.commands.get("redraw")!
        expect(queue.length).toBe(1)
        expect(queue.peek()?.data).toEqual({ reason: "tick" })
    })

    it("returns itself from addCommand", () => {
        const bus = new CommandBus()

        expect(bus.addCommand("redraw", {})).toBe(bus)
    })

    it("getCommandQueue returns the queue for a registered command", () => {
        const bus = new CommandBus()
        const queue = bus.getCommandQueue("redraw")

        expect(queue).toBeDefined()
        expect(queue?.length).toBe(0)
    })

    it("getCommandQueue returns undefined for unregistered commands", () => {
        const bus = new CommandBus()

        expect(bus.getCommandQueue("unknown" as any)).toBeUndefined()
    })

    it("clearAll empties all command queues", () => {
        const bus = new CommandBus()
        bus.addCommand("redraw", { a: 1 })
        bus.addCommand("selectEntity", { b: 2 })
        bus.registerCommandQueue("extra" as any)
        bus.addCommand("extra", { c: 3 })

        bus.clearAll()

        for(const queue of bus.commands.values()) {
            expect(queue.length).toBe(0)
        }
    })
})
