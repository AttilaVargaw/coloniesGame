import { ColorComponent } from "@/engine/components/colorComponent";
import { PositionComponent } from "@/engine/components/position";
import { ThicknessComponent } from "@/engine/components/thicknessComponent";
import { ViewportSystem } from "../viewportSystem";
import { BaseRenderer } from "./baseRenderer";
import { isVisible } from "./isVisible";
import { ShapeComponent, ShapeNode } from "./shapeNode";
import { getAbsolute } from "@/engine/lib/getAbsolute";

export class ShapeRenderer extends BaseRenderer<ShapeNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, ColorComponent, ThicknessComponent, ShapeComponent],
            (e) => new ShapeNode(e,
                e.getComponent(PositionComponent)!,
                e.getComponent(ColorComponent)!,
                e.getComponent(ThicknessComponent)!,
                e.getComponent(ShapeComponent)!,
            ))
    }

    protected filterNodes = (node: ShapeNode) => {
        const { camera } = this.viewportSystem.viewport;
        return isVisible(camera.visibleBounds, Math.max(node.width, node.height) / 2, node.entity!, this.engine!);
        //return true;
    };

    updateNode = (node: ShapeNode) => {
        const { shape: { path }, entity } = node;
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context

        const [wx, wy, wz] = getAbsolute(entity, this.engine!);
        const projected = camera.project(wx, wy, wz)
        if (!projected) {
            return
        }

        ctx.save()
        ctx.translate(projected.x, projected.y)
        ctx.scale(projected.scale, projected.scale)
        node.setColor(ctx);
        ctx.beginPath();

        for(let i = 1; i < path.length; i++) {
            ctx.lineTo(...path[i]);
        }

        ctx.closePath();
        node.draw(ctx)
        ctx.restore()
    }
}