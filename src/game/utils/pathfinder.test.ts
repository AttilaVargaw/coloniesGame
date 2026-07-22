import { describe, it, expect, beforeEach } from "vitest"
import { aStar } from "./pathfinder"
import { Entity } from "@/engine/entities/entity"
import { PathComponent } from "@/game/components/pathComponent"
import { PositionComponent } from "@/engine/components/position"

function createSectorEntity(id: string, q: number, r: number) {
    const entity = new Entity(id)
    entity.addComponent(new PositionComponent(q * 100, r * 100))

    const path = new PathComponent()
    path.entity = entity
    entity.addComponent(path)

    return entity
}

function link(from: Entity, to: Entity, fromDir: keyof PathComponent["neighbours"], toDir: keyof PathComponent["neighbours"]) {
    const fromPath = from.getComponent(PathComponent)!
    const toPath = to.getComponent(PathComponent)!

    ;(fromPath.neighbours as any)[fromDir] = toPath
    ;(toPath.neighbours as any)[toDir] = fromPath

    fromPath.entity = from
    toPath.entity = to
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

    it("returns empty when there is no path between linked sectors", () => {
        const a = new Entity("a")
        a.addComponent(new PositionComponent(0, 0))
        a.addComponent(new PathComponent())

        const c = new Entity("c")
        c.addComponent(new PositionComponent(200, 0))
        c.addComponent(new PathComponent())

        expect(aStar(a, c)).toEqual([])
    })

    it("finds a straight-line path across linked sectors", () => {
        const a = createSectorEntity("a", 0, 0)
        const b = createSectorEntity("b", 1, 0)
        const c = createSectorEntity("c", 2, 0)

        link(a, b, "next", "prev")
        link(b, c, "next", "prev")

        const path = aStar(a, c)
        expect(path).toEqual([a, b, c])
    })

    it("returns empty for unreachable sectors", () => {
        const a = createSectorEntity("a", 0, 0)
        const c = createSectorEntity("c", 2, 0)
        // b is missing, so a and c are not linked

        expect(aStar(a, c)).toEqual([])
    })
})
