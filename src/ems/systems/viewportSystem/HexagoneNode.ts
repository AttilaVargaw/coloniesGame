import { ColorComponent } from "@/ems/components/colorComponent";
import { PositionComponent } from "@/ems/components/position";
import { ShapeComponent } from "../../components/ShapeComponent";
import { RenderableNode } from "./renderableNode";
import { transverseAndSumPositionComponents } from "./transverseAndSumPositionComponents";
import { Entity } from "../../entities/entity";


export class HexagoneNode extends RenderableNode {
    constructor(entity: Entity, public position: PositionComponent, public color: ColorComponent, public shape: ShapeComponent) {
        super(position, color, entity);
    }

    render = (ctx: CanvasRenderingContext2D): void => {
        ctx.save();
        this.setColor(this.color, ctx);
        const [translatedPosX, translatedPosY] = transverseAndSumPositionComponents(this.position);

        ctx.beginPath();
        for(let i = 0; i < this.shape.sides; i++) {
            const rotation = ((Math.PI * 2) / this.shape.sides) * i;
            // const correction = 1.25 * radius
            const x = this.shape.radius * Math.sin(rotation) + translatedPosX;
            const y = this.shape.radius * Math.cos(rotation) + translatedPosY;

            (i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        this.draw(ctx);
        ctx.restore();
    }
}
