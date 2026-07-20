import { Queue, QueueItem } from "./commandQueue"
import type { EngineEvents } from "../core/world"

export class EventBus {
    readonly events: Map<EngineEvents, Queue<unknown>> = new Map([
        ["updateDone", new Queue()],
        ["entityAdded", new Queue()],
        ["updateBegin", new Queue()],
        ["dayPassed", new Queue()],
        ["selectionChanged", new Queue()],
        ["entityRemoved", new Queue()],
        ["mouseMoved", new Queue()],
        ["monthPassed", new Queue()],
        ["mouseup", new Queue()],
        ["mousedown", new Queue()],
        ["click", new Queue()],
        ["keydown", new Queue()],
        ["keyup", new Queue()],
        ["componentRemoved", new Queue()],
    ])

    private readonly eventHandlers = new Map<string, Set<(data: unknown) => void>>()

    subscribe(event: EngineEvents, callback: (data: unknown) => void) {
        if(!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set([callback]))

            return this
        }

        this.eventHandlers.get(event)?.add(callback)

        return this
    }

    unsubscribe(event: EngineEvents, callback: (data: unknown) => void) {
        this.eventHandlers.get(event)?.delete(callback)

        return this
    }

    dispatchEvent(name: EngineEvents, data: unknown) {
        this.events.get(name)?.enqueue({ data })

        return this
    }

    registerEventQueue(event: EngineEvents) {
        this.events.set(event, new Queue())

        return this
    }

    removeEventQueue(event: EngineEvents) {
        this.events.delete(event)

        return this
    }

    processEventHandlers() {
        for(const [eventType, eventQueue] of this.events.entries()) {
            const handlers = this.eventHandlers.get(eventType)

            if(!handlers) {
                continue
            }

            for(const event of eventQueue) {
                for(const handler of handlers) {
                    handler(event.data)
                }
            }

            eventQueue.clear()
        }
    }

    clearHandlers() {
        this.eventHandlers.clear()
    }

    clearEvents() {
        for(const eventQueue of this.events.values()) {
            eventQueue.clear()
        }
    }
}

export type { QueueItem }
