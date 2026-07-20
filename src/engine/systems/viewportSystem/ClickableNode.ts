import { ClickableComponent } from "@engine/components/clickableComponent";
import { PositionComponent } from "@engine/components/position";
import { Entity } from "@engine/entities/entity";
import { PositionNode } from "./positionNode";


export class ClickableNode extends PositionNode {
    constructor(position: PositionComponent, public clickable: ClickableComponent, entity: Entity) {
        super(position, entity);
    }
}
