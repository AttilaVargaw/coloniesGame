import { ColorComponent } from "@/engine/components/colorComponent";
import { PositionComponent } from "@/engine/components/position";
import { ThicknessComponent } from "@/engine/components/thicknessComponent";
import { ViewportSystem } from "../viewportSystem";
import { BaseRenderer } from "./baseRenderer";
import { ShapeComponent, ShapeNode } from "./shapeNode";

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

    protected getCullMargin(node: ShapeNode): number {
        return Math.max(node.width, node.height) / 2
    }

    updateNode = (node: ShapeNode, _dt?: number) => {
        const { projected } = this.getProjected(node)
        const ctx = this.viewportSystem.viewport.camera.context
        const { path } = node.shape

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
