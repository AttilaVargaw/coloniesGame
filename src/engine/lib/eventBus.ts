import { Queue, QueueItem } from "./commandQueue"
import type { EventBase } from "./events"
import {
    UpdateBeginEvent,
    UpdateDoneEvent,
    EntityAddedEvent,
    EntityRemovedEvent,
    DayPassedEvent,
    MonthPassedEvent,
    SelectionChangedEvent,
    ComponentRemovedEvent,
    ClickEvent,
    MouseupEvent,
    KeydownEvent,
    KeyupEvent,
    MousedownEvent,
    MousemoveEvent,
} from "./events"

export class EventBus {
    readonly events: Map<Function, Queue<unknown>> = new Map([
        [UpdateBeginEvent, new Queue()],
        [UpdateDoneEvent, new Queue()],
        [EntityAddedEvent, new Queue()],
        [EntityRemovedEvent, new Queue()],
        [DayPassedEvent, new Queue()],
        [MonthPassedEvent, new Queue()],
        [SelectionChangedEvent, new Queue()],
        [ComponentRemovedEvent, new Queue()],
        [ClickEvent, new Queue()],
        [MouseupEvent, new Queue()],
        [KeydownEvent, new Queue()],
        [KeyupEvent, new Queue()],
        [MousedownEvent, new Queue()],
        [MousemoveEvent, new Queue()],
    ])

    private readonly eventHandlers = new Map<Function, Set<(data: unknown) => void>>()

    processEventHandler(event: Function) {
        const handlers = this.eventHandlers.get(event)
        const events = this.events.get(event)

        if(!handlers?.size || !events?.length) {
            return
        }

        for(const eventItem of events) {
            for(const handler of handlers) {
                handler(eventItem.data)
            }
        }

        events.clear()
    }

    subscribe(event: Function, callback: (data: unknown) => void) {
        if(!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set([callback]))

            return this
        }

        this.eventHandlers.get(event)?.add(callback)

        return this
    }

    unsubscribe(event: Function, callback: (data: unknown) => void) {
        this.eventHandlers.get(event)?.delete(callback)

        return this
    }

    dispatchEvent(event: EventBase) {
        this.events.get(event.constructor)?.enqueue({ data: event.data })

        return this
    }

    registerEventQueue(event: Function) {
        this.events.set(event, new Queue())

        return this
    }

    removeEventQueue(event: Function) {
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
