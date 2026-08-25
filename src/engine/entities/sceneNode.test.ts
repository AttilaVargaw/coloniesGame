import { describe, it, expect } from "vitest"
import { Entity } from "@engine/entities/entity"
import { SceneNode } from "@engine/entities/sceneNode"
import { PositionComponent } from "@engine/components/position"

describe("SceneNode", () => {
    it("creates a node linked to the provided entity", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        expect(node.entity).toBe(entity)
    })

    it("throws when accessing entity before it is set", () => {
        const node = new SceneNode("e1")

        expect(() => node.entity).toThrow("SceneNode entity not resolved for id: e1")
    })

    it("allows setting the entity after construction", () => {
        const node = new SceneNode("e1")
        const entity = new Entity("e1")

        node.entity = entity

        expect(node.entity).toBe(entity)
    })

    it("starts with no parent and no children", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        expect(node.parent).toBeNull()
        expect(node.childrenRef.size).toBe(0)
    })

    it("setParent updates both sides of the relationship", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        childNode.parent = parentNode

        expect(childNode.parent).toBe(parentNode)
        expect(parentNode.childrenRef.has(childNode)).toBe(true)
    })

    it("setParent is idempotent when the parent is unchanged", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        childNode.parent = parentNode
        childNode.parent = parentNode

        expect(parentNode.childrenRef.size).toBe(1)
    })

    it("setParent removes the node from the previous parent", () => {
        const parentA = new Entity("parentA")
        const parentB = new Entity("parentB")
        const child = new Entity("child")
        const parentANode = new SceneNode(parentA.id, parentA)
        const parentBNode = new SceneNode(parentB.id, parentB)
        const childNode = new SceneNode(child.id, child)

        childNode.parent = parentANode
        childNode.parent = parentBNode

        expect(childNode.parent).toBe(parentBNode)
        expect(parentANode.childrenRef.has(childNode)).toBe(false)
        expect(parentBNode.childrenRef.has(childNode)).toBe(true)
    })

    it("addChild attaches the child to this node", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parentNode.addChild(childNode)

        expect(childNode.parent).toBe(parentNode)
        expect(parentNode.childrenRef.has(childNode)).toBe(true)
    })

    it("removeChild detaches the child and clears its parent", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parentNode.addChild(childNode)
        parentNode.removeChild(childNode)

        expect(childNode.parent).toBeNull()
        expect(parentNode.childrenRef.has(childNode)).toBe(false)
    })

    it("removeChild is a no-op when the node is not a child", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parentNode.removeChild(childNode)

        expect(childNode.parent).toBeNull()
        expect(parentNode.childrenRef.size).toBe(0)
    })

    it("getWorldPosition returns [0, 0] when the entity has no PositionComponent", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        const [x, y] = node.getWorldPosition()

        expect(x).toBe(0)
        expect(y).toBe(0)
    })

    it("getWorldPosition returns local position when there is no parent", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)
        entity.addComponent(new PositionComponent(7, 13))

        const [x, y] = node.getWorldPosition()

        expect(x).toBe(7)
        expect(y).toBe(13)
    })

    it("getWorldPosition accumulates positions across one level of nesting", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parent.addComponent(new PositionComponent(100, 200))
        child.addComponent(new PositionComponent(10, 20))

        childNode.parent = parentNode

        const [x, y] = childNode.getWorldPosition()

        expect(x).toBe(110)
        expect(y).toBe(220)
    })

    it("getWorldPosition accumulates positions across multiple levels of nesting", () => {
        const grandparent = new Entity("grandparent")
        const parent = new Entity("parent")
        const child = new Entity("child")
        const grandparentNode = new SceneNode(grandparent.id, grandparent)
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        grandparent.addComponent(new PositionComponent(0, 0))
        parent.addComponent(new PositionComponent(100, 200))
        child.addComponent(new PositionComponent(10, 20))

        parentNode.parent = grandparentNode
        childNode.parent = parentNode

        const [x, y] = childNode.getWorldPosition()

        expect(x).toBe(110)
        expect(y).toBe(220)
    })

    it("collectDescendants returns all nested descendants", () => {
        const parent = new Entity("parent")
        const child1 = new Entity("child1")
        const child2 = new Entity("child2")
        const grandchild = new Entity("grandchild")
        const parentNode = new SceneNode(parent.id, parent)
        const child1Node = new SceneNode(child1.id, child1)
        const child2Node = new SceneNode(child2.id, child2)
        const grandchildNode = new SceneNode(grandchild.id, grandchild)

        parentNode.addChild(child1Node)
        parentNode.addChild(child2Node)
        child1Node.addChild(grandchildNode)

        const descendants: Entity[] =
            parentNode.collectDescendants()

        expect(descendants).toHaveLength(3)
        expect(descendants).toContain(child1)
        expect(descendants).toContain(child2)
        expect(descendants).toContain(grandchild)
    })

    it("collectDescendants returns an empty array when there are no children", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        const descendants: Entity[] =
            node.collectDescendants()

        expect(descendants).toHaveLength(0)
    })

    it("exposes childrenRef as a ReadonlySet", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        expect(node.childrenRef).toBeInstanceOf(Set)
    })
})
