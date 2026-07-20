import { describe, it, expect, vi } from "vitest"
import { Entity } from "@engine/entities/entity"
import { EntityComponent } from "@engine/entities/entityComponent"
import { PositionComponent } from "@engine/components/position"
import { SceneNode } from "@engine/entities/sceneNode"

class TestComponent extends EntityComponent {
    constructor(public value: number, entity?: Entity) {
        super(entity)
    }
}

describe("Entity", () => {
    it("assigns the id from the constructor", () => {
        const entity = new Entity("abc-123")

        expect(entity.id).toBe("abc-123")
    })

    it("exposes an empty components map initially", () => {
        const entity = new Entity("e1")

        expect(entity.components).toBeInstanceOf(Map)
        expect(entity.components.size).toBe(0)
    })

    it("exposes an empty modifiers array initially", () => {
        const entity = new Entity("e1")

        expect(entity.modifiers).toBeInstanceOf(Array)
        expect(entity.modifiers.length).toBe(0)
    })

    it("adds a component and sets its entityId", () => {
        const entity = new Entity("e1")
        const component = new TestComponent(42)

        entity.addComponent(component)

        expect(entity.getComponent(TestComponent)).toBe(component)
        expect(component.entityId).toBe("e1")
        expect(component.entity).toBeUndefined()
    })

    it("retrieves a component by its constructor", () => {
        const entity = new Entity("e1")
        const component = new TestComponent(99)

        entity.addComponent(component)

        expect(entity.getComponent(TestComponent)).toBe(component)
    })

    it("returns undefined when the component is not present", () => {
        const entity = new Entity("e1")

        expect(entity.getComponent(TestComponent)).toBeUndefined()
    })

    it("adds a modifier and calls onAdd", () => {
        const entity = new Entity("e1")
        const modifier = {
            onAdd: vi.fn(() => entity),
            onRemove: vi.fn(() => entity),
        }

        entity.addModifier(modifier)

        expect(entity.modifiers).toContain(modifier)
        expect(modifier.onAdd).toHaveBeenCalledWith(entity)
    })

    it("removes a modifier and calls onRemove", () => {
        const entity = new Entity("e1")
        const modifier = {
            onAdd: vi.fn(() => entity),
            onRemove: vi.fn(() => entity),
        }

        entity.addModifier(modifier)
        entity.removeModifier(modifier)

        expect(entity.modifiers).not.toContain(modifier)
        expect(modifier.onRemove).toHaveBeenCalledWith(entity)
    })
})

describe("SceneNode", () => {
    it("creates a node linked to the entity", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        expect(node.entity).toBe(entity)
    })

    it("starts with no parent and no children", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)

        expect(node.parentRef).toBeNull()
        expect(node.childrenRef.size).toBe(0)
    })

    it("setParent updates both sides", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        childNode.setParent(parentNode)

        expect(childNode.parentRef).toBe(parentNode)
        expect(parentNode.childrenRef.has(childNode)).toBe(true)
    })

    it("addChild / removeChild", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parentNode.addChild(childNode)

        expect(childNode.parentRef).toBe(parentNode)
        expect(parentNode.childrenRef.has(childNode)).toBe(true)

        parentNode.removeChild(childNode)

        expect(childNode.parentRef).toBeNull()
        expect(parentNode.childrenRef.has(childNode)).toBe(false)
    })

    it("getWorldPosition with no parent", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)
        entity.addComponent(new PositionComponent(7, 13))

        const [x, y] = node.getWorldPosition()

        expect(x).toBe(7)
        expect(y).toBe(13)
    })

    it("getWorldPosition with one level of nesting", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parent.addComponent(new PositionComponent(100, 200))
        child.addComponent(new PositionComponent(10, 20))

        childNode.setParent(parentNode)

        const [x, y] = childNode.getWorldPosition()

        expect(x).toBe(110)
        expect(y).toBe(220)
    })

    it("getWorldPosition with two levels of nesting", () => {
        const grandparent = new Entity("grandparent")
        const parent = new Entity("parent")
        const child = new Entity("child")
        const grandparentNode = new SceneNode(grandparent.id, grandparent)
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        grandparent.addComponent(new PositionComponent(0, 0))
        parent.addComponent(new PositionComponent(100, 200))
        child.addComponent(new PositionComponent(10, 20))

        parentNode.setParent(grandparentNode)
        childNode.setParent(parentNode)

        const [x, y] = childNode.getWorldPosition()

        expect(x).toBe(110)
        expect(y).toBe(220)
    })

    it("collectDescendants returns all descendants", () => {
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

        const descendants: Entity[] = []
        parentNode.collectDescendants(descendants)

        expect(descendants).toHaveLength(3)
        expect(descendants).toContain(child1)
        expect(descendants).toContain(child2)
        expect(descendants).toContain(grandchild)
    })
})