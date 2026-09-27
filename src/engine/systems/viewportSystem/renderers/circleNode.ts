import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { PositionComponent } from "../../../components/position";
import { Entity } from "../../../entities/entity";
import { RenderableNode } from "./renderableNode";
import { TextureComponent } from "../../../components/textureComponent";

export class CircleNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public color: ColorComponent = new ColorComponent("red"),
        public thickness: ThicknessComponent = new ThicknessComponent(1),
        public emitLight: boolean = false,
        public texture: TextureComponent | undefined = undefined
    ) {
        super(color, entity);
    }
}