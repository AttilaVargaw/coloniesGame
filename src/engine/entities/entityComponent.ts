import type { Entity } from "./entity";

export class EntityComponent {
    entityId: string
    entity?: Entity

    constructor(entity?: Entity) {
        this.entity = entity
        this.entityId = entity?.id ?? ""
    }
}