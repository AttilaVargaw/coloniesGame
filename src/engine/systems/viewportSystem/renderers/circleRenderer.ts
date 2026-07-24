import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { isVisible } from "./isVisible";
import { BaseRenderer } from "./baseRenderer";

function shadeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,  // highlight offset
        x, y, radius
    )
    gradient.addColorStop(0, "rgba(255,255,255,0.25)")
    gradient.addColorStop(0.5, "rgba(255,255,255,0.05)")
    gradient.addColorStop(1, "rgba(0,0,0,0.35)")

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
}

export class CircleRenderer extends BaseRenderer<CircleNode> {
    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, RadiusComponent, ColorComponent],
            (e) => new CircleNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent)),
        )
    }

    protected filterNodes = (node: CircleNode) => {
        const { camera } = this.viewportSystem.viewport;
        return isVisible(camera.visibleBounds, node.radius.radius, node.entity!, this.engine!);
    };

    updateNode = (circle: CircleNode) => {
        const { camera } = this.viewportSystem.viewport;

        const ctx = camera.context

        ctx.save();
        circle.setColor(ctx);

        ctx.translate(...getAbsolute(circle.entity!, this.engine!));

        ctx.beginPath();
        ctx.arc(0, 0, circle.radius.radius, 0, Math.PI * 2);
        ctx.closePath();
        circle.draw(ctx);

        if(circle.color.shade) {
            shadeCircle(ctx, 0, 0, circle.radius.radius)
        }

        // if(circle.color.fill) {
        //     const r = circle.radius.radius
        //     const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r)
        //     gradient.addColorStop(0, circle.color.fill)
        //     gradient.addColorStop(0.6, circle.color.fill)
        //     gradient.addColorStop(1, circle.color.fill)
        //     ctx.fillStyle = gradient
        //     ctx.beginPath()
        //     ctx.arc(0, 0, r, 0, Math.PI * 2)
        //     ctx.fill()
        // }

        ctx.restore();
    }
}
