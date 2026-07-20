import type { Entity } from "../entities/entity"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { System } from "../systems/system"
import { v4 as uuid } from "uuid"
import { EntityRegistry } from "../lib/entityRegistry"
import { NodeManager } from "../lib/nodeManager"
import { EventBus } from "../lib/eventBus"
import { CommandBus } from "../lib/commandBus"
import { SystemRegistry } from "../lib/systemRegistry"
import { Queue } from "../lib/commandQueue"
import type { Engine } from "./engine"

export type EngineEvents =
    "updateDone"
    | "entityAdded"
    | "updateBegin"
    | "dayPassed"
    | "selectionChanged"
    | "entityRemoved"
    | "mouseMoved"
    | "monthPassed"
    | "mouseup"
    | "keydown"
    | "keyup"
    | "mousedown"
    | "click"
    | "componentRemoved"

export type Commands =
    "redraw"
    | "selectEntity"

export type CommandQueueItem = Queue<Commands>
export type EventQueueItem = Queue<EngineEvents>

export class World implements Engine {
    private readonly entityRegistry: EntityRegistry
    private readonly nodeManager: NodeManager
    private readonly eventBus: EventBus
    private readonly commandBus: CommandBus
    private readonly systemRegistry: SystemRegistry

    constructor() {
        this.nodeManager = new NodeManager()
        this.eventBus = new EventBus()
        this.commandBus = new CommandBus()
        this.entityRegistry = new EntityRegistry(this.nodeManager, this.eventBus, this.commandBus)
        this.entityRegistry.setWorld(this)
        this.systemRegistry = new SystemRegistry()
    }

    get events() {
        return this.eventBus.events
    }

    get commands() {
        return this.commandBus.commands
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

    registerCommandQueue(command: Commands) {
        this.commandBus.registerCommandQueue(command)

        return this
    }

    removeCommandQueue(command: Commands) {
        this.commandBus.removeCommandQueue(command)

        return this
    }

    createEntity(id = uuid(), addItToEngine = true) {
        return this.entityRegistry.createEntity(id, addItToEngine)
    }

    getSystem<T extends System>(system: new () => T) {
        return this.systemRegistry.getSystem(system)
    }

    subscribe(event: EngineEvents, callback: (data: any) => void) {
        this.eventBus.subscribe(event, callback)

        return this
    }

    unsubscribe(event: EngineEvents, callback: (data: any) => void) {
        this.eventBus.unsubscribe(event, callback)

        return this
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this.nodeManager.unregisterNodeType(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        keys: Set<Function>,
        converter: (entity: Entity) => T) {
        this.nodeManager.registerNodeType(nodeName, keys, converter)

        return this
    }

    removeEntity(entity: Entity) {
        this.entityRegistry.removeEntity(entity)

        return this
    }

    addEntity(entity: Entity) {
        this.entityRegistry.addEntity(entity)

        return this
    }

    addSystem(system: new () => System) {
        this.systemRegistry.addSystem(system, this)

        return this
    }

    removeSystem(system: new () => System) {
        this.systemRegistry.removeSystem(system)

        return this
    }

    addSubsystem(subsystem: new () => System) {
        this.systemRegistry.addSubsystem(subsystem, this)

        return this
    }

    removeSubSystem(subsystem: new () => System) {
        this.systemRegistry.removeSubSystem(subsystem)

        return this
    }

    update(dt: number) {
        this.eventBus.dispatchEvent("updateBegin", dt)

        this.eventBus.processEventHandlers()

        this.systemRegistry.update(dt)

        this.eventBus.dispatchEvent("updateDone", dt)
    }

    getNodeList<T extends Object>(node: EntityNodeConstructor<T>) {
        return this.nodeManager.getNodeList(node)
    }

    reindexEntity(entity: Entity) {
        this.nodeManager.reindexEntity(entity)

        return this
    }

    addCommand(command: Commands, data: any) {
        this.commandBus.addCommand(command, data)

        return this
    }

    getCommands(type: Commands) {
        return this.commandBus.getCommandQueue(type)
    }

    dispatchEvent(name: EngineEvents, data: any) {
        this.eventBus.dispatchEvent(name, data)

        return this
    }

    registerEventQueue(event: EngineEvents) {
        this.eventBus.registerEventQueue(event)

        return this
    }

    removeEventQueue(event: EngineEvents) {
        this.eventBus.removeEventQueue(event)

        return this
    }
}
