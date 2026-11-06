import { describe, it, expect } from "vitest"
import { PathComponent } from "./pathComponent"

describe("PathComponent connections edge cases", () => {
    it("returns empty array when no neighbours and no linked", () => {
        const path = new PathComponent()
        expect(path.connections).toEqual([])
    })

    it("returns only non-null neighbours", () => {
        const next = new PathComponent()
        const prev = new PathComponent()
        const path = new PathComponent({
            next,
            prev,
            prevDown: null,
            prevUp: null,
            nextUp: null,
            nextDown: null,
        })
        expect(path.connections).toHaveLength(2)
        expect(path.connections).toContain(next)
        expect(path.connections).toContain(prev)
    })

    it("returns all six neighbours when all are present", () => {
        const next = new PathComponent()
        const prev = new PathComponent()
        const prevDown = new PathComponent()
        const prevUp = new PathComponent()
        const nextUp = new PathComponent()
        const nextDown = new PathComponent()
        const path = new PathComponent({
            next,
            prev,
            prevDown,
            prevUp,
            nextUp,
            nextDown,
        })
        expect(path.connections).toHaveLength(6)
        expect(path.connections).toContain(next)
        expect(path.connections).toContain(prev)
        expect(path.connections).toContain(prevDown)
        expect(path.connections).toContain(prevUp)
        expect(path.connections).toContain(nextUp)
        expect(path.connections).toContain(nextDown)
    })

    it("includes linked path components", () => {
        const linked = [new PathComponent(), new PathComponent()]
        const path = new PathComponent({
            next: null,
            prev: null,
            prevDown: null,
            prevUp: null,
            nextUp: null,
            nextDown: null,
        }, linked)
        expect(path.connections).toHaveLength(2)
        expect(path.connections).toContain(linked[0])
        expect(path.connections).toContain(linked[1])
    })

    it("combines neighbours and linked", () => {
        const neighbour = new PathComponent()
        const linked1 = new PathComponent()
        const linked2 = new PathComponent()
        const path = new PathComponent({
            next: neighbour,
            prev: null,
            prevDown: null,
            prevUp: null,
            nextUp: null,
            nextDown: null,
        }, [linked1, linked2])
        expect(path.connections).toHaveLength(3)
        expect(path.connections).toContain(neighbour)
        expect(path.connections).toContain(linked1)
        expect(path.connections).toContain(linked2)
    })

    it("filters out null entries in linked array", () => {
        const valid = new PathComponent()
        const path = new PathComponent(
            {
                next: null,
                prev: null,
                prevDown: null,
                prevUp: null,
                nextUp: null,
                nextDown: null,
            },
            [valid, null as any]
        )
        expect(path.connections).toHaveLength(1)
        expect(path.connections).toContain(valid)
    })

    it("includes duplicate references", () => {
        const same = new PathComponent()
        const path = new PathComponent({
            next: same,
            prev: same,
            prevDown: null,
            prevUp: null,
            nextUp: null,
            nextDown: null,
        }, [same])
        expect(path.connections).toHaveLength(3)
        expect(path.connections).toContain(same)
    })
})
