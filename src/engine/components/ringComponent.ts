import { EntityComponent } from "../entities/entityComponent"
import type { Entity } from "../entities/entity"

export class RingComponent extends EntityComponent {
    innerRadius: number
    outerRadius: number
    color: string

    constructor(entity?: Entity, innerRadius: number = 0, outerRadius: number = 0, color: string = "") {
        super(entity)
        this.innerRadius = innerRadius
        this.outerRadius = outerRadius
        this.color = color
    }
}
