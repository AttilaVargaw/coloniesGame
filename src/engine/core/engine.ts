/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";
import { System } from "../systems/system";
import { EventBase } from "../lib/events";

export interface Engine {
    getSystem<T extends System>(system: new (...args: any[]) => T): T;
    createEntity(): Entity;
    addEntity(entity: Entity, parentEntity?: Entity | null): this;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: EventBase): void;
    getSceneNode(entity: Entity): SceneNode | undefined;
    subscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T) => void): void;
    unsubscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T) => void): void;
}
