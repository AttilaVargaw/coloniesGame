import { LabelComponent } from "../../../components/label";
import { PositionComponent } from "../../../components/position";
import { Entity } from "../../../entities/entity";
import { RenderableNode } from "./renderableNode";

export class LabelNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public label: LabelComponent) {
        super(position, label.color, entity);
    }
}
