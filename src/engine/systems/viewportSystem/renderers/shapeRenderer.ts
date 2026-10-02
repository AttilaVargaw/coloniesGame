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

    // eslint-disable-next-line class-methods-use-this
    protected getCullMargin(node: ShapeNode): number {
        return Math.max(node.width, node.height) / 2
    }

    drawNode = (node: ShapeNode, _dt?: number, ctx?: CanvasRenderingContext2D) => {
        const { projected } = this.getProjected(node)
        const context = ctx ?? this.viewportSystem.camera.context
        const { path } = node.shape

        context.save()
        context.translate(projected.x, projected.y)
        context.scale(projected.scale, projected.scale)
        node.setColor(context);
        context.beginPath();

        for(let i = 1; i < path.length; i++) {
            context.lineTo(...path[i]);
        }

        context.closePath();
        //node.draw(context)
        context.restore()
    }
}
