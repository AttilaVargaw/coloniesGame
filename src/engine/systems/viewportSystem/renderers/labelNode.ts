import { LabelComponent } from "../../../components/label";
import { ColorComponent } from "../../../components/colorComponent";
import { PositionComponent } from "../../../components/position";
import { Entity } from "../../../entities/entity";
import { RenderableNode } from "./renderableNode";

export class LabelNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public color: ColorComponent, public label: LabelComponent) {
        super(color, entity);
    }
}
