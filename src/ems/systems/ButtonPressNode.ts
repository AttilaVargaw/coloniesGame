import { EventHandlerComponent } from "../components/EventHandlerComponent";
import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";


export class ButtonPressNode extends EntityNode {
    constructor(entity: Entity, public eventHandler: EventHandlerComponent) {
        super(entity);
    }
}
