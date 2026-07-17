import { PositionComponent } from "../../components/position";
import { SizeComponent } from "../../components/sizeComponent";
import { Entity } from "../../entities/entity";
import { ColorComponent } from "../../components/colorComponent";
import { transverseAndSumPositionComponents } from "./transverseAndSumPositionComponents";
import { RenderableNode } from "./renderableNode";

export class RectNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public size: SizeComponent, public color: ColorComponent = new ColorComponent("red")) {
        super(position, color, entity);
    }

    render = (ctx: CanvasRenderingContext2D): void => {
        ctx.save();
        this.setColor(this.color, ctx);
        ctx.translate(...transverseAndSumPositionComponents(this.position));
        ctx.fillRect(-this.size.width / 2, -this.size.height / 2, this.size.width, this.size.height);
        this.draw(ctx)
        ctx.restore();
    }
}
