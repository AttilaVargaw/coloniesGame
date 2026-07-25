import { ClickableComponent } from "@engine/components/clickableComponent";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@/engine/entities/entityNode";

export class ClickableNode extends EntityNode {
    constructor(public clickable: ClickableComponent, entity: Entity) {
        super(entity);
    }
}
