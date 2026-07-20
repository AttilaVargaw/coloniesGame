import type { Entity } from "@engine/entities/entity";

export interface Modifier {
    onAdd(entity: Entity): Entity;
    onRemove(entity: Entity): Entity;
}
