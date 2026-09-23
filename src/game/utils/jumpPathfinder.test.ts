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

function createLinearPathGraph(nodes: Array<[string, number, number]>, edges: Array<[number, number]>) {
    const graph = new JumpGraphComponent()
    const entities = nodes.map(([id, x, y]) => createJumpNode(id, x, y))
    for (const [from, to] of edges) {
        graph.addEdge(entities[from], entities[to])
    }
    return { graph, entities }
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
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 1], [1, 2]]
        )

        const path = jumpAStar(entities[0], entities[2], graph)
        expect(path).toEqual(entities)
    })

    it("returns empty for disconnected nodes", () => {
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 1]]
        )

        expect(jumpAStar(entities[0], entities[2], graph)).toEqual([])
    })

    it("prefers fewer hops over shorter total distance", () => {
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 2], [0, 1], [1, 2]]
        )

        const path = jumpAStar(entities[0], entities[2], graph)
        expect(path).toEqual([entities[0], entities[2]])
    })
})
