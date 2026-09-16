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

        const [wx, wy, wz] = getAbsolute(shape.entity!, this.engine!)
        const projected = camera.project(wx, wy, wz)
        if (!projected) {
            return
        }

        ctx.save()
        shape.setColor(ctx);
        const screenRadius = shape.hexagon.radius * projected.scale

        ctx.beginPath();
        for(let i = 0; i < HEXAGON_SIDES; i++) {
            const rotation = PIThird * i;

            const x = screenRadius * Math.sin(rotation) + projected.x;
            const y = screenRadius * Math.cos(rotation) + projected.y;

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
