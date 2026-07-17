import { DateComponent } from "../components/dateComponent";
import { Entity } from "../entities/entity";


export class DateNode {
    constructor(public entity: Entity, public date: DateComponent) {
    }
}
