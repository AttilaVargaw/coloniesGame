import { ColorComponent } from "@/ems/components/colorComponent";
import { PositionComponent } from "@/ems/components/position";
import { RenderableNode } from "./renderableNode";
import { Entity } from "../../../entities/entity";
import { HexagonComponent } from "@/ems/components/hexagonComponent";


export class HexagoneNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public color: ColorComponent, public hexagon: HexagonComponent) {
        super(position, color, entity);
    }
}
