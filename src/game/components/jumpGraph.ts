import { EntityComponent } from "@engine/entities/entityComponent"
import type { Entity } from "@/engine/entities/entity"

export class JumpNodeComponent extends EntityComponent {
    constructor(entity?: Entity) {
        super(entity)
    }
}

export class JumpGraphComponent extends EntityComponent {
    adjacency: Map<Entity, Set<Entity>>

    constructor(entity?: Entity) {
        super(entity)
        this.adjacency = new Map()
    }

    addEdge(source: Entity, target: Entity): void {
        if (!this.adjacency.has(source)) {
            this.adjacency.set(source, new Set())
        }
        this.adjacency.get(source)!.add(target)
    }

    clear(): void {
        this.adjacency.clear()
    }

    getNeighbours(entity: Entity): Entity[] {
        return Array.from(this.adjacency.get(entity) ?? [])
    }
}
