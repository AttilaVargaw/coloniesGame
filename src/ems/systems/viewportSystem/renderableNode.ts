import { ColorComponent } from "@/ems/components/colorComponent";
import { PositionNode } from "./positionNode";
import { PositionComponent } from "@/ems/components/position";
import { Entity } from "@/ems/entities/entity";


export class RenderableNode extends PositionNode {
    constructor(position: PositionComponent, public color: ColorComponent, entity?: Entity) {
        super(position, undefined, entity);
    }

    setColor({ fill, stroke }: ColorComponent, ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = fill ?? "";
        ctx.strokeStyle = stroke ?? "";
    }

    render = (_ctx: CanvasRenderingContext2D): void => undefined

    draw(ctx: CanvasRenderingContext2D) {
        this.color.stroke && ctx.stroke();
        this.color.fill && ctx.fill();
    }
}