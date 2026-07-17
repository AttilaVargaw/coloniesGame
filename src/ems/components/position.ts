import { EntityComponent } from "../entities/entityComponent";
import { Entity } from "../entities/entity";
export class PositionComponent extends EntityComponent {
    constructor(public x: number, public y: number, public z: number = 0, public entity?: Entity) {
        super(entity)
    }
}