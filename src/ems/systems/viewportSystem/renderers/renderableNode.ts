import { ColorComponent } from "@/ems/components/colorComponent";
import { PositionNode } from "../positionNode";
import { PositionComponent } from "@/ems/components/position";
import { Entity } from "@/ems/entities/entity";


export class RenderableNode extends PositionNode {
    constructor(position: PositionComponent, public color: ColorComponent, entity?: Entity) {
        super(position, undefined, entity);
    }

    setColor(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color.fill ?? "";
        ctx.strokeStyle = this.color.stroke ?? "";
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.color.stroke && ctx.stroke();
        this.color.fill && ctx.fill();
    }
}