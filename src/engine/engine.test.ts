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
    const entity = world.createEntity(undefined, false)
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

    it("re-indexes the node list when a component is added after the entity is in the engine", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        world.addEntity(entity)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)

        entity.addComponent(new TagComponent())
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(world.getNodeList(tagNodeCtor)[0].entity).toBe(entity)

        entity.removeComponent(TagComponent)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("does not duplicate child nodes when the parent is re-indexed", () => {
        const world = makeWorld()

        const parent = world.createEntity()
        const child = world.createEntity()
        child.addComponent(new ChildTagComponent())
        parent.addChild(child)
        world.addEntity(parent)

        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.addComponent(new TagComponent())
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)

        parent.removeComponent(TagComponent)
        expect(world.getNodeList(childTagNodeCtor)).toHaveLength(1)
    })

    it("removes a node when the last required component is removed", () => {
        const world = makeWorld()

        const entity = world.createEntity()
        world.addEntity(entity)
        entity.addComponent(new TagComponent())
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)

        entity.removeComponent(TagComponent)
        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("detaches the entity from the engine on removal", () => {
        const world = makeWorld()

        const entity = world.createEntity()
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

        const entity = entityWithTag(world)

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
})
