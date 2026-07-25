import { ColorComponent } from "@engine/components/colorComponent";
import { PositionComponent } from "@engine/components/position";
import { RenderableNode } from "./renderableNode";
import { Entity } from "../../../entities/entity";
import { HexagonComponent } from "@engine/components/hexagonComponent";


export class HexagoneNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public color: ColorComponent, public hexagon: HexagonComponent) {
        super(color, entity);
    }
}
