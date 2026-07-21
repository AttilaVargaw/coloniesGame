import { Entity } from "../entities/entity"

export abstract class EventBase<T = any> {
    constructor(public data: T) { }
}

export class UpdateBeginEvent extends EventBase<number> {}
export class UpdateDoneEvent extends EventBase<number> {}
export class EntityAddedEvent extends EventBase<Entity> {}
export class EntityRemovedEvent extends EventBase<Entity> {}
export class DayPassedEvent extends EventBase<null> {}
export class MonthPassedEvent extends EventBase<null> {}
export class SelectionChangedEvent extends EventBase<{ data: Entity, type: string }> {}
export class ComponentRemovedEvent extends EventBase<unknown> {}

export type ClickEventData = { event: globalThis.MouseEvent; x: number; y: number }
export class ClickEvent extends EventBase<ClickEventData> {}

export type MouseupEventData = { name: string; data: { x: number; y: number; event: globalThis.MouseEvent } }
export class MouseupEvent extends EventBase<MouseupEventData> {}

export class KeydownEvent extends EventBase<globalThis.KeyboardEvent> {}
export class KeyupEvent extends EventBase<globalThis.KeyboardEvent> {}
export class MousedownEvent extends EventBase<ClickEventData> {}
export class MousemoveEvent extends EventBase<ClickEventData> {}
