import { Queue } from "./commandQueue"
import type { EventBase } from "./events"
import {
    UpdateBeginEvent,
    // UpdateDoneEvent,
    EntityAddedEvent,
    EntityRemovedEvent,
    DayPassedEvent,
    HourPassedEvent,
    MonthPassedEvent,
    SelectionChangedEvent,
    ComponentRemovedEvent,
    ClickEventData,
    MouseupEvent,
    KeydownEvent,
    KeyupEvent,
    MousedownEvent,
    MousemoveEvent,
} from "./events"

export class EventBus {

    readonly events: Map<new (...args: any[]) => EventBase, Queue<EventBase>> = new Map([
        [UpdateBeginEvent, new Queue()],
        // [UpdateDoneEvent, new Queue()],
        [EntityAddedEvent, new Queue()],
        [EntityRemovedEvent, new Queue()],
        [DayPassedEvent, new Queue()],
        [HourPassedEvent, new Queue()],
        [MonthPassedEvent, new Queue()],
        [SelectionChangedEvent, new Queue()],
        [ComponentRemovedEvent, new Queue()],
        [ClickEventData, new Queue()],
        [MouseupEvent, new Queue()],
        [KeydownEvent, new Queue()],
        [KeyupEvent, new Queue()],
        [MousedownEvent, new Queue()],
        [MousemoveEvent, new Queue()],
    ])

    private readonly eventHandlers = new Map<new (...args: any[]) => EventBase, Set<(data: unknown) => void>>()


    processEventHandler(event: new (...args: any[]) => EventBase) {
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


    subscribe<T extends EventBase>(event: new (...args: any[]) => EventBase, callback: (data: T["data"]) => void) {
        if(event === MousemoveEvent) {
            console.log("subscribing to mousemove")
        }
        if(!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set([callback]))
        } else {
            this.eventHandlers.get(event)!.add(callback)
        }

        return this
    }


    unsubscribe(event: new (...args: any[]) => EventBase, callback: (data: unknown) => void) {
        this.eventHandlers.get(event)?.delete(callback)

        return this
    }

    dispatchEvent(event: EventBase) {

        this.events.get(event.constructor as new (...args: any[]) => EventBase)?.enqueue(event)

        return this
    }


    registerEventQueue(event: new (...args: any[]) => EventBase) {
        this.events.set(event, new Queue())

        return this
    }


    removeEventQueue(event: new (...args: any[]) => EventBase) {
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
