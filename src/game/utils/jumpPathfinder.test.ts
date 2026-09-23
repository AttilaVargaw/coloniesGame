import { describe, it, expect } from "vitest"
import { jumpAStar } from "./jumpPathfinder"
import { Entity } from "@/engine/entities/entity"
import { PositionComponent } from "@engine/components/position"
import { JumpNodeComponent } from "@game/components/jumpGraph"
import { JumpGraphComponent } from "@game/components/jumpGraph"

function createJumpNode(id: string, x: number, y: number) {
    const entity = new Entity(id)
    entity.addComponent(new PositionComponent(x, y))
    entity.addComponent(new JumpNodeComponent())
    return entity
}

describe("jumpPathfinder", () => {
    it("returns empty when there is no path", () => {
        const a = createJumpNode("a", 0, 0)
        const c = createJumpNode("c", 200, 0)

        const graph = new JumpGraphComponent()

        expect(jumpAStar(a, c, graph)).toEqual([])
    })

    it("returns [start] when start equals end", () => {
        const a = createJumpNode("a", 0, 0)

        const graph = new JumpGraphComponent()

        expect(jumpAStar(a, a, graph)).toEqual([a])
    })

    it("finds a path through connected jump nodes", () => {
        const a = createJumpNode("a", 0, 0)
        const b = createJumpNode("b", 100, 0)
        const c = createJumpNode("c", 200, 0)

        const graph = new JumpGraphComponent()
        graph.addEdge(a, b)
        graph.addEdge(b, c)

        const path = jumpAStar(a, c, graph)
        expect(path).toEqual([a, b, c])
    })

    it("returns empty for disconnected nodes", () => {
        const a = createJumpNode("a", 0, 0)
        const b = createJumpNode("b", 100, 0)
        const c = createJumpNode("c", 200, 0)

        const graph = new JumpGraphComponent()
        graph.addEdge(a, b)
        // c is not connected

        expect(jumpAStar(a, c, graph)).toEqual([])
    })

    it("prefers fewer hops over shorter total distance", () => {
        const a = createJumpNode("a", 0, 0)
        const b = createJumpNode("b", 100, 0)
        const c = createJumpNode("c", 200, 0)

        const graph = new JumpGraphComponent()
        graph.addEdge(a, c)
        graph.addEdge(a, b)
        graph.addEdge(b, c)

        const path = jumpAStar(a, c, graph)
        expect(path).toEqual([a, c])
    })
})
