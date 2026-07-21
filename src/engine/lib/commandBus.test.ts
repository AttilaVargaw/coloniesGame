import { describe, it, expect, } from "vitest"
import { CommandBus } from "./commandBus"
import { RedrawCommand } from "./RedrawCommand"
import { SelectEntityCommand } from "./SelectEntityCommand"
import { Queue } from "./commandQueue"

describe("CommandBus", () => {
    it("initializes with redraw and selectEntity queues", () => {
        const bus = new CommandBus()

        expect(bus.commands.get(RedrawCommand)).toBeInstanceOf(Object)
        expect(bus.commands.get(SelectEntityCommand)).toBeInstanceOf(Object)
        expect(bus.commands.size).toBe(2)
    })

    it("registerCommandQueue adds a new command queue", () => {
        const bus = new CommandBus()

        bus.registerCommandQueue(RedrawCommand)

        expect(bus.commands.get(RedrawCommand)).toBeDefined()
    })

    it("returns itself from registerCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.registerCommandQueue("customCommand" as any)).toBe(bus)
    })

    it("removeCommandQueue removes a command queue", () => {
        const bus = new CommandBus()

        bus.removeCommandQueue(SelectEntityCommand)

        expect(bus.commands.get(SelectEntityCommand)).toBeUndefined()
        expect(bus.commands.size).toBe(1)
    })

    it("returns itself from removeCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.removeCommandQueue(SelectEntityCommand)).toBe(bus)
    })

    it("addCommand enqueues data to the specified queue", () => {
        const bus = new CommandBus()

        bus.addCommand(new RedrawCommand())

        const queue = bus.commands.get(RedrawCommand)!
        expect(queue.length).toBe(1)
        expect(queue.peek()?.data).toEqual(undefined)
    })

    it("returns itself from addCommand", () => {
        const bus = new CommandBus()

        expect(bus.addCommand(new RedrawCommand())).toBe(bus)
    })

    it("getCommandQueue returns the queue for a registered command", () => {
        const bus = new CommandBus()
        const queue = bus.getCommandQueue<Queue<unknown>>(RedrawCommand)

        expect(queue).toBeDefined()
        expect(queue?.length).toBe(0)
    })

    it("getCommandQueue returns undefined for unregistered commands", () => {
        const bus = new CommandBus()

        expect(bus.getCommandQueue("unknown" as any)).toBeUndefined()
    })

    it("clearAll empties all command queues", () => {
        const bus = new CommandBus()
        bus.addCommand(new RedrawCommand())
        bus.addCommand(new SelectEntityCommand())
        bus.registerCommandQueue("extra" as any)
        bus.addCommand(new RedrawCommand())

        bus.clearAll()

        for(const queue of bus.commands.values()) {
            expect(queue.length).toBe(0)
        }
    })
})
