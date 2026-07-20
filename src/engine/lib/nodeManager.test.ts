import { describe, it, expect, } from "vitest"
import { NodeManager } from "./nodeManager"
import { Entity } from "../entities/entity"
import { SceneNode } from "../entities/sceneNode"
import { EntityNode, EntityNodeConstructor } from "../entities/entityNode"
import { EntityComponent } from "../entities/entityComponent"

class TagComponent extends EntityComponent {
    constructor(public tag: string = "tag", entity?: Entity) {
        super(entity)
    }
}

class OtherComponent extends EntityComponent {
    constructor(public value: number = 0, entity?: Entity) {
        super(entity)
    }
}

class TagNode extends EntityNode {
    constructor(entity: Entity) {
        super(entity)
    }
}

class OtherNode extends EntityNode {
    constructor(entity: Entity) {
        super(entity)
    }
}

const tagNodeCtor = TagNode as unknown as EntityNodeConstructor<TagNode>
const otherNodeCtor = OtherNode as unknown as EntityNodeConstructor<OtherNode>

function makeNodeManager() {
    const manager = new NodeManager()
    manager.registerNodeType(tagNodeCtor, new Set([TagComponent]), (entity) => new TagNode(entity))
    manager.registerNodeType(otherNodeCtor, new Set([OtherComponent]), (entity) => new OtherNode(entity))
    return manager
}

describe("NodeManager", () => {
    it("returns an empty array for an unregistered node type", () => {
        const manager = makeNodeManager()

        expect(() => manager.getNodeList(tagNodeCtor)).not.toThrow()
        expect(manager.getNodeList(tagNodeCtor)).toEqual([])
    })

    it("throws when accessing an unregistered node type via getNodeList", () => {
        const manager = makeNodeManager()
        const unregistered = {} as EntityNodeConstructor<EntityNode>

        expect(() => manager.getNodeList(unregistered)).toThrow()
    })

    it("returns the node list for a registered node type", () => {
        const manager = makeNodeManager()

        const list = manager.nodes(tagNodeCtor)!

        expect(list).toBeInstanceOf(Array)
        expect(list.length).toBe(0)
    })

    it("throws when registering a duplicate node type", () => {
        const manager = makeNodeManager()

        expect(() => manager.registerNodeType(tagNodeCtor, new Set([TagComponent]), (entity) => new TagNode(entity))).toThrow()
    })

    it("registers multiple node types independently", () => {
        const manager = makeNodeManager()

        expect(manager.nodes(tagNodeCtor)).toBeDefined()
        expect(manager.nodes(otherNodeCtor)).toBeDefined()
    })

    it("adds an entity to matching node lists when it has all required components", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(manager.getNodeList(tagNodeCtor)[0].entity).toBe(entity)
        expect(manager.getNodeList(otherNodeCtor)).toHaveLength(0)
    })

    it("does not add an entity to a node list when it lacks a required component", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new OtherComponent())

        manager.addEntityToNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(0)
        expect(manager.getNodeList(otherNodeCtor)).toHaveLength(1)
    })

    it("adds an entity only when it has all required components for a multi-component node", () => {
        const manager = new NodeManager()
        manager.registerNodeType(tagNodeCtor, new Set([TagComponent, OtherComponent]), (entity) => new TagNode(entity))

        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(0)

        entity.addComponent(new OtherComponent())

        manager.addEntityToNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)
    })

    it("recursively adds child entities to matching nodes via SceneNode", () => {
        const manager = makeNodeManager()
        const parent = new Entity("parent")
        const child = new Entity("child")
        child.addComponent(new TagComponent())
        const parentNode = new SceneNode(parent)
        const childNode = new SceneNode(child)
        parentNode.addChild(childNode)

        manager.addEntityToNodes(parent, parentNode)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(manager.getNodeList(tagNodeCtor)[0].entity).toBe(child)
    })

    it("removes an entity from matching node lists", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.removeEntityFromNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("removes an entity from matching node lists but leaves non-matching lists untouched", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new OtherComponent())

        manager.addEntityToNodes(entity)
        expect(manager.getNodeList(otherNodeCtor)).toHaveLength(1)

        manager.removeEntityFromNodes(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(0)
        expect(manager.getNodeList(otherNodeCtor)).toHaveLength(0)
    })

    it("recursively removes child entities from matching nodes via SceneNode", () => {
        const manager = makeNodeManager()
        const parent = new Entity("parent")
        const child = new Entity("child")
        child.addComponent(new TagComponent())
        const parentNode = new SceneNode(parent)
        const childNode = new SceneNode(child)
        parentNode.addChild(childNode)

        manager.addEntityToNodes(parent, parentNode)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.removeEntityFromNodes(parent, parentNode)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(0)
    })

    it("reindexes an entity by removing and re-adding it to matching nodes", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.reindexEntity(entity)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(manager.getNodeList(tagNodeCtor)[0].entity).toBe(entity)
    })

    it("recursively reindexes child entities via SceneNode", () => {
        const manager = makeNodeManager()
        const parent = new Entity("parent")
        const child = new Entity("child")
        child.addComponent(new TagComponent())
        const parentNode = new SceneNode(parent)
        const childNode = new SceneNode(child)
        parentNode.addChild(childNode)

        manager.addEntityToNodes(parent, parentNode)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.reindexEntity(parent, parentNode)

        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)
        expect(manager.getNodeList(tagNodeCtor)[0].entity).toBe(child)
    })

    it("unregisters a node type and clears its entries", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.unregisterNodeType(tagNodeCtor)

        expect(manager.nodes(tagNodeCtor)).toBeUndefined()
        expect(() => manager.getNodeList(tagNodeCtor)).toThrow()
    })

    it("clears all registered node types and node lists", () => {
        const manager = makeNodeManager()
        const entity = new Entity("e1")
        entity.addComponent(new TagComponent())

        manager.addEntityToNodes(entity)
        expect(manager.getNodeList(tagNodeCtor)).toHaveLength(1)

        manager.clear()

        expect(manager.nodes(tagNodeCtor)).toBeUndefined()
        expect(manager.nodes(otherNodeCtor)).toBeUndefined()
    })
})
