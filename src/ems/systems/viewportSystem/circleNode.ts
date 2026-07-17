import { RadiusComponent } from "../../components/radiusComponent";
import { ColorComponent } from "../../components/colorComponent";
import { PositionComponent } from "../../components/position";
import { Entity } from "../../entities/entity";
import { RenderableNode } from "./renderableNode";
import { transverseAndSumPositionComponents } from "./transverseAndSumPositionComponents";

export class CircleNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public radius: RadiusComponent, public color: ColorComponent = new ColorComponent("red")) {
        super(position, color, entity);
    }

    render = (ctx: CanvasRenderingContext2D) => {
        ctx.save();
        this.setColor(this.color, ctx);
        ctx.translate(...transverseAndSumPositionComponents(this.position));
        ctx.beginPath();
        ctx.arc(0, 0, this.radius.radius, 0, Math.PI * 2);
        ctx.closePath();
        this.draw(ctx);
        ctx.restore();
    }
}