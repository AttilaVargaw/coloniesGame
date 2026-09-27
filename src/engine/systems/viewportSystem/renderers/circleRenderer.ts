import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { BaseRenderer } from "./baseRenderer";
import { TWO_PI } from "@/game/constants";
import { hexToRgba } from "./hexToRgba";

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
    gradient.addColorStop(0, "rgba(255,255,255,0.45)")
    gradient.addColorStop(0.5, "rgba(255,255,255,0.05)")
    gradient.addColorStop(1, "rgba(0,0,0,0.75)")
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
            [PositionComponent, RadiusComponent, ColorComponent, ThicknessComponent, TextureComponent],
            (e) => new CircleNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent), e.getComponent(ThicknessComponent), e.getComponent(ColorComponent)?.emitLight, e.getComponent(TextureComponent))
        )
    }

    protected getCullMargin(node: CircleNode): number {
        return node.radius.radius
    }

    updateNode = (circle: CircleNode, _dt?: number, ctx?: CanvasRenderingContext2D) => {
        if(!this.engine) {
            return
        }

        const { camera } = this.viewportSystem.viewport
        const context = ctx ?? camera.context

        const { projected: center, worldPos } = this.getProjected(circle)
        const [cx, cy, cz] = worldPos
        const radius = circle.radius.radius
        const thickness = circle.thickness.thickness

        const screenRadius = radius * center.scale

        if(
            center.x + screenRadius < 0 ||
            center.x - screenRadius > camera.cssWidth ||
            center.y + screenRadius < 0 ||
            center.y - screenRadius > camera.cssHeight
        ) {
            return
        }

        context.save()

        if(circle.emitLight) {
            const bloomRadius = screenRadius * 3
            const gradient = context.createRadialGradient(center.x, center.y, screenRadius * 0.5, center.x, center.y, bloomRadius)
            const fill = circle.color.fill || "#ffffff"
            gradient.addColorStop(0, hexToRgba(fill, 0.35))
            gradient.addColorStop(0.5, hexToRgba(fill, 0.1))
            gradient.addColorStop(1, "rgba(0,0,0,0)")
            context.globalCompositeOperation = "screen"
            context.fillStyle = gradient
            context.beginPath()
            context.arc(center.x, center.y, bloomRadius, 0, TWO_PI)
            context.fill()
            context.globalCompositeOperation = "source-over"
        }

        context.beginPath()
        if(circle.color.shade) {
            context.arc(center.x, center.y, screenRadius, 0, TWO_PI)
        } else {
            const segments = Math.max(32, Math.min(128, Math.round(screenRadius / 2)))
            for(let i = 0; i <= segments; i++) {
                const angle = (i / segments) * TWO_PI
                const worldX = cx + radius * Math.cos(angle)
                const worldY = cy + radius * Math.sin(angle)
                const worldZ = cz
                const projected = camera.project(worldX, worldY, worldZ)
                if(!projected) {
                    continue
                }
                if(i === 0) {
                    context.moveTo(projected.x, projected.y)
                } else {
                    context.lineTo(projected.x, projected.y)
                }
            }
        }
        context.closePath()

        if(circle.texture?.texture) {
            if(circle.color.fill) {
                circle.setColor(context)
                context.fill()
            }
            context.save()
            context.clip()
            context.drawImage(circle.texture.texture, 0, 0, circle.texture.texture.width || 128, circle.texture.texture.height || 128, center.x - screenRadius, center.y - screenRadius, screenRadius * 2, screenRadius * 2)
            context.restore()
        } else if(circle.color.fill) {
            circle.setColor(context)
            context.fill()
        }

        if(circle.color.stroke) {
            circle.setColor(context)
            context.lineWidth = thickness * center.scale
            context.stroke()
        }

        if(circle.color.shade) {
            shadeCircle(context, center.x, center.y, screenRadius)
        }
        context.restore()
    }
}
