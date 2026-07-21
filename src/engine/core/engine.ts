import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";
import { System } from "../systems/system";
import { EventBase } from "../lib/events";

export interface Engine {
    getSystem<T extends System>(system: new (...args: unknown[]) => T): T;
    createEntity(): Entity;
    addEntity(entity: Entity, parentEntity?: Entity | null): this;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: EventBase): void;
    getSceneNode(entity: Entity): SceneNode | undefined;
}
