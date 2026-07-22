import { EntityComponent } from "@engine/entities/entityComponent";
import type { Entity } from "./entity";
import { EntityNode } from "@engine/entities/entityNode";

export class PathComponent extends EntityComponent {
    constructor(
        public neighbours: {
            next: PathComponent | null,
            prev: PathComponent | null,
            prevDown: PathComponent | null,
            prevUp: PathComponent | null,
            nextUp: PathComponent | null,
            nextDown: PathComponent | null
        } = {
                next: null,
                prev: null,
                prevDown: null,
                prevUp: null,
                nextUp: null,
                nextDown: null
            },
        public linked: PathComponent[] = [],
        entity?: Entity,
    ) {
        super(entity)
    }

    get connections(): PathComponent[] {
        const result: PathComponent[] = []
        for (const key of ["next", "prev", "prevDown", "prevUp", "nextUp", "nextDown"] as Array<keyof typeof this.neighbours>) {
            const n = this.neighbours[key]
            if (n) result.push(n)
        }
        for (const n of this.linked) {
            if (n) result.push(n)
        }
        return result
    }
}

export class PathNode extends EntityNode {
    constructor(public path: PathComponent, entity: Entity) {
        super(entity)
    }
}
