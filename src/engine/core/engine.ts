
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";
import { System } from "../systems/system";
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode";
import { EventBase } from "../lib/events";
import { CommandBase } from "../lib/CommandBase";
import { DebugManager } from "../lib/debugManager";

export interface Engine {
    getSystem<T extends System>(system: new (...args: any[]) => T): T;
    // createEntity(id?: string): Entity;
    addEntity(entity: Entity, parentEntity?: Entity | null): this;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): void;
    dispatchEvent(event: EventBase): this;
    getSceneNode(entity: Entity): SceneNode | undefined;
    subscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this;
    unsubscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this;
    registerNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>, keys: Set<Function>, converter: (entity: Entity) => T): this;
    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void;
    getNodeList<T extends EntityNode>(node: EntityNodeConstructor<T>): T[];
    getAllEntities(): Entity[];
    getEntityById(id: string): Entity | undefined;
    addCommand(command: CommandBase): void;
    getCommands<T extends CommandBase>(command: new (...args: any[]) => T): any;
    registerCommandQueue(command: Function): this;
    removeCommandQueue(command: Function): this;
    addSystem(system: new (...args: any[]) => System, ...args: any[]): this;
    removeSystem(system: new (...args: any[]) => System): this;
    getEvents<T extends EventBase>(name: new (...args: any[]) => T): any;
    update(dt: number): void;
    destruct(): void;
    getDebugManager(): DebugManager;
    registerEventQueue(event: Function): this;
    getCanvas(canvas: "webgl2" | "2d"): HTMLCanvasElement;
}
