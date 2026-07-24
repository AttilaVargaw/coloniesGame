import { describe, it, expect, } from "vitest"
import { CommandBus } from "./commandBus"
import { SelectEntityCommand } from "./SelectEntityCommand"
import { CommandBase } from "./CommandBase"
import { SelectionChangedEvent } from "./events"

class CommandBaseImplementation extends CommandBase { }

describe("CommandBus", () => {
    it("initializes with redraw and selectEntity queues", () => {
        const bus = new CommandBus()

        expect(bus.commands.get(SelectEntityCommand)).toBeInstanceOf(Object)
        expect(bus.commands.size).toBe(1)
    })

    it("registerCommandQueue adds a new command queue", () => {
        const bus = new CommandBus()

        bus.registerCommandQueue(SelectionChangedEvent)

        expect(bus.commands.get(SelectionChangedEvent)).toBeDefined()
    })

    it("returns itself from registerCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.registerCommandQueue("customCommand" as any)).toBe(bus)
    })

    it("removeCommandQueue removes a command queue", () => {
        const bus = new CommandBus()

        bus.removeCommandQueue(SelectEntityCommand)

        expect(bus.commands.get(SelectEntityCommand)).toBeUndefined()
        expect(bus.commands.size).toBe(0)
    })

    it("returns itself from removeCommandQueue", () => {
        const bus = new CommandBus()

        expect(bus.removeCommandQueue(SelectEntityCommand)).toBe(bus)
    })

    it("addCommand enqueues data to the specified queue", () => {
        const bus = new CommandBus()

        bus.addCommand(new SelectEntityCommand)

        const queue = bus.commands.get(SelectEntityCommand)!
        expect(queue.length).toBe(1)
        expect(queue.peek()).toEqual({})
    })

    it("returns itself from addCommand", () => {
        const bus = new CommandBus()

        expect(bus.addCommand(SelectionChangedEvent)).toBe(bus)
    })

    it("getCommands returns the queue for a registered command", () => {
        const bus = new CommandBus()
        const queue = bus.getCommands(SelectEntityCommand)

        expect(queue).toBeDefined()
        expect(queue?.length).toBe(0)
    })

    it("getCommands returns undefined for unregistered commands", () => {
        const bus = new CommandBus()

        expect(bus.getCommands(CommandBaseImplementation)).toBeUndefined()
    })

    it("clearAll empties all command queues", () => {
        const bus = new CommandBus()
        bus.addCommand(SelectionChangedEvent)
        bus.addCommand(new SelectEntityCommand())
        bus.registerCommandQueue("extra" as any)
        bus.addCommand(SelectionChangedEvent)

        bus.clearAll()

        for(const queue of bus.commands.values()) {
            expect(queue.length).toBe(0)
        }
    })
})
