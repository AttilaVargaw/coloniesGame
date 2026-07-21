import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventBus } from "./eventBus"
import {
    UpdateBeginEvent,
    UpdateDoneEvent,
    EntityAddedEvent,
    EntityRemovedEvent,
    DayPassedEvent,
    MonthPassedEvent,
    SelectionChangedEvent,
    ComponentRemovedEvent,
    ClickEventData,
    MouseupEvent,
    KeydownEvent,
    KeyupEvent,
    MousedownEvent,
    MousemoveEvent,
    EventBase,
} from "./events"
import { Entity } from "../entities/entity"

if(typeof globalThis.KeyboardEvent === "undefined") {
    class MockKeyboardEvent extends Event {
        key: string
        constructor(key: string) {
            super("keydown")
            this.key = key
        }
    }
    globalThis.KeyboardEvent = MockKeyboardEvent as any
}

describe("EventBus", () => {
    let bus: EventBus

    beforeEach(() => {
        bus = new EventBus()
    })

    describe("initialization", () => {
        it("pre-populates the expected default event queues", () => {
            expect(bus.events.size).toBe(14)
            expect(bus.events.has(UpdateBeginEvent)).toBe(true)
            expect(bus.events.has(UpdateDoneEvent)).toBe(true)
            expect(bus.events.has(EntityAddedEvent)).toBe(true)
            expect(bus.events.has(EntityRemovedEvent)).toBe(true)
            expect(bus.events.has(DayPassedEvent)).toBe(true)
            expect(bus.events.has(MonthPassedEvent)).toBe(true)
            expect(bus.events.has(SelectionChangedEvent)).toBe(true)
            expect(bus.events.has(ComponentRemovedEvent)).toBe(true)
            expect(bus.events.has(ClickEventData)).toBe(true)
            expect(bus.events.has(MouseupEvent)).toBe(true)
            expect(bus.events.has(KeydownEvent)).toBe(true)
            expect(bus.events.has(KeyupEvent)).toBe(true)
            expect(bus.events.has(MousedownEvent)).toBe(true)
            expect(bus.events.has(MousemoveEvent)).toBe(true)
        })

        it("starts with no registered handlers", () => {
            expect(bus.events.size).toBeGreaterThan(0)

            for(const queue of bus.events.values()) {
                expect(queue.length).toBe(0)
            }
        })
    })

    describe("dispatchEvent", () => {
        it("enqueues event data for the matching event class", () => {
            bus.dispatchEvent(new UpdateBeginEvent(16))

            const queue = bus.events.get(UpdateBeginEvent)!
            expect(queue.length).toBe(1)
            expect(queue.peek()?.data).toBe(16)
        })

        it("is a no-op for unregistered event classes", () => {
            class CustomEvent extends EventBase<{ value: number }> {}
            bus.dispatchEvent(new CustomEvent({ value: 42 }))

            expect(bus.events.has(CustomEvent)).toBe(false)
        })

        it("returns itself for chaining", () => {
            expect(bus.dispatchEvent(new UpdateBeginEvent(1))).toBe(bus)
        })
    })

    describe("subscribe / unsubscribe", () => {
        it("registers a handler for an event class", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateBeginEvent, handler)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.processEventHandler(UpdateBeginEvent)

            expect(handler).toHaveBeenCalledWith(16)
        })

        it("supports multiple handlers for the same event class", () => {
            const handlerA = vi.fn()
            const handlerB = vi.fn()

            bus.subscribe(UpdateBeginEvent, handlerA)
            bus.subscribe(UpdateBeginEvent, handlerB)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.processEventHandler(UpdateBeginEvent)

            expect(handlerA).toHaveBeenCalledWith(16)
            expect(handlerB).toHaveBeenCalledWith(16)
        })

        it("invokes handlers with the correct payload for complex events", () => {
            const handler = vi.fn()
            const entity = new Entity("e1")

            bus.subscribe(EntityAddedEvent, handler)
            bus.dispatchEvent(new EntityAddedEvent(entity))
            bus.processEventHandler(EntityAddedEvent)

            expect(handler).toHaveBeenCalledWith(entity)
        })

        it("does not invoke handlers after unsubscribe", () => {
            const handler = vi.fn()

            bus.subscribe(UpdateBeginEvent, handler)
            bus.unsubscribe(UpdateBeginEvent, handler)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.processEventHandler(UpdateBeginEvent)

            expect(handler).not.toHaveBeenCalled()
        })

        it("returns itself for chaining", () => {
            const handler = vi.fn()

            expect(bus.subscribe(UpdateBeginEvent, handler)).toBe(bus)
            expect(bus.unsubscribe(UpdateBeginEvent, handler)).toBe(bus)
        })
    })

    describe("processEventHandler", () => {
        it("invokes handlers for the specified event class", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateDoneEvent, handler)

            bus.dispatchEvent(new UpdateDoneEvent(32))
            bus.processEventHandler(UpdateDoneEvent)

            expect(handler).toHaveBeenCalledWith(32)
        })

        it("clears the event queue after processing", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateDoneEvent, handler)

            bus.dispatchEvent(new UpdateDoneEvent(32))
            bus.processEventHandler(UpdateDoneEvent)

            expect(bus.events.get(UpdateDoneEvent)!.length).toBe(0)
        })

        it("is a no-op when there are no handlers", () => {
            bus.dispatchEvent(new UpdateDoneEvent(32))
            bus.processEventHandler(UpdateDoneEvent)

            expect(bus.events.get(UpdateDoneEvent)!.length).toBe(1)
        })

        it("is a no-op when the queue is empty", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateDoneEvent, handler)

            bus.processEventHandler(UpdateDoneEvent)

            expect(handler).not.toHaveBeenCalled()
        })

        it("processes all queued events for the same handler", () => {
            const handler = vi.fn()

            bus.subscribe(DayPassedEvent, handler)
            bus.dispatchEvent(new DayPassedEvent(null))
            bus.dispatchEvent(new DayPassedEvent(null))

            bus.processEventHandler(DayPassedEvent)

            expect(handler).toHaveBeenCalledTimes(2)
        })
    })

    describe("processEventHandlers", () => {
        it("processes all event queues and clears them", () => {
            const updateHandler = vi.fn()
            const clickHandler = vi.fn()

            bus.subscribe(UpdateBeginEvent, updateHandler)
            bus.subscribe(ClickEventData, clickHandler)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.dispatchEvent(new ClickEventData({ event: {} as globalThis.MouseEvent, x: 0, y: 0 }))

            bus.processEventHandlers()

            expect(updateHandler).toHaveBeenCalledWith(16)
            expect(clickHandler).toHaveBeenCalledWith({ event: {} as globalThis.MouseEvent, x: 0, y: 0 })
            expect(bus.events.get(UpdateBeginEvent)!.length).toBe(0)
            expect(bus.events.get(ClickEventData)!.length).toBe(0)
        })

        it("skips event types with no registered handlers", () => {
            bus.dispatchEvent(new MonthPassedEvent(null))
            bus.dispatchEvent(new KeydownEvent(new KeyboardEvent("keydown")))

            expect(() => bus.processEventHandlers()).not.toThrow()
        })
    })

    describe("registerEventQueue / removeEventQueue", () => {
        it("registerEventQueue adds a new queue for a custom event class", () => {
            class CustomEvent extends EventBase<{ id: number }> {}

            bus.registerEventQueue(CustomEvent)

            expect(bus.events.has(CustomEvent)).toBe(true)
            expect(bus.events.get(CustomEvent)!.length).toBe(0)
        })

        it("removeEventQueue removes an existing queue", () => {
            bus.removeEventQueue(KeydownEvent)

            expect(bus.events.has(KeydownEvent)).toBe(false)
        })

        it("returns itself for chaining", () => {
            class CustomEvent extends EventBase<{ id: number }> {}

            expect(bus.registerEventQueue(CustomEvent)).toBe(bus)
            expect(bus.removeEventQueue(CustomEvent)).toBe(bus)
        })
    })

    describe("clearHandlers / clearEvents", () => {
        it("clearHandlers removes all subscribed handlers", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateBeginEvent, handler)
            bus.subscribe(ClickEventData, handler)

            bus.clearHandlers()

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.dispatchEvent(new ClickEventData({ event: {} as globalThis.MouseEvent, x: 0, y: 0 }))
            bus.processEventHandlers()

            expect(handler).not.toHaveBeenCalled()
        })

        it("clearEvents empties all event queues without affecting handlers", () => {
            const handler = vi.fn()
            bus.subscribe(UpdateBeginEvent, handler)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.dispatchEvent(new UpdateBeginEvent(32))
            bus.clearEvents()

            expect(bus.events.get(UpdateBeginEvent)!.length).toBe(0)

            bus.dispatchEvent(new UpdateBeginEvent(64))
            bus.processEventHandler(UpdateBeginEvent)

            expect(handler).toHaveBeenCalledWith(64)
        })
    })

    describe("edge cases", () => {
        it("ignores unsubscribe for an event with no handlers", () => {
            expect(() => bus.unsubscribe(KeydownEvent, vi.fn())).not.toThrow()
        })

        it("ignores processEventHandler for an unregistered event class", () => {
            class UnknownEvent extends EventBase<string> {}

            expect(() => bus.processEventHandler(UnknownEvent)).not.toThrow()
        })

        it("does not share handlers between different event classes", () => {
            const handlerA = vi.fn()
            const handlerB = vi.fn()

            bus.subscribe(UpdateBeginEvent, handlerA)
            bus.subscribe(UpdateDoneEvent, handlerB)

            bus.dispatchEvent(new UpdateBeginEvent(16))
            bus.processEventHandler(UpdateBeginEvent)

            expect(handlerA).toHaveBeenCalledWith(16)
            expect(handlerB).not.toHaveBeenCalled()
        })

        it("preserves previously registered handlers when removing a queue", () => {
            bus.removeEventQueue(KeydownEvent)

            bus.registerEventQueue(KeydownEvent)

            const handler = vi.fn()
            bus.subscribe(KeydownEvent, handler)

            bus.dispatchEvent(new KeydownEvent(new KeyboardEvent("keydown")))
            bus.processEventHandler(KeydownEvent)

            expect(handler).toHaveBeenCalledTimes(1)
        })
    })
})
