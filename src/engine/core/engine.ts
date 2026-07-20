import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";
import { System } from "../systems/system";

export interface Engine {
    getSystem<T extends System>(system: new (...args: unknown[]) => T): T;
    createEntity(): Entity;
    addEntity(entity: Entity, parentEntity?: Entity | null): void;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: string, data?: unknown): void;
    getSceneNode(entity: Entity): SceneNode | undefined;
}
