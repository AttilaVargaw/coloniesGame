import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { PositionComponent } from "../../../components/position";
import { Entity } from "../../../entities/entity";
import { RenderableNode } from "./renderableNode";

export class CircleNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public color: ColorComponent = new ColorComponent("red"),
        public thickness: ThicknessComponent = new ThicknessComponent(1),
    ) {
        super(color, entity);
    }
}