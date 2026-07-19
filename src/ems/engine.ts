import { Entity } from "./entities/entity"
import type { System } from "./systems/system"
import { EntityNode, EntityNodeConstructor } from "./entities/entityNode"
import { v4 as uuid } from "uuid"
import { LabelComponent } from "./components/label"

export type EngineEvents = "updateDone"
    | "entityAdded"
    | "updateBegin"
    | "dayPassed"
    | "selectionChanged"
    | "entityRemoved"
    | "mouseMoved"
    | "monthPassed"

export type Commands = "keydown"
    | "click"
    | "redraw"
    | "selectEntity"
    | "mouseMoved"
    | "mousedown"
    | "mouseup"

export type Command = { name: Commands, data: any }

export class Engine {
    private readonly entities: Map<string, Entity> = new Map()
    private readonly systems: Map<new (engine: Engine) => System, System> = new Map()
    private readonly subSystems: Map<new (engine: Engine) => System, System> = new Map()
    private readonly nodes = new Map<typeof EntityNode, EntityNode[]>()

    private readonly nodeTypes: Map<typeof EntityNode, Set<Function>> = new Map()
    private readonly nodeConverters: Map<typeof EntityNode, (entity: Entity) => Object> = new Map()

    private readonly eventHandlers = new Map<string, Set<(data: any) => void>>()
    private readonly commandHandlers = new Map<string, (data: any) => void>()

    destruct() {
        for(const system of this.systems.values()) {
            system.removeFromEngine()
        }

        this.entities.clear()
        this.systems.clear()
        this.subSystems.clear()
        this.nodes.clear()
        this.nodeTypes.clear()
        this.nodeConverters.clear()
        this.commands.clear()
        this.commandHandlers.clear()
        this.eventHandlers.clear()
    }

    readonly commands: Map<Commands, Command[]> = new Map([
        ["keydown", []],
        ["click", []],
        ["selectEntity", []],
        ["mouseMoved", []],
        ["mousedown", []],
        ["mouseup", []]
    ] as const)

    removeCommandHandler(command: Commands) {
        this.commandHandlers.delete(command)
    }

    createEntity(id = uuid(), addItToEngine = true) {
        const entity = new Entity(id)
        this.dispatchEvent("entityAdded", entity)

        if(addItToEngine) {
            this.addEntity(entity)
        }

        return entity
    }

    getSystem<T extends System>(system: new (engine: Engine) => T) {
        return this.systems.get(system) as T
    }

    subscribe(event: EngineEvents, callback: (data: any) => void) {
        if(!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set([callback]))

            return this
        }

        this.eventHandlers.get(event)?.add(callback)

        return this
    }

    unsubscribe(event: EngineEvents, callback: (data: any) => void) {
        this.eventHandlers.get(event)?.delete(callback)

        return this
    }

    dispatchEvent(event: EngineEvents, data: any) {
        if(!this.eventHandlers.has(event)) {
            return this
        }

        for(const callback of this.eventHandlers.get(event)!) {
            callback(data)
        }

        return this
    }

    unregisterNodeType<T extends EntityNode>(nodeName: EntityNodeConstructor<T>): void {
        this.nodes.delete(nodeName)
        this.nodeTypes.delete(nodeName)
        this.nodeConverters.delete(nodeName)
    }

    registerNodeType<T extends EntityNode>(
        nodeName: EntityNodeConstructor<T>,
        keys: Set<Function>,
        converter: (entity: Entity) => T) {
        if(this.nodes.has(nodeName)) {
            throw new Error(`Node ${nodeName} already exists`)
        }

        this.nodes.set(nodeName, [])
        // this.nodeTypes.set(nodeName, new Set([...keys.values()].map(getName)))
        this.nodeTypes.set(nodeName, keys)
        this.nodeConverters.set(nodeName, converter)

        return this
    }

    removeEntity(entity: Entity) {
        entity.parent?.removeChild(entity)

        this.entities.delete(entity.id)

        const entityComponentConstructors: Set<Function> = new Set()

        for(const component of entity.components.values()) {
            entityComponentConstructors.add(component.constructor)
        }

        //remove the nodes
        for(const nodeName of this.nodeTypes.keys()) {
            const keyValues = [...this.nodeTypes.get(nodeName)!.values()]

            if(keyValues.every((nodeConstructor) => entityComponentConstructors.has(nodeConstructor))) {
                const nodes = this.nodes.get(nodeName)

                if(!nodes) {
                    continue
                }

                for(let i = 0; i < nodes.length; i++) {
                    if(nodes[i].entity === entity) {
                        nodes.splice(i, 1)
                        break
                    }
                }
            }
        }

        for(const child of entity.children) {
            this.removeEntity(child)
        }

        return this.dispatchEvent("entityRemoved", entity).addCommand({ name: "redraw", data: {} })
    }

    addEntity(entity: Entity) {
        if(this.entities.has(entity.id)) {
            return this
        }

        //ez most egy array
        const entityComponentConstructors: Set<Function> = new Set()

        for(const component of entity.components.values()) {
            entityComponentConstructors.add(component.constructor)
        }

        for(const nodeName of this.nodeTypes.keys()) {
            let skip = false
            for(const keyValues of this.nodeTypes.get(nodeName)!.values()) {
                if(!entityComponentConstructors.has((keyValues))) {
                    skip = true
                    break
                }
            }

            if(skip) {
                continue
            }

            const nodeConverter = this.nodeConverters.get(nodeName)!
            this.nodes.get(nodeName)!.push(nodeConverter(entity))
        }

        for(const child of entity.children) {
            this.addEntity(child)
        }

        this.dispatchEvent("entityAdded", entity)

        return this
    }

    addSystem(system: new () => System) {
        const newSystem = new system()
        newSystem.addToEngine(this)
        this.systems.set(system, newSystem)

        return this
    }

    removeSystem(system: new () => System) {
        const systemInstance = this.systems.get(system)
        if(systemInstance) {
            systemInstance.removeFromEngine()
        }
        this.systems.delete(system)

        return this
    }

    addSubSystem(subsystem: new () => System) {
        const newSubsystem = new subsystem()
        this.subSystems.set(subsystem, newSubsystem)
        newSubsystem.addToEngine(this)

        return this
    }

    removeSubSystem(subsystem: new () => System) {
        const system = this.subSystems.get(subsystem)
        if(system) {
            system.removeFromEngine()
        }
        this.subSystems.delete(subsystem)

        return this
    }

    update(dt: number) {
        this.dispatchEvent("updateBegin", dt)

        for(const system of this.systems.values()) {
            system.update(dt)
        }

        this.dispatchEvent("updateDone", dt)
    }

    getNodeList<T extends Object>(node: EntityNodeConstructor<T>) {
        if(!this.nodes.has(node)) {
            throw new Error(`Node ${node} does not exist`)
        }

        return (this.nodes.get(node) ?? []) as T[]
    }

    addCommand(command: Command) {
        this.commands.get(command.name)?.push(command)
        this.commandHandlers.get(command.name)?.(command.data)

        return this
    }

    getCommands(type: Commands) {
        return this.commands.get(type)
    }

    // addNode(node: any) {
    //     return this.nodes.push(node) - 1
    // }

    // removeNode(node: any) {
    //     this.nodes = this.nodes.filter((n) => n !== node)
    // }
}
