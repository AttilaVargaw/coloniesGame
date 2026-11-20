import { Entity } from "../entities/entity"
import { EventBase } from "./events/EventBase"

export { EventBase }

export interface PointerEventData {
    x: number
    y: number
    button: number
    shiftKey: boolean
    ctrlKey: boolean
    altKey: boolean
    metaKey: boolean
    preventDefault(): void
    stopPropagation(): void
    type: string
    timeStamp: number
    isTrusted: boolean
}

export class EntityAddedEvent extends EventBase<Entity> { }
export class EntityRemovedEvent extends EventBase<Entity> { }
export class DayPassedEvent extends EventBase<void> { }
export class HourPassedEvent extends EventBase<void> { }
export class MonthPassedEvent extends EventBase<void> { }
export class SelectionChangedEvent extends EventBase<{ data?: Entity, type: string }> { }
export class IndustryUpdatedEvent extends EventBase<Entity> { }
export class TargetChangedEvent extends EventBase<{ ship: Entity, target?: Entity }> { }
export class ComponentRemovedEvent extends EventBase<unknown> { }

export class ClickEventData extends EventBase<PointerEventData> { }

export class KeydownEvent extends EventBase<{ key: string; preventDefault(): void }> { }
export class KeyupEvent extends EventBase<{ key: string }> { }
export class MousedownEvent extends EventBase<PointerEventData> { }
export class MousemoveEvent extends EventBase<PointerEventData> { }
export class MouseupEvent extends EventBase<PointerEventData> { }

export class ContextMenuEvent extends EventBase<{ x: number, y: number }> { }

export class ContextMenuOpenEvent extends EventBase<{ entity: Entity, screenX: number, screenY: number }> { }
export { IndustryTickCompletedEvent } from "./events/IndustryTickCompletedEvent"