import { describe, it, expect } from "vitest"
import { aStar } from "./pathfinder"
import { Entity } from "@/engine/entities/entity"
import { PathComponent } from "@/game/components/pathComponent"
import { PositionComponent } from "@/engine/components/position"

function createWaypoint(id: string, x: number, y: number) {
    const entity = new Entity(id)
    entity.addComponent(new PositionComponent(x, y))

    const path = new PathComponent()
    path.entity = entity
    entity.addComponent(path)

    return entity
}

function link(from: Entity, to: Entity) {
    const fromPath = from.getComponent(PathComponent)!
    const toPath = to.getComponent(PathComponent)!

    fromPath.linked.push(toPath)
    toPath.linked.push(fromPath)
}

describe("pathfinder", () => {
    it("returns empty when start has no PathComponent", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        const end = new Entity("end")
        end.addComponent(new PositionComponent(100, 0))
        end.addComponent(new PathComponent())

        expect(aStar(start, end)).toEqual([])
    })

    it("returns empty when end has no PathComponent", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        start.addComponent(new PathComponent())

        const end = new Entity("end")
        end.addComponent(new PositionComponent(100, 0))

        expect(aStar(start, end)).toEqual([])
    })

    it("returns [start] when start equals end", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        start.addComponent(new PathComponent())

        expect(aStar(start, start)).toEqual([start])
    })

    it("returns empty when there is no path between linked waypoints", () => {
        const a = new Entity("a")
        a.addComponent(new PositionComponent(0, 0))
        a.addComponent(new PathComponent())

        const c = new Entity("c")
        c.addComponent(new PositionComponent(200, 0))
        c.addComponent(new PathComponent())

        expect(aStar(a, c)).toEqual([])
    })

    it("finds a straight-line path across linked waypoints", () => {
        const a = createWaypoint("a", 0, 0)
        const b = createWaypoint("b", 100, 0)
        const c = createWaypoint("c", 200, 0)

        link(a, b)
        link(b, c)

        const path = aStar(a, c)
        expect(path).toEqual([a, b, c])
    })

    it("returns empty for unreachable waypoints", () => {
        const a = createWaypoint("a", 0, 0)
        const c = createWaypoint("c", 200, 0)
        // b is missing, so a and c are not linked

        expect(aStar(a, c)).toEqual([])
    })
})
