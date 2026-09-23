import type { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import type { System } from "../systems/system"
import { v4 as uuid } from "uuid"
import { EntityRegistry } from "../lib/entityRegistry"
import { NodeManager } from "../lib/nodeManager"
import { EventBus } from "../lib/eventBus"
import { CommandBus } from "../lib/commandBus"
import { SystemRegistry } from "../lib/systemRegistry"
import type { Engine } from "./engine"
import { CommandBase } from "../lib/CommandBase"
import { EventBase } from "../lib/events"
import { UpdateBeginEvent, } from "../lib/events"
import { Queue } from "../lib/commandQueue"
import { DebugManager } from "../lib/debugManager"

export class World implements Engine {
    private readonly entityRegistry: EntityRegistry
    private readonly nodeManager: NodeManager
    private readonly eventBus: EventBus
    private readonly commandBus: CommandBus
    private readonly systemRegistry: SystemRegistry
    private readonly debugManager: DebugManager

    constructor() {
        this.nodeManager = new NodeManager()
        this.eventBus = new EventBus()
        this.commandBus = new CommandBus()
        this.entityRegistry = new EntityRegistry(this.nodeManager, this.eventBus)
        this.systemRegistry = new SystemRegistry()
        this.debugManager = new DebugManager()
    }


    getEvents<T extends new (...args: any) => EventBase<any>>(name: T) {
        return this.eventBus.events.get(name) as unknown as Queue<InstanceType<T> extends EventBase<infer U> ? U : never>
    }


    getCommands<T extends new (...args: any) => CommandBase>(name: T) {
        return this.commandBus.commands.get(name) as unknown as Queue<InstanceType<T>>
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

    // eslint-disable-next-line 
    registerCommandQueue(command: Function) {
        this.commandBus.registerCommandQueue(command)

        return this
    }

    // eslint-disable-next-line 
    removeCommandQueue(command: Function) {
        this.commandBus.removeCommandQueue(command)

        return this
    }

    createEntity(id = uuid()) {
        return this.entityRegistry.createEntity(id)
    }

    getSceneNode(entity: Entity): SceneNode | undefined {
        return this.entityRegistry.getSceneNode(entity)
    }

    getAllEntities(): Entity[] {
        return this.entityRegistry.getAllEntities()
    }

    getSystem<T extends System>(system: new (...args: any[]) => T) {
        return this.systemRegistry.getSystem(system)
    }

    // eslint-disable-next-line
    //@ts-ignore

    subscribe<T extends EventBase>(event: new (...args: any[]) => EventBase, callback: (data: T["data"]) => void): this {
        this.eventBus.subscribe(event, callback)

        return this
    }

    // eslint-disable-next-line
    //@ts-ignore 

    unsubscribe(event: new (...args: any[]) => EventBase, callback: (data: any) => void): this {
        this.eventBus.unsubscribe(event, callback)

        return this
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this.nodeManager.unregisterNodeType(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        keys: Set<Function>,
        converter: (entity: Entity) => T) {
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
        this.systemRegistry.addSystem(system, this, ...args.map(cn => this.getSystem(cn)))

        return this
    }


    removeSystem(system: new (...args: any[]) => System) {
        this.systemRegistry.removeSystem(system)

        return this
    }

    update(dt: number) {
        this.eventBus.dispatchEvent(new UpdateBeginEvent(dt))

        this.eventBus.processEventHandlers()

        this.systemRegistry.update(dt)

        this.eventBus.processEventHandlers()

        // this.eventBus.dispatchEvent(new UpdateDoneEvent(dt))
        // this.eventBus.processEventHandler(UpdateDoneEvent)
    }

    getNodeList<T extends EntityNode>(node: EntityNodeConstructor<T>) {
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
    // eslint-disable-next-line
    registerEventQueue(event: Function) {

        this.eventBus.registerEventQueue(event as new (...args: any[]) => EventBase)

        return this
    }
    // eslint-disable-next-line
    removeEventQueue(event: Function) {

        this.eventBus.removeEventQueue(event as new (...args: any[]) => EventBase)

        return this
    }

    getDebugManager() {
        return this.debugManager
    }
}
