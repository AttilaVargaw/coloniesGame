import { describe, it, expect } from "vitest"
import { PositionComponent } from "@engine/components/position"
import { Entity } from "@engine/entities/entity"
import { SceneNode } from "@engine/entities/sceneNode"

describe("PositionComponent", () => {
    it("initializes x, y, and z from the constructor", () => {
        const component = new PositionComponent(10, 20, 5)

        expect(component.x).toBe(10)
        expect(component.y).toBe(20)
        expect(component.z).toBe(5)
    })

    it("defaults z to 0 when not provided", () => {
        const component = new PositionComponent(1, 2)

        expect(component.z).toBe(0)
    })

    it("returns [x, y] when there is no parent", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)
        entity.addComponent(new PositionComponent(7, 13))

        const [absX, absY] = node.getWorldPosition()

        expect(absX).toBe(7)
        expect(absY).toBe(13)
    })

    it("computes absolute position relative to parent", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        parent.addComponent(new PositionComponent(100, 200))
        child.addComponent(new PositionComponent(10, 20))

        childNode.setParent(parentNode)

        const [absX, absY] = childNode.getWorldPosition()

        expect(absX).toBe(110)
        expect(absY).toBe(220)
    })

    it("recalculates absolute position when the parent moves", () => {
        const parent = new Entity("parent")
        const child = new Entity("child")
        const parentNode = new SceneNode(parent.id, parent)
        const childNode = new SceneNode(child.id, child)

        const parentPos = new PositionComponent(50, 60)
        parent.addComponent(parentPos)
        child.addComponent(new PositionComponent(5, 10))

        childNode.setParent(parentNode)

        let [absX, absY] = childNode.getWorldPosition()
        expect(absX).toBe(55)
        expect(absY).toBe(70)

        parentPos.x = 100
        parentPos.y = 200

        const result = childNode.getWorldPosition()
        expect(result[0]).toBe(105)
        expect(result[1]).toBe(210)
    })

    it("does not include z in absolute calculation", () => {
        const entity = new Entity("e1")
        const node = new SceneNode(entity.id, entity)
        entity.addComponent(new PositionComponent(1, 2, 99))

        const [absX, absY] = node.getWorldPosition()

        expect(absX).toBe(1)
        expect(absY).toBe(2)
    })
})