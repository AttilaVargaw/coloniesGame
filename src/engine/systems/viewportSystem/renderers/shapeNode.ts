import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { PositionComponent } from "../../../components/position";
import { Entity } from "../../../entities/entity";
import { RenderableNode } from "./renderableNode";
import { EntityComponent } from "@/engine/entities/entityComponent";
import { Vector2 } from "@/lib/Vector2";

export class ShapeComponent extends EntityComponent {
    constructor(entity: Entity, public path: Vector2[]) {
        super(entity)
    }
}

export class ShapeNode extends RenderableNode {
    public readonly height: number;
    public readonly width: number;

    constructor(
        entity: Entity,
        public position: PositionComponent,
        public color: ColorComponent,
        public thickness: ThicknessComponent = new ThicknessComponent(1),
        public shape: ShapeComponent
    ) {
        super(color, entity);

        this.width = this.shape.path.reduce((acc, [x]) => Math.max(acc, x), -Infinity) - this.shape.path.reduce((acc, [x]) => Math.min(acc, x), Infinity);
        this.height = this.shape.path.reduce((acc, [, y]) => Math.max(acc, y), -Infinity) - this.shape.path.reduce((acc, [, y]) => Math.min(acc, y), Infinity);
    }
}