import type { Entity } from "../entities/entity";
import { EntityComponent } from "../entities/entityComponent";

export interface WorldPosition {
    x: number;
    y: number;
    z: number;
}
export class PositionComponent extends EntityComponent implements WorldPosition {
    absoluteX = 0;
    absoluteY = 0;

    constructor(public x: number, public y: number, public z: number = 0, entity?: Entity) {
        super(entity)
    }
}
