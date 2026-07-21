import { describe, it, expect, } from "vitest"
import { World } from "./world"
import { Entity } from "../entities/entity"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import { EntityComponent } from "../entities/entityComponent"
import { System } from "../systems/system"
import { RedrawCommand } from "../lib/RedrawCommand"
import { SelectEntityCommand } from "../lib/SelectEntityCommand"
import { EventBase } from "../lib/events"
import {
    UpdateDoneEvent,
    EntityRemovedEvent,
    ClickEventData,
} from "../lib/events"

class TagComponent extends EntityComponent {
    constructor(public tag: string = "tag", entity?: Entity) {
        super(entity)
    }
}

class TagNode extends EntityNode {
    constructor(entity: Entity) {
        super(entity)
    }
}

const tagNodeCtor = TagNode as unknown as EntityNodeConstructor<TagNode>

function makeWorld() {
    const world = new World()
    world.registerNodeType(tagNodeCtor, new Set([TagComponent]), (entity) => new TagNode(entity))
    return world
}

function entityWithTag(world: World) {
    const entity = world.createEntity()
    entity.addComponent(new TagComponent())
    world.addEntity(entity)
    return entity
}

describe("World", () => {
    it("creates an entity with a generated UUID by default", () => {
        const world = new World()
        const entity = world.createEntity()

        expect(entity.id).toBeDefined()
        expect(entity.id.length).toBeGreaterThan(0)
    })

    it("creates an entity with a custom id when provided", () => {
        const world = new World()
        const entity = world.createEntity("custom-id")

        expect(entity.id).toBe("custom-id")
    })

    it("does not add the entity to the engine when not explicitly added", () => {
        const world = makeWorld()

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("adds the entity to the engine via addEntity", () => {
        const world = makeWorld()
        const entity = world.createEntity(undefined)
        entity.addComponent(new TagComponent())

        world.addEntity(entity)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(1)
    })

    it("removes an entity from the engine via removeEntity", () => {
        const world = makeWorld()
        const entity = entityWithTag(world)

        world.removeEntity(entity)

        expect(world.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("returns itself from addEntity and removeEntity for chaining", () => {
        const world = makeWorld()
        const entity = world.createEntity()

        expect(world.addEntity(entity)).toBe(world)
        expect(world.removeEntity(entity)).toBe(world)
    })

    it("returns itself from addSystem and removeSystem for chaining", () => {
        const world = makeWorld()

        class DummySystem extends System {
            update() { }
        }

        const ctor = DummySystem as unknown as new () => System
        expect(world.addSystem(ctor)).toBe(world)
        expect(world.removeSystem(ctor)).toBe(world)
    })

    it("returns itself from subscribe and unsubscribe for chaining", () => {
        const world = new World()

        expect(world.subscribe(ClickEventData, () => { })).toBe(world)
        expect(world.unsubscribe(ClickEventData, () => { })).toBe(world)
    })

    it("returns itself from addCommand and dispatchEvent for chaining", () => {
        const world = new World()

        expect(world.addCommand(new RedrawCommand())).toBe(world)
        expect(world.dispatchEvent(new ClickEventData({ event: {} as MouseEvent, x: 0, y: 0 }))).toBe(world)
    })

    it("returns itself from registerEventQueue and removeEventQueue for chaining", () => {
        const world = new World()

        class CustomEvent extends EventBase<{ type: string }> {}
        expect(world.registerEventQueue(CustomEvent)).toBe(world)
        expect(world.removeEventQueue(CustomEvent)).toBe(world)
    })

    it("returns itself from registerCommandQueue and removeCommandQueue for chaining", () => {
        const world = new World()

        expect(world.registerCommandQueue("custom" as any)).toBe(world)
        expect(world.removeCommandQueue("custom" as any)).toBe(world)
    })

    it("returns itself from reindexEntity for chaining", () => {
        const world = makeWorld()
        const entity = world.createEntity()

        expect(world.reindexEntity(entity)).toBe(world)
    })

    it("does not return itself from destruct", () => {
        const world = makeWorld()

        expect(world.destruct()).toBeUndefined()
    })

    it("queues the updateDone event after systems run", () => {
        const world = makeWorld()

        world.update(16)

        expect(world.getEvents(UpdateDoneEvent)!.length).toBe(1)
        expect(world.getEvents(UpdateDoneEvent)!.peek()!.data).toBe(16)
    })

    it("queues the entityRemoved event when an entity is removed", () => {
        const world = makeWorld()
        const entity = entityWithTag(world)

        world.removeEntity(entity)

        expect(world.getEvents(EntityRemovedEvent)!.length).toBe(1)
        expect(world.getEvents(EntityRemovedEvent)!.peek()!.data).toBe(entity)
    })

    it("clears command queues on destruct", () => {
        const world = makeWorld()
        world.addCommand(new RedrawCommand())
        world.addCommand(new SelectEntityCommand())

        world.destruct()

        expect(world.getCommands(RedrawCommand)!.length).toBe(0)
        expect(world.getCommands(SelectEntityCommand)!.length).toBe(0)
    })

    it("returns the nodes list via nodes()", () => {
        const world = makeWorld()
        const entity = entityWithTag(world)

        const nodes = world.nodes(tagNodeCtor)

        expect(nodes).toHaveLength(1)
        //@ts-ignore
        expect(nodes[0].entity).toBe(entity)
    })

    it("registerNodeType returns itself for chaining", () => {
        const world = new World()
        const nodeCtor = {} as EntityNodeConstructor<EntityNode>

        expect(world.registerNodeType(nodeCtor, new Set(), (entity) => new tagNodeCtor(entity))).toBe(world)
    })

    it("unregisters a node type via unregisterNodeType", () => {
        const world = makeWorld()

        expect(() => world.unregisterNodeType(tagNodeCtor)).not.toThrow()
        expect(() => world.getNodeList(tagNodeCtor)).toThrow()
    })
})
