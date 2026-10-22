import type { Entity } from "../entities/entity";
import { SceneNode } from "../entities/sceneNode";
import type { System } from "../systems/system";
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode";
import type { EventBase } from "../lib/events";
import type { CommandBase } from "../lib/CommandBase";
import { DebugManager } from "../lib/debugManager";
import { EntityComponent } from "../entities/entityComponent";
import { Queue } from "../lib/commandQueue";

export interface Engine {
    getSystem<T extends System>(system: new (...args: any[]) => T): T;
    addEntity(entity: Entity, parentEntity?: Entity | null): this;
    removeEntity(entity: Entity): void;
    reindexEntity(entity: Entity): this;
    dispatchEvent(event: EventBase): this;
    getSceneNode(entity: Entity): SceneNode | void;
    subscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this;
    unsubscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this;
    registerNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>, keys: Set<new (...args: any[]) => EntityComponent>, converter: (entity: Entity) => T): this;
    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void;
    getNodeList<T extends EntityNode>(node: EntityNodeConstructor<T>): T[];
    getAllEntities(): Entity[];
    getEntityById(id: string): Entity | void;
    addCommand(command: CommandBase): void;
    getCommands<T extends CommandBase>(command: new (...args: any[]) => T): Queue<T>;
    registerCommandQueue(command: new (...args: any[]) => CommandBase): this;
    removeCommandQueue(command: new (...args: any[]) => CommandBase): this;
    addSystem(system: new (...args: any[]) => System, ...args: any[]): this;
    removeSystem(system: new (...args: any[]) => System): this;
    getEvents<T extends EventBase>(event: new (...args: any[]) => T): Queue<T>;
    update(dt: number): void;
    destruct(): void;
    getDebugManager(): DebugManager;
    registerEventQueue<T extends EventBase>(event: new (...args: any[]) => T): this;
    removeEventQueue<T extends EventBase>(event: new (...args: any[]) => T): this;
    getCanvas(canvas: "webgl2" | "2d"): HTMLCanvasElement;
}