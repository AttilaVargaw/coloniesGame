import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { System } from "../systems/system"
import { EntityRegistry } from "../lib/entityRegistry"
import { NodeManager } from "../lib/nodeManager"
import { EventBus } from "../lib/eventBus"
import { CommandBus } from "../lib/commandBus"
import { SystemRegistry } from "../lib/systemRegistry"
import type { Engine } from "./engine"
import type { CommandBase } from "../lib/CommandBase"
import type { EventBase } from "../lib/events"
import type { Queue } from "../lib/commandQueue"
import { DebugManager } from "../lib/debugManager"
import { CanvasManager } from "../systems/canvasManager"
import { EntityComponent } from "../entities/entityComponent"

export class World implements Engine {
    private readonly entityRegistry: EntityRegistry
    private readonly nodeManager: NodeManager
    private readonly eventBus: EventBus
    private readonly commandBus: CommandBus
    private readonly systemRegistry: SystemRegistry
    private readonly debugManager: DebugManager
    private readonly canvasManager: CanvasManager = new CanvasManager()

    constructor() {
        this.nodeManager = new NodeManager()
        this.eventBus = new EventBus()
        this.commandBus = new CommandBus()
        this.entityRegistry = new EntityRegistry(this.nodeManager, this.eventBus)
        this.systemRegistry = new SystemRegistry()
        this.debugManager = new DebugManager()
    }

    getCanvas(canvas: "webgl2" | "2d"): HTMLCanvasElement {
        switch(canvas) {
            case "webgl2":
                return this.canvasManager.webglCanvas
            case "2d":
                return this.canvasManager.canvas
            default:
                throw new Error(`Unknown canvas type: ${canvas}`)
        }
    }

    getEntityById(id: string): Entity | void {
        return this.entityRegistry.getEntityById(id)
    }

    getEvents<T extends EventBase>(event: new (...args: any[]) => T): Queue<T> {
        return this.eventBus.events.get(event) as unknown as Queue<T>
    }

    getCommands<T extends CommandBase>(command: new (...args: any[]) => T): Queue<T> {
        return this.commandBus.commands.get(command) as unknown as Queue<T>
    }

    nodes<Key extends EntityNodeConstructor>(key: Key) {
        return this.nodeManager.nodes(key)
    }

    destruct() {
        this.systemRegistry.clear()
        this.entityRegistry.clear()
        this.nodeManager.clear()
        this.commandBus.clearAll()
        this.eventBus.clearEvents()
        this.eventBus.clearHandlers()
    }

    registerCommandQueue(command: new (...args: any[]) => CommandBase): this {
        this.commandBus.registerCommandQueue(command)
        return this
    }

    removeCommandQueue(command: new (...args: any[]) => CommandBase): this {
        this.commandBus.removeCommandQueue(command)
        return this
    }

    getSceneNode(entity: Entity): SceneNode | undefined {
        return this.entityRegistry.getSceneNode(entity)
    }

    getAllEntities(): Entity[] {
        return this.entityRegistry.getAllEntities()
    }

    getSystem<T extends System>(system: new (...args: any[]) => T): T {
        return this.systemRegistry.getSystem(system)
    }

    subscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this {
        this.eventBus.subscribe(event, callback)
        return this
    }

    unsubscribe<T extends EventBase>(event: new (...args: any[]) => T, callback: (data: T["data"]) => void): this {
        this.eventBus.unsubscribe(event, callback)
        return this
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this.nodeManager.unregisterNodeType(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        keys: Set<new (...args: any[]) => EntityComponent>,
        converter: (entity: Entity) => T): this {
        this.nodeManager.registerNodeType(nodeName, keys, converter)
        return this
    }

    removeEntity(entity: Entity) {
        this.entityRegistry.removeEntity(entity)
        return this
    }

    addEntity(entity: Entity, parentEntity?: Entity | null) {
        this.entityRegistry.addEntity(entity, parentEntity)
        return this
    }

    addSystem(system: new (...args: any[]) => System, ...args: any[]) {
        this.systemRegistry.addSystem(system, this, ...args)
        return this
    }

    removeSystem(system: new (...args: any[]) => System) {
        this.systemRegistry.removeSystem(system)
        return this
    }

    update(dt: number) {
        this.eventBus.processEventHandlers()
        this.systemRegistry.update(dt)
        this.eventBus.processEventHandlers()
    }

    getNodeList<T extends EntityNode>(node: EntityNodeConstructor<T>): T[] {
        return this.nodeManager.getNodeList(node)
    }

    reindexEntity(entity: Entity) {
        const sceneNode = this.entityRegistry.getSceneNode(entity)
        this.nodeManager.reindexEntity(entity, sceneNode)
        return this
    }

    addCommand(command: CommandBase) {
        this.commandBus.addCommand(command)
        return this
    }

    dispatchEvent(event: EventBase) {
        this.eventBus.dispatchEvent(event)
        return this
    }

    registerEventQueue<T extends EventBase>(event: new (...args: any[]) => T): this {
        this.eventBus.registerEventQueue(event)
        return this
    }

    removeEventQueue<T extends EventBase>(event: new (...args: any[]) => T): this {
        this.eventBus.removeEventQueue(event)
        return this
    }

    getDebugManager() {
        return this.debugManager
    }
}