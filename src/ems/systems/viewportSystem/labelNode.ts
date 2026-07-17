import { LabelComponent } from "../../components/label";
import { PositionComponent } from "../../components/position";
import { Entity } from "../../entities/entity";
import { RenderableNode } from "./renderableNode";
import { transverseAndSumPositionComponents } from "./transverseAndSumPositionComponents";

export class LabelNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public label: LabelComponent) {
        super(position, label.color, entity);
    }

    render = (ctx: CanvasRenderingContext2D): void => {
        ctx.save();
        this.setColor(this.label.color, ctx);
        ctx.translate(...transverseAndSumPositionComponents(this.position));
        ctx.font = `${this.label.size}px Roboto`;
        ctx.fillText(this.label.text, 24, 0);
        //this.draw(ctx);
        ctx.restore();
    }
}
