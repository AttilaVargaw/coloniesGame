import { ClickableComponent } from "@engine/components/clickableComponent";
import { PositionComponent } from "@engine/components/position";
import { PositionNode } from "./positionNode";


export class ClickableNode extends PositionNode {
    constructor(position: PositionComponent, public clickable: ClickableComponent) {
        super(position);
    }
}
