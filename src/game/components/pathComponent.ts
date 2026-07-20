import { EntityComponent } from "@engine/entities/entityComponent";
import type { Entity } from "@engine/entities/entity";
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
        entity?: Entity,
    ) {
        super(entity)
    }
}

export class PathNode extends EntityNode {
    constructor(public path: PathComponent, entity: Entity) {
        super(entity)
    }
}
