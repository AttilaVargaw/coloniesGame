import { ClickableComponent } from "@/ems/components/clickableComponent";
import { PositionComponent } from "@/ems/components/position";
import { PositionNode } from "./positionNode";


export class ClickableNode extends PositionNode {
    constructor(public position: PositionComponent, public clickable: ClickableComponent) {
        super(position);
    }
}
