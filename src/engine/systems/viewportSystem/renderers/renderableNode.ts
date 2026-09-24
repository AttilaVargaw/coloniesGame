import { ColorComponent } from "@engine/components/colorComponent";
import { Entity } from "@engine/entities/entity";
import { EntityNode } from "@/engine/entities/entityNode";


export class RenderableNode extends EntityNode {
    constructor(public color: ColorComponent, entity: Entity, public zIndex = 0) {
        super(entity);
    }

    setColor(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color.fill || "";
        ctx.strokeStyle = this.color.stroke || "";
    }
}