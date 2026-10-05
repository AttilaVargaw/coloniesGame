import { PositionComponent } from "../../../components/position";
import { RadiusComponent } from "../../../components/radiusComponent";
import { ColorComponent } from "../../../components/colorComponent";
import { ThicknessComponent } from "../../../components/thicknessComponent";
import { TextureComponent } from "../../../components/textureComponent";
import { ViewportSystem } from "../viewportSystem";
import { CircleNode } from "./circleNode";
import { BaseRenderer } from "./baseRenderer";
import { Entity } from "@/engine/entities/entity";
import { TWO_PI } from "@/engine/lib/cameraConstants";
import { getPlatform } from "@/engine/lib/platform";
import type { ProjectedPoint } from "@/lib/camera";
import Camera from "@/lib/camera";
import type { vec3 } from "gl-matrix";
import { AsteroidBeltComponent } from "@/engine/components/asteroidBeltComponent";

export class CircleRenderer extends BaseRenderer<CircleNode> {
    beginFrame(): void {
    }
    endFrame(): void {
    }
    drawNodes(_ctx: CanvasRenderingContext2D): void {
    }
    protected shouldCullNode(_node: CircleNode, _projected: ProjectedPoint, _worldPos: vec3): boolean {
        return false
    }
    protected shouldSkipProjection(node: CircleNode, cameraDistance: number, _cameraScale: number): boolean {
        const belt = node.entity.getComponent(AsteroidBeltComponent)
        if(belt?.cullingDistanceThreshold !== undefined && cameraDistance > belt.cullingDistanceThreshold) {
            return true
        }
        return false
    }
    protected getCullMargin(node: CircleNode): number {
        return node.radius.radius
    }

    private _nightCanvas: HTMLCanvasElement | undefined

    constructor(viewportSystem: ViewportSystem) {
        super(viewportSystem,
            [PositionComponent, RadiusComponent, ColorComponent, ThicknessComponent, TextureComponent],
            (e) => new CircleNode(e, e.getComponent(PositionComponent)!, e.getComponent(RadiusComponent)!, e.getComponent(ColorComponent), e.getComponent(ThicknessComponent), e.getComponent(ColorComponent)?.emitLight, e.getComponent(TextureComponent))
        )
    }

    private findStarEntityForPlanet(planetEntity: Entity): Entity | undefined {
        if(!this.engine) return undefined

        let current: Entity | undefined = planetEntity
        while(current) {
            const sceneNode = this.engine.getSceneNode(current)
            if(sceneNode?.parent) {
                current = sceneNode.parent.entity
            } else {
                break
            }

            const color = current.getComponent(ColorComponent)
            if(color?.emitLight) {
                return current
            }
        }

        return undefined
    }

    drawNode = (ctx: CanvasRenderingContext2D) => {
        if(!this.engine || !this.viewportSystem.camera) {
            return
        }

        const { camera } = this.viewportSystem
        const context = ctx ?? camera.context

        for(const circle of this.nodes) {
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

            CircleRenderer.buildCirclePath(context, circle, center, screenRadius, cx, cy, cz, camera)
            CircleRenderer.drawTextureFill(context, circle, center, screenRadius)

            if(circle.texture?.night && !circle.emitLight) {
                this.drawNightTexture(context, circle, center, screenRadius, cx, cy, cz, camera)
            }

            CircleRenderer.drawStrokeAndShade(context, circle, center, screenRadius, thickness)

            if(circle.emitLight) {
                CircleRenderer.drawSpikes(context, center, screenRadius)
            }
        }

        context.restore()
    }

    private static drawSpikes(context: CanvasRenderingContext2D, center: ProjectedPoint, screenRadius: number) {
        if(screenRadius > 2) {
            const len = screenRadius * 6
            context.lineWidth = Math.max(1.5, screenRadius * 0.1)
            context.strokeStyle = "rgba(255,255,255,0.85)"
            context.beginPath()
            context.moveTo(center.x - len, center.y)
            context.lineTo(center.x + len, center.y)
            context.moveTo(center.x, center.y - len)
            context.lineTo(center.x, center.y + len)
            context.stroke()
        }
    }

    private static buildCirclePath(context: CanvasRenderingContext2D, circle: CircleNode, _center: ProjectedPoint, screenRadius: number, cx: number, cy: number, cz: number, camera: Camera) {
        context.beginPath()
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
        context.closePath()
    }

    private static drawTextureFill(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number) {
        if(circle.texture?.day) {
            if(circle.color.fill) {
                circle.setColor(context)
                context.fill()
            }
            context.save()
            context.clip()
            const rotation = circle.texture.rotation ?? 0
            if(rotation !== 0) {
                context.translate(center.x, center.y)
                context.rotate(rotation)
                context.drawImage(circle.texture.day, 0, 0, circle.texture.day.width || 96, circle.texture.day.height || 96, -screenRadius, -screenRadius, screenRadius * 2, screenRadius * 2)
            } else {
                context.drawImage(circle.texture.day, 0, 0, circle.texture.day.width || 96, circle.texture.day.height || 96, center.x - screenRadius, center.y - screenRadius, screenRadius * 2, screenRadius * 2)
            }
            context.restore()
        } else if(circle.color.fill) {
            circle.setColor(context)
            context.fill()
        }
    }

    private drawNightTexture(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, screenRadius: number, cx: number, cy: number, cz: number, camera: Camera) {
        const starEntity = this.findStarEntityForPlanet(circle.entity)
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
        const dpr = context.canvas.width / context.canvas.clientWidth
        const size = Math.ceil(screenRadius * 2 * dpr)
        if(!this._nightCanvas || this._nightCanvas.width !== size || this._nightCanvas.height !== size) {
            this._nightCanvas = getPlatform().createCanvas()
            this._nightCanvas.width = size
            this._nightCanvas.height = size
        }
        const nightCtx = this._nightCanvas.getContext("2d")!

        nightCtx.clearRect(0, 0, size, size)
        const texSize = circle.texture!.night!.width
        nightCtx.drawImage(circle.texture!.night!, 0, 0, texSize, texSize, 0, 0, size, size)

        nightCtx.globalCompositeOperation = "destination-out"
        const gradient = nightCtx.createLinearGradient(darkX * dpr, darkY * dpr, litX * dpr, litY * dpr)
        gradient.addColorStop(0, "rgba(0,0,0,0)")
        gradient.addColorStop(0.45, "rgba(0,0,0,0.15)")
        gradient.addColorStop(0.55, "rgba(0,0,0,0.85)")
        gradient.addColorStop(1, "rgba(0,0,0,1)")
        nightCtx.fillStyle = gradient
        nightCtx.fillRect(0, 0, size, size)

        context.save()
        context.clip()
        context.drawImage(this._nightCanvas, center.x - screenRadius, center.y - screenRadius, screenRadius * 2, screenRadius * 2)
        context.restore()
    }

    private static drawStrokeAndShade(context: CanvasRenderingContext2D, circle: CircleNode, center: ProjectedPoint, _screenRadius: number, thickness: number) {
        if(circle.color.stroke) {
            circle.setColor(context)
            context.lineWidth = thickness * center.scale
            context.stroke()
        }
    }
}
