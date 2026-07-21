import { Entity } from "../entities/entity"
import { MouseEvent as ReactMouseEvent } from "react"

export interface MouseEventData extends ReactMouseEvent {
    x: number
    y: number
}

// eslint-disable-next-line
export abstract class EventBase<T = any> {
    constructor(public data: T) { }
}

export class UpdateBeginEvent extends EventBase<number> { }
export class UpdateDoneEvent extends EventBase<number> { }
export class EntityAddedEvent extends EventBase<Entity> { }
export class EntityRemovedEvent extends EventBase<Entity> { }
export class DayPassedEvent extends EventBase<null> { }
export class MonthPassedEvent extends EventBase<null> { }
export class SelectionChangedEvent extends EventBase<{ data: Entity, type: string }> { }
export class ComponentRemovedEvent extends EventBase<unknown> { }

// export type ClickEventData = { event: MouseEvent; x: number; y: number }
export class ClickEventData extends EventBase<MouseEventData> { }
export type MouseupEventData = { name: string; data: { x: number; y: number; event: MouseEvent } }
export class MouseupEvent extends EventBase<MouseupEventData> { }

export class KeydownEvent extends EventBase<KeyboardEvent> { }
export class KeyupEvent extends EventBase<KeyboardEvent> { }
export class MousedownEvent extends EventBase<MouseEventData> { }
export class MousemoveEvent extends EventBase<MouseEventData> { }
