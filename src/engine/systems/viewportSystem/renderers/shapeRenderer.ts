import { ColorComponent } from "@/engine/components/colorComponent";
import { PositionComponent } from "@/engine/components/position";
import { ThicknessComponent } from "@/engine/components/thicknessComponent";
import { ViewportSystem } from "../viewportSystem";
import { BaseRenderer } from "./baseRenderer";
import { ShapeComponent, ShapeNode } from "./shapeNode";
import { ProjectedPoint } from "@/lib/camera";
import { Vector3 } from "@/lib/Vector3";

export class ShapeRenderer extends BaseRenderer<ShapeNode> {
    beginFrame(): void {
    }
    endFrame(): void {
    }
    shouldCullNode(_node: ShapeNode, _projected: ProjectedPoint, _worldPos: Vector3): boolean {
        return false
    }
    shouldSkipProjection(_node: ShapeNode, _cameraScale: number): boolean {
        return false
    }
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
    getCullMargin(node: ShapeNode): number {
        return Math.max(node.width, node.height) / 2
    }

    drawNodes = (context: CanvasRenderingContext2D) => {
        for(const { node, projected } of this.getProjectedCacheEntries()) {
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
}
