import { describe, it, expect, vi } from "vitest"
import { Entity } from "@engine/entities/entity"
import { EntityComponent } from "@engine/entities/entityComponent"

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