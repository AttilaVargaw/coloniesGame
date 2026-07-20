import { describe, it, expect, vi } from "vitest"
import { Entity } from "@engine/entities/entity"
import { EntityComponent } from "@engine/entities/entityComponent"
import { PositionComponent } from "@engine/components/position"
import type { Engine } from "@engine/core/engine"

class MockEngine implements Engine {
    addEntity = vi.fn()
    removeEntity = vi.fn()
    reindexEntity = vi.fn()
    dispatchEvent = vi.fn()
}

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

    it("exposes an empty children set initially", () => {
        const entity = new Entity("e1")

        expect(entity.children).toBeInstanceOf(Set)
        expect(entity.children.size).toBe(0)
    })

    it("exposes an empty modifiers array initially", () => {
        const entity = new Entity("e1")

        expect(entity.modifiers).toBeInstanceOf(Array)
        expect(entity.modifiers.length).toBe(0)
    })

    it("returns null parent initially", () => {
        const entity = new Entity("e1")

        expect(entity.parent).toBeNull()
        expect(entity.getParent()).toBeNull()
    })

    it("attaches itself and all children to the engine", () => {
        const engine = new MockEngine()
        const parent = new Entity("parent")
        const child = new Entity("child")
        parent.addChild(child)

        parent.attachToEngine(engine)

        expect(parent.engine).toBe(engine)
        expect(child.engine).toBe(engine)
    })

    it("detaches itself and all children from the engine", () => {
        const engine = new MockEngine()
        const parent = new Entity("parent")
        const child = new Entity("child")
        parent.addChild(child)

        parent.attachToEngine(engine)
        parent.detachFromEngine()

        expect(parent.engine).toBeUndefined()
        expect(child.engine).toBeUndefined()
    })

    it("adds a child and sets its parent", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")

        parent.addChild(child)

        expect(child.parent).toBe(parent)
        expect(parent.children.has(child)).toBe(true)
    })

    it("revalidates positions on the child and its descendants when added", () => {
        const parent = new Entity("parent")
        parent.addComponent(new PositionComponent(0, 0))

        const child = new Entity("child")
        child.addComponent(new PositionComponent(10, 20))

        const grandchild = new Entity("grandchild")
        grandchild.addComponent(new PositionComponent(5, 5))

        child.addChild(grandchild)
        parent.addChild(child)

        expect(child.getComponent(PositionComponent)!.dirty).toBe(true)
        expect(grandchild.getComponent(PositionComponent)!.dirty).toBe(true)
    })

    it("adds children to the engine when the parent is already attached", () => {
        const engine = new MockEngine()
        const parent = new Entity("parent")
        parent.attachToEngine(engine)

        const child = new Entity("child")
        parent.addChild(child)

        expect(engine.addEntity).toHaveBeenCalledWith(child)
    })

    it("sets parent, adds to parent engine, and revalidates position", () => {
        const parent = new Entity("parent")
        parent.addComponent(new PositionComponent(100, 200))

        const child = new Entity("child")
        child.addComponent(new PositionComponent(10, 20))

        child.setParent(parent)

        expect(child.parent).toBe(parent)
        expect(parent.children.has(child)).toBe(true)
        expect(child.getComponent(PositionComponent)!.dirty).toBe(true)
    })

    it("adds a component and sets its entity reference", () => {
        const entity = new Entity("e1")
        const component = new TestComponent(42)

        entity.addComponent(component)

        expect(entity.getComponent(TestComponent)).toBe(component)
        expect(component.entity).toBe(entity)
    })

    it("reindexes the entity in the engine when a component is added", () => {
        const engine = new MockEngine()
        const entity = new Entity("e1")
        entity.attachToEngine(engine)

        entity.addComponent(new TestComponent(1))

        expect(engine.reindexEntity).toHaveBeenCalledWith(entity)
    })

    it("removes a component and dispatches the componentRemoved event", () => {
        const engine = new MockEngine()
        const entity = new Entity("e1")
        entity.attachToEngine(engine)

        const component = new TestComponent(1)
        entity.addComponent(component)

        entity.removeComponent(TestComponent)

        expect(entity.getComponent(TestComponent)).toBeUndefined()
        expect(engine.reindexEntity).toHaveBeenCalledWith(entity)
        expect(engine.dispatchEvent).toHaveBeenCalledWith("componentRemoved", TestComponent)
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

    it("removes a child and revalidates positions", () => {
        const parent = new Entity("parent")
        parent.addComponent(new PositionComponent(0, 0))

        const child = new Entity("child")
        child.addComponent(new PositionComponent(10, 20))
        parent.addChild(child)

        expect(child.getComponent(PositionComponent)!.dirty).toBe(true)

        parent.removeChild(child)

        expect(parent.children.has(child)).toBe(false)
        expect(child.parent).toBeNull()
        expect(child.getComponent(PositionComponent)!.dirty).toBe(true)
    })
})
