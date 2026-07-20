import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@engine/entities/entityNode";
import { SelectableComponent } from "@engine/components/SelectableComponent";

export class SelectionNode extends EntityNode {
    constructor(entity: Entity, public selection: SelectableComponent) {
        super(entity);
    }
}