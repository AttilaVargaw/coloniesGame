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
    dirty = true;

    constructor(public x: number, public y: number, public z: number = 0, entity?: Entity) {
        super(entity)
    }

    getAbsolute(): [number, number] {
        if(!this.dirty) {
            return [this.absoluteX, this.absoluteY];
        }

        const parent = this.entity?.parent?.getComponent(PositionComponent);

        if(!parent) {
            this.absoluteX = this.x;
            this.absoluteY = this.y;
        } else {
            const [parentX, parentY] = parent.getAbsolute();
            this.absoluteX = parentX + this.x;
            this.absoluteY = parentY + this.y;
        }

        this.dirty = false;

        return [this.absoluteX, this.absoluteY];
    }
}
