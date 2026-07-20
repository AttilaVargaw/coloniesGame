import { describe, it, expect, vi } from "vitest"
import { World } from "@engine/core/world"
import { Entity } from "@engine/entities/entity"
import { EntityNode, EntityNodeConstructor } from "@engine/entities/entityNode"
import { EntityComponent } from "@engine/entities/entityComponent"
import { Queue } from "@engine/lib/commandQueue"
import { System } from "@engine/systems/system"

class TagComponent extends EntityComponent {
    constructor(public tag: string = "tag", entity?: Entity) {
        super(entity)
    }
}

class ChildTagComponent extends EntityComponent {
    constructor(public tag: string = "child", entity?: Entity) {
        super(entity)
    }
}

class TagNode extends EntityNode {
    constructor(entity?: Entity) {
        super(entity)
    }
}

class ChildTagNode extends EntityNode {
    constructor(entity?: Entity) {
        super(entity)
    }
}

const tagNodeCtor = TagNode as unknown as EntityNodeConstructor<TagNode>
const childTagNodeCtor = ChildTagNode as unknown as EntityNodeConstructor<ChildTagNode>

function makeWorld() {
    const world = new World()
    world.registerNodeType(tagNodeCtor, new Set([TagComponent]), (entity) => new TagNode(entity))
    world.registerNodeType(childTagNodeCtor, new Set([ChildTagComponent]), (entity) => new ChildTagNode(entity))
    return world
}

function entityWithTag(world: World) {
    const entity = world.createEntity(undefined)
    entity.addComponent(new TagComponent())
    world.addEntity(entity)
    return entity
}

describe("World (Engine refactor regression)", () => {
    it("registers a node only for entities that have all required components", () => {
        const world = makeWorld()

        const withTag = entityWithTag(world)
        const withoutTag = world.createEntity()
        world.addEntity(withoutTag)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(tagNodeCtor)[0].entity).toBe(withTag)
    })

    it("re-indexes the node list when reindexEntity is called after a component is added", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        world.addEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)

        entity.addComponent(new TagComponent())
        world.reindexEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(tagNodeCtor)[0].entity).toBe(entity)

        entity.removeComponent(TagComponent)
        world.reindexEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("does not duplicate child nodes when the parent is re-indexed", () => {
        const world = makeWorld()

        const parent = world.createEntity()
        const child = world.createEntity()
        child.addComponent(new ChildTagComponent())

        world.addEntity(parent)
        world.addEntity(child, parent)

        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.addComponent(new TagComponent())
        world.reindexEntity(parent)
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.removeComponent(TagComponent)
        world.reindexEntity(parent)
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)
    })

    it("removes a node when the last required component is removed and reindexed", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        entity.addComponent(new TagComponent())
        world.addEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)

        entity.removeComponent(TagComponent)
        world.reindexEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("detaches the entity from the engine on removal", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        entity.addComponent(new TagComponent())
        world.addEntity(entity)
        world.removeEntity(entity)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)

        entity.addComponent(new TagComponent())
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("tears down systems on destruct", () => {
        const world = makeWorld()
        let updates = 0

        class CounterSystem extends System {
            update() {
                updates++
            }
        }

        world.addSystem(CounterSystem as unknown as new () => System)
        world.destruct()

        world.update(16)
        expect(updates).toBe(0)
    })

    it("runs updateBegin handlers during the update loop", () => {
        const world = makeWorld()
        const updateBegin = vi.fn()

        world.subscribe("updateBegin", updateBegin)

        world.update(16)

        expect(updateBegin).toHaveBeenCalledWith(16)
    })

    it("fires entityAdded handlers during the update loop", () => {
        const world = makeWorld()
        const onAdded = vi.fn()
        world.subscribe("entityAdded", onAdded)

        const entity = world.createEntity()
        world.dispatchEvent("entityAdded", entity)
        world.update(16)

        expect(onAdded).toHaveBeenCalledWith(entity)
    })

    it("removes the matching node and enqueues a redraw when an entity is removed", () => {
        const world = makeWorld()
        const entity = entityWithTag(world)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)

        world.removeEntity(entity)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
        expect(world.commands.get("redraw")!.length).toBe(1)
    })

    it("runs registered systems during update", () => {
        const world = makeWorld()
        let updates = 0

        class CounterSystem extends System {
            update() {
                updates++
            }
        }

        world.addSystem(CounterSystem as unknown as new () => System)
        world.update(16)

        expect(updates).toBe(1)
    })

    it("exposes command and event queues with the expected types", () => {
        const world = new World()
        expect(world.commands.get("redraw")).toBeInstanceOf(Queue)
        expect(world.events.get("click")).toBeInstanceOf(Queue)
    })

    it("clears event queues and subscribed handlers on destruct", () => {
        const world = makeWorld()
        const onClick = vi.fn()

        world.subscribe("click", onClick)
        world.dispatchEvent("click", {})
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(world.events.get("click")!.length).toBe(0)

        world.dispatchEvent("click", {})
        expect(world.events.get("click")!.length).toBe(1)

        world.destruct()

        expect(world.events.get("click")!.length).toBe(0)

        world.dispatchEvent("click", {})
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("retrieves a registered system by its constructor", () => {
        const world = makeWorld()

        class CounterSystem extends System {
            update() {}
        }

        const ctor = CounterSystem as unknown as new () => System
        world.addSystem(ctor)
        expect(world.getSystem(ctor)).toBeInstanceOf(CounterSystem)
    })

    it("removes a registered system and stops its update from running", () => {
        const world = makeWorld()
        let updates = 0

        class CounterSystem extends System {
            update() {
                updates++
            }
        }

        const ctor = CounterSystem as unknown as new () => System
        world.addSystem(ctor)
        world.update(16)
        expect(updates).toBe(1)

        world.removeSystem(ctor)
        world.update(16)
        expect(updates).toBe(1)
        expect(world.getSystem(ctor)).toBeUndefined()
    })

    it("unsubscribes a handler so it no longer receives events", () => {
        const world = makeWorld()
        const onClick = vi.fn()

        world.subscribe("click", onClick)
        world.dispatchEvent("click", { x: 1 })
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(onClick).toHaveBeenCalledWith({ x: 1 })

        world.unsubscribe("click", onClick)
        world.dispatchEvent("click", { x: 2 })
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("reindexes an entity when called directly", () => {
        const world = makeWorld()
        const entity = world.createEntity()
        world.addEntity(entity)
        entity.addComponent(new TagComponent())
        world.reindexEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)

        world.reindexEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(tagNodeCtor)[0].entity).toBe(entity)
    })

    it("unregisters a node type and stops indexing new entities", () => {
        const world = makeWorld()
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)

        world.unregisterNodeType(tagNodeCtor)

        expect(() => world.getNodeList(tagNodeCtor)).toThrow()

        const another = world.createEntity()
        another.addComponent(new TagComponent())
        world.addEntity(another)
        expect(() => world.getNodeList(tagNodeCtor)).toThrow()
    })

    it("removes a subsystem from the registry without throwing", () => {
        const world = makeWorld()

        class CounterSubsystem extends System {
            update() {}
        }

        const ctor = CounterSubsystem as unknown as new () => System
        world.addSubsystem(ctor)
        expect(() => world.removeSubSystem(ctor)).not.toThrow()
        expect(world.removeSubSystem(ctor)).toBe(world)
    })

    it("registers a custom event queue and allows dispatching events to it", () => {
        const world = new World()
        const handler = vi.fn()

        world.registerEventQueue("customEvent" as any)
        world.subscribe("customEvent" as any, handler)
        world.dispatchEvent("customEvent" as any, { type: "test" })
        world.update(16)

        expect(handler).toHaveBeenCalledWith({ type: "test" })
    })

    it("removes an event queue", () => {
        const world = new World()
        world.registerEventQueue("customEvent" as any)
        expect(world.events.get("customEvent" as any)).toBeInstanceOf(Queue)
        expect(world.events.get("customEvent" as any)).toBeInstanceOf(Queue)

        world.removeEventQueue("customEvent" as any)
        expect(world.events.get("customEvent" as any)).toBeUndefined()
    })

    it("adds a command to the specified queue", () => {
        const world = new World()
        world.addCommand("selectEntity", { id: "test" })
        expect(world.commands.get("selectEntity")!.length).toBe(1)
        expect(world.commands.get("selectEntity")!.peek()!.data).toEqual({ id: "test" })
    })

    it("returns the command queue for a given type", () => {
        const world = new World()
        const queue = world.getCommands("redraw")
        expect(queue).toBeInstanceOf(Queue)
    })
})
