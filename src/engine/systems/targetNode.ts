import { Entity } from "../entities/entity";
import { EntityNode } from "../entities/entityNode";
import { TargetableComponent } from "@engine/components/targetableComponent";

export class TargetableNode extends EntityNode {
    constructor(
        entity: Entity,
        public targetable: TargetableComponent
    ) {
        super(entity)
    }
}
