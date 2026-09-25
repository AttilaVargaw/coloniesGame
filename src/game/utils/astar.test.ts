import { describe, it, expect } from "vitest"
import { astar } from "./pathfinder"
import { Entity } from "@/engine/entities/entity"
import { PositionComponent } from "@engine/components/position"
import { JumpNodeComponent, JumpGraphComponent } from "@game/components/jumpGraph"

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

describe("astar", () => {
    it("returns empty when there is no path", () => {
        const a = createJumpNode("a", 0, 0)
        const c = createJumpNode("c", 200, 0)

        const graph = new JumpGraphComponent()

        expect(astar({
            start: a,
            end: c,
            getNeighbors: (entity) => graph.getNeighbours(entity),
            getCost: (from, to) => {
                const fromPos = from.getComponent(PositionComponent)
                const toPos = to.getComponent(PositionComponent)
                if (!fromPos || !toPos) return Infinity
                return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y) + 5000
            },
            heuristic: (entity) => {
                const pos = entity.getComponent(PositionComponent)
                if (!pos) return Infinity
                const endPos = c.getComponent(PositionComponent)
                if (!endPos) return Infinity
                return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
            },
        })).toEqual([])
    })

    it("returns [start] when start equals end", () => {
        const a = createJumpNode("a", 0, 0)

        const graph = new JumpGraphComponent()

        expect(astar({
            start: a,
            end: a,
            getNeighbors: (entity) => graph.getNeighbours(entity),
            getCost: () => 1,
            heuristic: () => 1,
        })).toEqual([a])
    })

    it("finds a path through connected jump nodes", () => {
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 1], [1, 2]]
        )

        const path = astar({
            start: entities[0],
            end: entities[2],
            getNeighbors: (entity) => graph.getNeighbours(entity),
            getCost: (from, to) => {
                const fromPos = from.getComponent(PositionComponent)
                const toPos = to.getComponent(PositionComponent)
                if (!fromPos || !toPos) return Infinity
                return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y) + 5000
            },
            heuristic: (entity) => {
                const pos = entity.getComponent(PositionComponent)
                if (!pos) return Infinity
                const endPos = entities[2].getComponent(PositionComponent)
                if (!endPos) return Infinity
                return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
            },
        })
        expect(path).toEqual(entities)
    })

    it("returns empty for disconnected nodes", () => {
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 1]]
        )

        expect(astar({
            start: entities[0],
            end: entities[2],
            getNeighbors: (entity) => graph.getNeighbours(entity),
            getCost: (from, to) => {
                const fromPos = from.getComponent(PositionComponent)
                const toPos = to.getComponent(PositionComponent)
                if (!fromPos || !toPos) return Infinity
                return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y) + 5000
            },
            heuristic: (entity) => {
                const pos = entity.getComponent(PositionComponent)
                if (!pos) return Infinity
                const endPos = entities[2].getComponent(PositionComponent)
                if (!endPos) return Infinity
                return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
            },
        })).toEqual([])
    })

    it("prefers fewer hops over shorter total distance", () => {
        const { graph, entities } = createLinearPathGraph(
            [["a", 0, 0], ["b", 100, 0], ["c", 200, 0]],
            [[0, 2], [0, 1], [1, 2]]
        )

        const path = astar({
            start: entities[0],
            end: entities[2],
            getNeighbors: (entity) => graph.getNeighbours(entity),
            getCost: (from, to) => {
                const fromPos = from.getComponent(PositionComponent)
                const toPos = to.getComponent(PositionComponent)
                if (!fromPos || !toPos) return Infinity
                return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y) + 5000
            },
            heuristic: (entity) => {
                const pos = entity.getComponent(PositionComponent)
                if (!pos) return Infinity
                const endPos = entities[2].getComponent(PositionComponent)
                if (!endPos) return Infinity
                return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
            },
        })
        expect(path).toEqual([entities[0], entities[2]])
    })
})
