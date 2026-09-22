import { TimeScaleComponent } from "../components/timeScaleComponent";
import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";

export class TimeScaleNode extends EntityNode {
    constructor(entity: Entity, public timeScale: TimeScaleComponent) {
        super(entity);
    }
}
