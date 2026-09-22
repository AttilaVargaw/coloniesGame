import { EntityComponent } from "../entities/entityComponent";
import { Entity } from "../entities/entity";

export class TimeScaleComponent extends EntityComponent {
    constructor(public multiplier: number = 1, entity?: Entity) {
        super(entity)
    }
}
