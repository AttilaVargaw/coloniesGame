import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { BaseRenderer } from "./baseRenderer";
import { TWO_PI } from "@/game/constants";

function shadeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        x, y, radius
    )
    gradient.addColorStop(0, "rgba(255,255,255,0.25)")
    gradient.addColorStop(0.5, "rgba(255,255,255,0.05)")
    gradient.addColorStop(1, "rgba(0,0,0,0.35)")

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TWO_PI)
    ctx.fill()
}

export class CircleRenderer extends BaseRenderer<CircleNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, RadiusComponent, ColorComponent, ThicknessComponent],
            (e) => new CircleNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent), e.getComponent(ThicknessComponent)),
        )
    }

    protected getCullMargin(node: CircleNode): number {
        return node.radius.radius
    }

    updateNode = (circle: CircleNode, _dt?: number) => {
        const { projected } = this.getProjected(circle)
        const ctx = this.viewportSystem.viewport.camera.context

        circle.setColor(ctx);
        ctx.lineWidth = circle.thickness.thickness * projected.scale

        const screenRadius = circle.radius.radius * projected.scale

        ctx.beginPath();
        ctx.arc(projected.x, projected.y, screenRadius, 0, TWO_PI);
        ctx.closePath();
        circle.draw(ctx);

        if(circle.color.shade) {
            shadeCircle(ctx, projected.x, projected.y, screenRadius)
        }
    }
}
