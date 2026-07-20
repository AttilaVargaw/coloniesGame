import { DateComponent } from "../components/dateComponent";
import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";


export class DateNode extends EntityNode {
    constructor(entity: Entity, public date: DateComponent) {
        super(entity);
    }
}
