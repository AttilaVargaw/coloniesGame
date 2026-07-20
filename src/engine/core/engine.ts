import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";

export interface Engine {
    addEntity(entity: Entity): void;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: string, data?: unknown): void;
    getSceneNode(entity: Entity): SceneNode | undefined;
}
