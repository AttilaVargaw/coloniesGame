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
    let sectors: Map<string, Entity>

    beforeEach(() => {
        sectors = new Map()
    })

    it("returns empty when start has no PathComponent", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        const end = new Entity("end")
        end.addComponent(new PositionComponent(100, 0))
        end.addComponent(new PathComponent())

        sectors.set("0:0", start)
        sectors.set("1:0", end)

        expect(aStar(start, end, sectors)).toEqual([])
    })

    it("returns empty when end has no PathComponent", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        start.addComponent(new PathComponent())

        const end = new Entity("end")
        end.addComponent(new PositionComponent(100, 0))

        sectors.set("0:0", start)
        sectors.set("1:0", end)

        expect(aStar(start, end, sectors)).toEqual([])
    })

    it("returns [start] when start equals end", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        start.addComponent(new PathComponent())

        sectors.set("0:0", start)

        expect(aStar(start, start, sectors)).toEqual([start])
    })

    it("returns empty when end is not in sectors map", () => {
        const start = new Entity("start")
        start.addComponent(new PositionComponent(0, 0))
        start.addComponent(new PathComponent())

        const end = new Entity("end")
        end.addComponent(new PositionComponent(100, 0))
        end.addComponent(new PathComponent())

        expect(aStar(start, end, sectors)).toEqual([])
    })

    it("finds a straight-line path across linked sectors", () => {
        const a = createSectorEntity("a", 0, 0)
        const b = createSectorEntity("b", 1, 0)
        const c = createSectorEntity("c", 2, 0)

        link(a, b, "next", "prev")
        link(b, c, "next", "prev")

        sectors.set("0:0", a)
        sectors.set("1:0", b)
        sectors.set("2:0", c)

        const path = aStar(a, c, sectors)
        expect(path).toEqual([a, b, c])
    })

    it("returns empty for unreachable sectors", () => {
        const a = createSectorEntity("a", 0, 0)
        const c = createSectorEntity("c", 2, 0)
        // b is missing, so a and c are not linked

        sectors.set("0:0", a)
        sectors.set("2:0", c)

        expect(aStar(a, c, sectors)).toEqual([])
    })
})
