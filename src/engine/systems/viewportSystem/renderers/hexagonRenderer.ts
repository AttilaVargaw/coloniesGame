import { PositionComponent } from "../../../components/position";
import { ShapeComponent } from "../../../components/ShapeComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { HexagoneNode } from "./HexagonNode";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { isVisible } from "./isVisible";
import { BaseRenderer } from "./baseRenderer";

const HEXAGON_SIDES = 6;
const PIThird = Math.PI / 3;

export class HexagonRenderer extends BaseRenderer<HexagoneNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ShapeComponent, ColorComponent],
            (e) => new HexagoneNode(e, e.getComponent(PositionComponent)!, e.getComponent(ColorComponent)!, e.getComponent(ShapeComponent)!),
        )
    }

    protected filterNodes = (node: HexagoneNode) => {
        const { camera } = this.viewportSystem.viewport;
        return isVisible(camera.visibleBounds, node.hexagon.radius, node.entity!, this.engine!);
    };

    protected updateNode(shape: HexagoneNode, _dt?: number): void {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context

        ctx.save();
        shape.setColor(ctx);
        const [translatedPosX, translatedPosY] = getAbsolute(shape.entity!, this.engine!)

        ctx.beginPath();
        for(let i = 0; i < HEXAGON_SIDES; i++) {
            const rotation = PIThird * i;
            const { radius } = shape.hexagon;

            const x = radius * Math.sin(rotation) + translatedPosX;
            const y = radius * Math.cos(rotation) + translatedPosY;

            if(i === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        }
        ctx.closePath();
        shape.draw(ctx);
        ctx.restore();
    }
}
