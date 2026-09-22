import { MassComponent } from "../components/massComponent";
import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";

export class MassNode extends EntityNode {
    constructor(entity: Entity, public mass: MassComponent) {
        super(entity);
    }
}
