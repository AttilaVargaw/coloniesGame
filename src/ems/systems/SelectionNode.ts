import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";
import { SelectableComponent } from "../components/SelectableComponent";

export class SelectionNode extends EntityNode {
    constructor(entity: Entity, public selection: SelectableComponent) {
        super(entity);
    }
}
