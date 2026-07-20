import type { Entity } from "../entities/entity";

export interface Engine {
    addEntity(entity: Entity): void;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: string, data?: unknown): void;
}
