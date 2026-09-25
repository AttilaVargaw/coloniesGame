import type { Entity } from "@/engine/entities/entity"

interface AstarOptions {
    start: Entity
    end: Entity
    getNeighbors: (node: Entity) => Entity[]
    getCost: (from: Entity, to: Entity) => number
    heuristic: (node: Entity) => number
}

class OpenSet {
    private heap: Array<{ entity: Entity; f: number }> = []
    private inOpen = new Set<Entity>()

    push(entity: Entity, f: number): void {
        if(this.inOpen.has(entity)) return
        this.inOpen.add(entity)
        this.heap.push({ entity, f })
        this.siftUp(this.heap.length - 1)
    }

    pop(): Entity | undefined {
        if(this.heap.length === 0) return undefined
        const top = this.heap[0]
        const last = this.heap.pop()!
        this.inOpen.delete(top.entity)
        if(this.heap.length > 0) {
            this.heap[0] = last
            this.siftDown(0)
        }
        return top.entity
    }

    remove(entity: Entity): void {
        if(!this.inOpen.has(entity)) return
        this.inOpen.delete(entity)
    }

    get size(): number {
        return this.heap.length
    }

    private siftUp(i: number): void {
        while(i > 0) {
            const parent = (i - 1) >> 1
            if(this.heap[i].f < this.heap[parent].f) {
                ;[this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]]
                i = parent
            } else {
                break
            }
        }
    }

    private siftDown(i: number): void {
        const n = this.heap.length
        while(true) {
            let smallest = i
            const left = (i << 1) + 1
            const right = (i << 1) + 2
            if(left < n && this.heap[left].f < this.heap[smallest].f) smallest = left
            if(right < n && this.heap[right].f < this.heap[smallest].f) smallest = right
            if(smallest !== i) {
                ;[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]]
                i = smallest
            } else {
                break
            }
        }
    }
}

export function astar({
    start,
    end,
    getNeighbors,
    getCost,
    heuristic,
}: AstarOptions): Entity[] {
    if(start === end) {
        return [start]
    }

    const openSet = new OpenSet()
    openSet.push(start, heuristic(start))
    const cameFrom = new Map<Entity, Entity>()
    const gScore = new Map<Entity, number>([[start, 0]])
    const fScore = new Map<Entity, number>([[start, heuristic(start)]])

    while(openSet.size > 0) {
        const current = openSet.pop()!

        if(current === end) {
            const path: Entity[] = [end]
            let node: Entity | undefined = end
            while((node = cameFrom.get(node!))) {
                path.unshift(node)
            }
            return path
        }

        const currentG = gScore.get(current) ?? Infinity

        for(const neighbor of getNeighbors(current)) {
            const tentativeG = currentG + getCost(current, neighbor)

            const neighborG = gScore.get(neighbor) ?? Infinity
            if(tentativeG < neighborG) {
                cameFrom.set(neighbor, current)
                gScore.set(neighbor, tentativeG)
                const f = tentativeG + heuristic(neighbor)
                fScore.set(neighbor, f)
                openSet.push(neighbor, f)
            }
        }
    }

    return []
}
