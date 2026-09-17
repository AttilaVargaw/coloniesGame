import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { BaseRenderer } from "./baseRenderer";
import { TWO_PI } from "@/game/constants";
import { getAbsolute } from "@/engine/lib/getAbsolute";

const SHADE_SIZE = 128

const shadeSprite = (() => {
    const canvas = document.createElement("canvas")
    canvas.width = SHADE_SIZE
    canvas.height = SHADE_SIZE
    const octx = canvas.getContext("2d")!
    octx.beginPath()
    octx.arc(SHADE_SIZE / 2, SHADE_SIZE / 2, SHADE_SIZE / 2, 0, TWO_PI)
    octx.clip()

    const gradient = octx.createRadialGradient(
        SHADE_SIZE * 0.35, SHADE_SIZE * 0.35, SHADE_SIZE * 0.05,
        SHADE_SIZE * 0.5, SHADE_SIZE * 0.5, SHADE_SIZE * 0.5
    )
    gradient.addColorStop(0, "rgba(255,255,255,0.25)")
    gradient.addColorStop(0.5, "rgba(255,255,255,0.05)")
    gradient.addColorStop(1, "rgba(0,0,0,0.35)")
    octx.fillStyle = gradient
    octx.fillRect(0, 0, SHADE_SIZE, SHADE_SIZE)
    return canvas
})()

function shadeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    const size = radius * 2
    ctx.drawImage(shadeSprite, x - size / 2, y - size / 2, size, size)
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
        if (!this.engine) {
            return
        }

        const { camera } = this.viewportSystem.viewport
        const ctx = camera.context

        const [cx, cy, cz] = getAbsolute(circle.entity, this.engine)
        const radius = circle.radius.radius
        const thickness = circle.thickness.thickness

        const center = camera.project(cx, cy, cz)
        if (!center) {
            return
        }

        const screenRadius = radius * center.scale

        if (
            center.x + screenRadius < 0 ||
            center.x - screenRadius > camera.cssWidth ||
            center.y + screenRadius < 0 ||
            center.y - screenRadius > camera.cssHeight
        ) {
            return
        }

        ctx.beginPath()
        if (circle.color.shade) {
            ctx.arc(center.x, center.y, screenRadius, 0, TWO_PI)
        } else {
            const segments = Math.max(32, Math.min(128, Math.round(screenRadius / 2)))
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * TWO_PI
                const worldX = cx + radius * Math.cos(angle)
                const worldY = cy + radius * Math.sin(angle)
                const worldZ = cz
                const projected = camera.project(worldX, worldY, worldZ)
                if (!projected) {
                    continue
                }
                if (i === 0) {
                    ctx.moveTo(projected.x, projected.y)
                } else {
                    ctx.lineTo(projected.x, projected.y)
                }
            }
        }
        ctx.closePath()
        circle.setColor(ctx)
        ctx.lineWidth = thickness * center.scale
        if (circle.color.fill) {
            ctx.fill()
        }
        if (circle.color.stroke) {
            ctx.stroke()
        }

        if (circle.color.shade) {
            shadeCircle(ctx, center.x, center.y, screenRadius)
        }
    }
}
