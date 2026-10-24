import { PositionComponent } from "../../../components/position";
import { SizeComponent } from "../../../components/sizeComponent";
import { Entity } from "../../../entities/entity";
import { ColorComponent } from "../../../components/colorComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { RenderableNode } from "./renderableNode";

export class RectNode extends RenderableNode {
    constructor(entity: Entity,
        public position: PositionComponent,
        public size: SizeComponent,
        public color: ColorComponent = new ColorComponent("red"),
        public texture: TextureComponent | undefined = undefined,
        public rotation: number = 0,
        public emitLight: boolean = false,
        public icon = false) {
        super(color, entity);
    }
}
