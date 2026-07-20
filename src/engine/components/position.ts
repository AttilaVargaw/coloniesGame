import type { Entity } from "../entities/entity";
import { EntityComponent } from "../entities/entityComponent";
import { SceneNode } from "../entities/sceneNode";

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

        const sceneNode = (this.entity as any)?.__sceneNode as SceneNode | undefined
        const parentPosition = sceneNode?.parentRef?.entity.getComponent(PositionComponent)

        if(!parentPosition) {
            this.absoluteX = this.x;
            this.absoluteY = this.y;
        } else {
            const [parentX, parentY] = parentPosition.getAbsolute();
            this.absoluteX = parentX + this.x;
            this.absoluteY = parentY + this.y;
        }

        this.dirty = false;

        return [this.absoluteX, this.absoluteY];
    }
}
