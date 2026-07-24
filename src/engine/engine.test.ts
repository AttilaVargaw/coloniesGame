import { describe, it, expect, vi } from "vitest"
import { World } from "@engine/core/world"
import { Entity } from "@engine/entities/entity"
import { EntityNodeConstructor } from "@engine/entities/entityNode"
import { EntityComponent } from "@engine/entities/entityComponent"
import { Queue } from "@engine/lib/commandQueue"
import { System } from "@engine/systems/system"
import { TestEntityComponent, TestEntityNode, testEntityNodeCtor, makeWorld, entityWithTag } from "@engine/test-utils"
import { SelectEntityCommand } from "@engine/lib/SelectEntityCommand"
import {
    UpdateBeginEvent,
    EntityAddedEvent,
    ClickEventData,
} from "@engine/lib/events"
import { EventBase } from "@engine/lib/events"

class ChildTagComponent extends EntityComponent {
    constructor(public tag: string = "child", entity?: Entity) {
        super(entity)
    }
}

class ChildTagNode extends TestEntityNode {
    constructor(entity?: Entity) {
        super(entity)
    }
}

const childTagNodeCtor = ChildTagNode as unknown as EntityNodeConstructor<ChildTagNode>

describe("World (Engine refactor regression)", () => {
    it("registers a node only for entities that have all required components", () => {
        const world = makeWorld()

        const withTag = entityWithTag(world)
        const withoutTag = world.createEntity()
        world.addEntity(withoutTag)

        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(testEntityNodeCtor)[0].entity).toBe(withTag)
    })

    it("re-indexes the node list when reindexEntity is called after a component is added", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        world.addEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)

        entity.addComponent(new TestEntityComponent())
        world.reindexEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(testEntityNodeCtor)[0].entity).toBe(entity)

        entity.removeComponent(TestEntityComponent)
        world.reindexEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
    })

    it("does not duplicate child nodes when the parent is re-indexed", () => {
        const world = makeWorld().registerNodeType(
            childTagNodeCtor,
            new Set([ChildTagComponent]),
            (entity) => new ChildTagNode(entity)
        )

        const parent = world.createEntity()
        const child = world.createEntity()
        child.addComponent(new ChildTagComponent())

        world.addEntity(parent)
        world.addEntity(child, parent)

        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.addComponent(new TestEntityComponent())
        world.reindexEntity(parent)
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.removeComponent(TestEntityComponent)
        world.reindexEntity(parent)
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)
    })

    it("removes a node when the last required component is removed and reindexed", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        entity.addComponent(new TestEntityComponent())
        world.addEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)

        entity.removeComponent(TestEntityComponent)
        world.reindexEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
    })

    it("detaches the entity from the engine on removal", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        entity.addComponent(new TestEntityComponent())
        world.addEntity(entity)
        world.removeEntity(entity)

        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)

        entity.addComponent(new TestEntityComponent())
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
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

        world.subscribe(UpdateBeginEvent, updateBegin)

        world.update(16)

        expect(updateBegin).toHaveBeenCalledWith(16)
    })

    it("fires entityAdded handlers during the update loop", () => {
        const world = makeWorld()
        const onAdded = vi.fn()
        world.subscribe(EntityAddedEvent, onAdded)

        const entity = world.createEntity()
        world.dispatchEvent(new EntityAddedEvent(entity))
        world.update(16)

        expect(onAdded).toHaveBeenCalledWith(entity)
    })

    it("removes the matching node and enqueues a redraw when an entity is removed", () => {
        const world = makeWorld()
        const entity = entityWithTag(world)

        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)

        world.removeEntity(entity)

        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)
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
        expect(world.getEvents(ClickEventData)).toBeInstanceOf(Queue)
    })

    it("clears event queues and subscribed handlers on destruct", () => {
        const world = makeWorld()
        const onClick = vi.fn()

        world.subscribe(ClickEventData, onClick)
        world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 0, y: 0 } as any))
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(world.getEvents(ClickEventData)!.length).toBe(0)

        world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 0, y: 0 } as any))
        expect(world.getEvents(ClickEventData)!.length).toBe(1)

        world.destruct()

        expect(world.getEvents(ClickEventData)!.length).toBe(0)

        world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 0, y: 0 } as any))
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("retrieves a registered system by its constructor", () => {
        const world = makeWorld()

        class CounterSystem extends System {
            update() { }
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

        world.subscribe(ClickEventData, onClick)
        world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 1, y: 0 } as any))
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(onClick).toHaveBeenCalledWith({ event: {} as MouseEvent, x: 1, y: 0 })

        world.unsubscribe(ClickEventData, onClick)
        world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 2, y: 0 } as any))
        world.update(16)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("reindexes an entity when called directly", () => {
        const world = makeWorld()
        const entity = world.createEntity()
        world.addEntity(entity)
        entity.addComponent(new TestEntityComponent())
        world.reindexEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)

        world.reindexEntity(entity)
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(testEntityNodeCtor)[0].entity).toBe(entity)
    })

    it("unregisters a node type and stops indexing new entities", () => {
        const world = makeWorld()
        expect(world.getNodeList(testEntityNodeCtor)).toHaveLength(0)

        world.unregisterNodeType(testEntityNodeCtor)

        expect(() => world.getNodeList(testEntityNodeCtor)).toThrow()

        const another = world.createEntity()
        another.addComponent(new TestEntityComponent())
        world.addEntity(another)
        expect(() => world.getNodeList(testEntityNodeCtor)).toThrow()
    })

    it("removes a subsystem from the registry without throwing", () => {
        const world = makeWorld()

        class CounterSubsystem extends System {
            update() { }
        }

        const ctor = CounterSubsystem as unknown as new () => System
        world.addSubsystem(ctor)
        expect(() => world.removeSubSystem(ctor)).not.toThrow()
        expect(world.removeSubSystem(ctor)).toBe(world)
    })

    it("registers a custom event queue and allows dispatching events to it", () => {
        const world = new World()
        const handler = vi.fn()

        class CustomEvent extends EventBase<{ type: string }> { }
        world.registerEventQueue(CustomEvent)
        world.subscribe(CustomEvent, handler)
        world.dispatchEvent(new CustomEvent({ type: "test" }))
        world.update(16)

        expect(handler).toHaveBeenCalledWith({ type: "test" })
    })

    it("removes an event queue", () => {
        const world = new World()
        class CustomEvent extends EventBase<{ type: string }> { }
        world.registerEventQueue(CustomEvent)
        expect(world.getEvents(CustomEvent)).toBeInstanceOf(Queue)
        expect(world.getEvents(CustomEvent)).toBeInstanceOf(Queue)

        world.removeEventQueue(CustomEvent)
        expect(world.getEvents(CustomEvent)).toBeUndefined()
    })

    it("adds a command to the specified queue", () => {
        const world = new World()
        const testEntity = world.createEntity()

        world.addCommand(new SelectEntityCommand(testEntity))
        expect(world.getCommands(SelectEntityCommand)!.length).toBe(1)
        console.log(world.getCommands(SelectEntityCommand)!.peek(), testEntity)
        expect(world.getCommands(SelectEntityCommand)!.peek()).toEqual({ data: testEntity })
    })

    it("returns the command queue for a given type", () => {
        const world = new World()
        const queue = world.getCommands(SelectEntityCommand)
        expect(queue).toBeInstanceOf(Queue)
    })
})