import { describe, it, expect } from "vitest"
import { astar } from "./pathfinder"
import type { Entity } from "@/engine/entities/entity"

function makeEntity(id: string): Entity {
    return { id } as unknown as Entity
}

describe("astar", () => {
    it("returns [start] when start === end", () => {
        const entity = makeEntity("a")
        const result = astar({
            start: entity,
            end: entity,
            getNeighbors: () => [],
            getCost: () => 0,
            heuristic: () => 0,
        })
        expect(result).toEqual([entity])
    })

    it("finds direct path when end is a neighbor", () => {
        const start = makeEntity("start")
        const end = makeEntity("end")
        const result = astar({
            start,
            end,
            getNeighbors: (n) => n === start ? [end] : [],
            getCost: () => 1,
            heuristic: () => 0,
        })
        expect(result).toEqual([start, end])
    })

    it("finds multi-hop path", () => {
        const a = makeEntity("a")
        const b = makeEntity("b")
        const c = makeEntity("c")
        const d = makeEntity("d")
        const result = astar({
            start: a,
            end: d,
            getNeighbors: (n) => {
                if(n === a) return [b]
                if(n === b) return [c]
                if(n === c) return [d]
                return []
            },
            getCost: () => 1,
            heuristic: () => 0,
        })
        expect(result).toEqual([a, b, c, d])
    })

    it("returns empty array when no path exists", () => {
        const start = makeEntity("start")
        const end = makeEntity("end")
        const result = astar({
            start,
            end,
            getNeighbors: () => [],
            getCost: () => 1,
            heuristic: () => 0,
        })
        expect(result).toEqual([])
    })

    it("respects getCost when choosing path", () => {
        const start = makeEntity("start")
        const mid = makeEntity("mid")
        const end = makeEntity("end")
        // Direct path cost 10, via mid cost 1+1=2
        const result = astar({
            start,
            end,
            getNeighbors: (n) => {
                if(n === start) return [mid, end]
                if(n === mid) return [end]
                return []
            },
            getCost: (from, to) => {
                if(from === start && to === end) return 10
                return 1
            },
            heuristic: () => 0,
        })
        expect(result).toEqual([start, mid, end])
    })

    it("uses heuristic to guide search", () => {
        const start = makeEntity("start")
        const end = makeEntity("end")
        const mid = makeEntity("mid")
        let heuristicCalls = 0
        const result = astar({
            start,
            end,
            getNeighbors: (n) => n === start ? [mid, end] : [],
            getCost: () => 1,
            heuristic: (n) => {
                heuristicCalls++
                return n === end ? 0 : 100
            },
        })
        expect(result).toEqual([start, end])
        expect(heuristicCalls).toBeGreaterThan(0)
    })
})
