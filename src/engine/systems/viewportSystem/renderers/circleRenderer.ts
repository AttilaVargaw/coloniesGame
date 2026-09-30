import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { BaseRenderer } from "./baseRenderer";
import { Entity } from "@/engine/entities/entity";
import { TWO_PI } from "@/game/constants";
import { hexToRgba } from "./hexToRgba";
import type { ProjectedPoint } from "@/lib/camera";
import Camera from "@/lib/camera";

const SHADE_SIZE = 96

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
    private _nightCanvas: HTMLCanvasElement | undefined
    private _starEntity: Entity | undefined

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, RadiusComponent, ColorComponent, ThicknessComponent, TextureComponent],
            (e) => new CircleNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent), e.getComponent(ThicknessComponent), e.getComponent(ColorComponent)?.emitLight, e.getComponent(TextureComponent))
        )
    }

    // eslint-disable-next-line class-methods-use-this
    protected getCullMargin(node: CircleNode): number {
        return node.radius.radius
    }

    private findStarEntity(): Entity | undefined {
        if(!this._starEntity && this.engine) {
            this._starEntity = this.engine.getAllEntities().find(e => {
                const color = e.getComponent(ColorComponent)
                return color?.emitLight
            })
        }
        return this._starEntity
    }

    drawNode = (circle: CircleNode, _dt?: number, ctx?: CanvasRenderingContext2D) => {
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
            CircleRenderer.drawBloom(context, circle, center, screenRadius)
        }

        CircleRenderer.buildCirclePath(context, circle, center, screenRadius, cx, cy, cz, camera)
        CircleRenderer.drawTextureFill(context, circle, center, screenRadius)

        if(circle.texture?.nightTexture && !circle.emitLight) {
            this.drawNightTexture(context, circle, center, screenRadius, cx, cy, cz, camera)
        }

        CircleRenderer.drawStrokeAndShade(context, circle, center, screenRadius, thickness)

        context.restore()
    }

    private static drawBloom(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number) {
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

    private static buildCirclePath(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number, cx: number, cy: number, cz: number, camera: Camera) {
        context.beginPath()
        if(circle.color.shade) {
            context.arc(center.x, center.y, screenRadius, 0, TWO_PI)
        } else {
            const segments = Math.max(32, Math.min(98, Math.round(screenRadius / 2)))
            for(let i = 0; i <= segments; i++) {
                const angle = (i / segments) * TWO_PI
                const worldX = cx + circle.radius.radius * Math.cos(angle)
                const worldY = cy + circle.radius.radius * Math.sin(angle)
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
    }

    private static drawTextureFill(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number) {
        if(circle.texture?.texture) {
            if(circle.color.fill) {
                circle.setColor(context)
                context.fill()
            }
            context.save()
            context.clip()
            context.drawImage(circle.texture.texture, 0, 0, circle.texture.texture.width || 96, circle.texture.texture.height || 96, center.x - screenRadius, center.y - screenRadius, screenRadius * 2, screenRadius * 2)
            context.restore()
        } else if(circle.color.fill) {
            circle.setColor(context)
            context.fill()
        }
    }

    private drawNightTexture(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number, cx: number, cy: number, cz: number, camera: Camera) {
        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }

        const starSceneNode = this.engine?.getSceneNode(starEntity)
        const starWorldPos = starSceneNode?.getWorldPosition() ?? (() => {
            const pos = starEntity.getComponent(PositionComponent)
            return pos ? [pos.x, pos.y, pos.z] : undefined
        })()

        if(!starWorldPos) {
            return
        }

        const radius = circle.radius.radius

        const lx = starWorldPos[0] - cx
        const ly = starWorldPos[1] - cy
        const lz = starWorldPos[2] - cz
        const lLen = Math.hypot(lx, ly, lz)
        if(lLen < 0.01) {
            return
        }
        const lnx = lx / lLen
        const lny = ly / lLen
        const lnz = lz / lLen

        const [camX, camY, camZ] = camera.cameraPosition
        const viewDirX = cx - camX
        const viewDirY = cy - camY
        const viewDirZ = cz - camZ
        const viewLen = Math.hypot(viewDirX, viewDirY, viewDirZ)
        if(viewLen < 0.01) {
            return
        }
        const vnx = viewDirX / viewLen
        const vny = viewDirY / viewLen
        const vnz = viewDirZ / viewLen

        if(lnx * vnx + lny * vny + lnz * vnz < 0) {
            return
        }

        const litSurface = camera.project(cx + lnx * radius, cy + lny * radius, cz + lnz * radius)
        const darkSurface = camera.project(cx - lnx * radius, cy - lny * radius, cz - lnz * radius)

        if(!litSurface || !darkSurface) {
            return
        }

        const halfSize = screenRadius
        const litLocalX = litSurface.x - (center.x - halfSize)
        const litLocalY = litSurface.y - (center.y - halfSize)
        const darkLocalX = darkSurface.x - (center.x - halfSize)
        const darkLocalY = darkSurface.y - (center.y - halfSize)

        this.drawGradientNightTexture(context, circle, center, screenRadius, litLocalX, litLocalY, darkLocalX, darkLocalY)
    }

    private drawGradientNightTexture(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number, litX: number, litY: number, darkX: number, darkY: number) {
        const size = Math.ceil(screenRadius * 2)
        if(!this._nightCanvas || this._nightCanvas.width !== size || this._nightCanvas.height !== size) {
            this._nightCanvas = document.createElement("canvas")
            this._nightCanvas.width = size
            this._nightCanvas.height = size
        }
        const nightCtx = this._nightCanvas.getContext("2d")!

        nightCtx.clearRect(0, 0, size, size)
        const texSize = circle.texture!.nightTexture!.width
        nightCtx.drawImage(circle.texture!.nightTexture!, 0, 0, texSize, texSize, 0, 0, size, size)

        nightCtx.globalCompositeOperation = "destination-out"
        const gradient = nightCtx.createLinearGradient(darkX, darkY, litX, litY)
        gradient.addColorStop(0, "rgba(0,0,0,0)")
        gradient.addColorStop(0.45, "rgba(0,0,0,0.15)")
        gradient.addColorStop(0.55, "rgba(0,0,0,0.85)")
        gradient.addColorStop(1, "rgba(0,0,0,1)")
        nightCtx.fillStyle = gradient
        nightCtx.fillRect(0, 0, size, size)

        context.save()
        context.beginPath()
        context.rect(center.x, center.y, 1, 1)
        //context.clip()
        context.drawImage(this._nightCanvas, center.x - screenRadius, center.y - screenRadius)
        context.restore()
    }

    private static drawStrokeAndShade(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number, thickness: number) {
        if(circle.color.stroke) {
            circle.setColor(context)
            context.lineWidth = thickness * center.scale
            context.stroke()
        }

        if(circle.color.shade && !circle.texture?.texture) {
            shadeCircle(context, center.x, center.y, screenRadius)
        }
    }
}
