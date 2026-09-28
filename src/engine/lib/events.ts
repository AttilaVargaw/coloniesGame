import { Entity } from "../entities/entity"
import { MouseEvent as ReactMouseEvent } from "react"

export type MouseEventData = {
    x: number
    y: number
} & ReactMouseEvent


export abstract class EventBase<T = any> {
    constructor(public data: T) { }
}

export class EntityAddedEvent extends EventBase<Entity> { }
export class EntityRemovedEvent extends EventBase<Entity> { }
export class DayPassedEvent extends EventBase<null> { }
export class HourPassedEvent extends EventBase<null> { }
export class MonthPassedEvent extends EventBase<null> { }
export class SelectionChangedEvent extends EventBase<{ data: Entity, type: string }> { }
export class IndustryUpdatedEvent extends EventBase<Entity> { }
export class TargetChangedEvent extends EventBase<{ ship: Entity, target?: Entity }> { }
export class ComponentRemovedEvent extends EventBase<unknown> { }

export class ClickEventData extends EventBase<MouseEventData> { }

export class KeydownEvent extends EventBase<KeyboardEvent> { }
export class KeyupEvent extends EventBase<KeyboardEvent> { }
export class MousedownEvent extends EventBase<MouseEventData> { }
export class MousemoveEvent extends EventBase<MouseEventData> { }
export class MouseupEvent extends EventBase<MouseEventData> { }

export class ContextMenuEvent extends EventBase<{ x: number, y: number }> { }

export class ContextMenuOpenEvent extends EventBase<{ entity: Entity, screenX: number, screenY: number }> { }
