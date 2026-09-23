import type { Entity } from "@/engine/entities/entity"
import { PositionComponent } from "@engine/components/position"
import { JumpGraphComponent } from "@game/components/jumpGraph"

export function jumpAStar(
    start: Entity,
    end: Entity,
    graph: JumpGraphComponent,
    getPosition: (entity: Entity) => { x: number, y: number } | undefined = (entity) => entity.getComponent(PositionComponent)
): Entity[] {
    if (start === end) {
        return [start]
    }

    const endPos = getPosition(end)
    const h = (a: Entity): number => {
        const pos = getPosition(a)
        if (!pos || !endPos) return Infinity
        return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
    }

    const openSet = new Set<Entity>([start])
    const cameFrom = new Map<Entity, Entity>()
    const gScore = new Map<Entity, number>([[start, 0]])
    const fScore = new Map<Entity, number>([[start, h(start)]])

    while (openSet.size > 0) {
        const current = [...openSet].reduce((best, e) => {
            const f = fScore.get(e) ?? Infinity
            const bestF = fScore.get(best) ?? Infinity
            return f < bestF ? e : best
        })

        if (current === end) {
            const path: Entity[] = [end]
            let node: Entity | undefined = end
            while ((node = cameFrom.get(node!))) {
                path.unshift(node)
            }
            return path
        }

        openSet.delete(current)
        const currentG = gScore.get(current) ?? Infinity
        const currentPos = getPosition(current)

        for (const neighbour of graph.getNeighbours(current)) {
            if (!currentPos) continue
            const neighbourPos = getPosition(neighbour)
            if (!neighbourPos) continue

            const dist = Math.hypot(
                currentPos.x - neighbourPos.x,
                currentPos.y - neighbourPos.y
            )
            const tentativeG = currentG + dist

            const neighbourG = gScore.get(neighbour) ?? Infinity
            if (tentativeG < neighbourG) {
                cameFrom.set(neighbour, current)
                gScore.set(neighbour, tentativeG)
                fScore.set(neighbour, tentativeG + h(neighbour))
                openSet.add(neighbour)
            }
        }
    }

    return []
}
