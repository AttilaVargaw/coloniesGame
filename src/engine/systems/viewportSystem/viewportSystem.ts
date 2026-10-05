import type { Engine } from "@/engine/core/engine";
import { System, } from "../system";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { CAMERA_INITIAL_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, FIELD_OF_VIEW, TWO_PI } from "@/engine/lib/cameraConstants";
import { BaseRenderer } from "./renderers/baseRenderer";
import Camera from "@/lib/camera";
import { LabelRenderer } from "./renderers/labelRenderer";
import { ColorComponent } from "../../components/colorComponent";
import { RadiusComponent } from "../../components/radiusComponent";
import { applyColorGrading, applyVignette, applyContrastSaturation } from "./postProcess";
import { drawStarfield } from "./drawStarfield";
import { drawNebulas } from "./drawNebulas";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { WebglRenderManager } from "./renderers/webglRenderer/webGlRendererManager";
import { DebugRenderer } from "./renderers/debugRenderer";
import { PointerInteractionSystem } from "../pointerInteractionSystem";

export type RendererConstructor<T extends BaseRenderer<any>> = new (...args: any[]) => T
export class ViewportSystem extends System {
    private inputHandler!: ViewportInputHandler
    private webglRenderManager: WebglRenderManager
    private debugRenderer?: DebugRenderer
    private labelRenderer: LabelRenderer

    camera?: Camera

    constructor() {
        super()

        this.webglRenderManager = new WebglRenderManager(this)
        this.labelRenderer = new LabelRenderer(this)
    }

    get isDragging() {
        return this.inputHandler.isDragging
    }

    get isZooming() {
        return this.inputHandler.isZooming
    }

    get engineRef() {
        return this.engine
    }

    get webglManager() {
        return this.webglRenderManager
    }

    consumeDragMoved() {
        return this.inputHandler.consumeDragMoved()
    }

    private static clear(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.fillStyle = "#000008";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore()
    }

    private drawLensFlares(ctx: CanvasRenderingContext2D, camera: Camera) {
        if(!this.engine) return

        const centerX = camera.cssWidth / 2
        const centerY = camera.cssHeight / 2

        const allEntities = this.engine.getAllEntities()

        ctx.save()
        ctx.globalCompositeOperation = "screen"

        for(const entity of allEntities) {
            const color = entity.getComponent(ColorComponent)
            const radius = entity.getComponent(RadiusComponent)

            if(!color?.emitLight || !radius || radius.radius < 10) continue

            const s = getAbsolute(entity, this.engine)
            const projected = camera.project(s)
            if(!projected) continue

            const screenX = projected.x
            const screenY = projected.y

            if(
                screenX < -100 ||
                screenX > camera.cssWidth + 100 ||
                screenY < -100 ||
                screenY > camera.cssHeight + 100
            ) {
                continue
            }

            const dx = centerX - screenX
            const dy = centerY - screenY
            const dist = Math.hypot(dx, dy)

            if(dist < 5) continue

            const starColor = color.fill || "#ffffff"

            const maxT = 0.35
            const totalSteps = Math.min(5, Math.max(2, Math.floor(dist / 60)))
            for(let i = 1; i <= totalSteps; i++) {
                const t = (i / (totalSteps + 1)) * maxT
                const fx = screenX + dx * t
                const fy = screenY + dy * t
                const flareAlpha = 0.45 * (1 - t / maxT)
                const flareRadius = 1.5 + 1.5 * Math.sin((t / maxT) * Math.PI)

                ctx.globalAlpha = Math.max(0.05, flareAlpha)
                ctx.fillStyle = starColor
                ctx.beginPath()
                ctx.arc(fx, fy, flareRadius, 0, TWO_PI)
                ctx.fill()
            }

            if(dist < 300) {
                const centralAlpha = 0.18 * (1 - dist / 300)
                ctx.globalAlpha = centralAlpha
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 18)
                gradient.addColorStop(0, starColor)
                gradient.addColorStop(1, "rgba(0,0,0,0)")
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(centerX, centerY, 18, 0, TWO_PI)
                ctx.fill()
            }
        }

        ctx.restore()
    }

    private drawHoverIndicator(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const pointerSystem = this.engine.getSystem(PointerInteractionSystem)
        const projected = pointerSystem?.getHoveredProjected()
        if(!projected) return

        ctx.save()
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(projected.x, projected.y, projected.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
    }

    update(dt: number) {
        if(!this.engine || !this.camera || !this.debugRenderer) {
            return
        }

        this.camera.updateViewport()
        this.camera.updateSmoothZoom(dt)

        this.inputHandler.update(dt)
        this.debugRenderer.update(dt)

        const {
            debugflags: {
                showBloom,
                showColorGrading,
                showVignette,
                showContrastSaturation,
            }
        } = this.engine.getDebugManager()

        const { context } = this.camera

        ViewportSystem.clear(context)

        drawStarfield(context, this.camera)
        drawNebulas(context, this.camera)

        this.labelRenderer.projectNodes()
        this.labelRenderer.drawNodes(context)

        this.webglRenderManager.projectNodes()
        this.webglRenderManager.setShowBloom(showBloom)
        this.webglRenderManager.render()

        this.drawHoverIndicator(context)

        this.drawLensFlares(context, this.camera)

        if(showColorGrading) {
            applyColorGrading(context, context.canvas.width, context.canvas.height)
        }

        if(showVignette) {
            applyVignette(context, context.canvas.width, context.canvas.height)
        }

        if(showContrastSaturation) {
            applyContrastSaturation(context, context.canvas.width, context.canvas.height)
        }

        if(this.inputHandler.isRotatingWithoutTarget) {
            drawRotationIndicator(context, this.camera)
        }
        this.debugRenderer.render()
    }

    init(cameraFollowSystem?: { isFollowing(): boolean; stopFollowing(): void }) {
        this.inputHandler = new ViewportInputHandler(this, cameraFollowSystem)
        this.inputHandler.addToEngine()
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        super.addToEngine(engine)

        this.labelRenderer.addToEngine(engine)
        this.webglRenderManager.addToEngine(engine)

        this.camera = new Camera({
            initialPosition: [
                -5357.8, 4398.6, 600
            ],
            distance: CAMERA_INITIAL_DISTANCE,
            fieldOfView: FIELD_OF_VIEW,
            scaleX: 1.0,
            scaleY: 1.0,
            minDistance: CAMERA_MIN_DISTANCE,
            maxDistance: CAMERA_MAX_DISTANCE,
            yaw: 0,
            pitch: Math.PI / 3,
        }, engine.getCanvas("2d").getContext("2d")!)

        this.debugRenderer = new DebugRenderer(this)
        this.debugRenderer.addToEngine(engine)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.inputHandler.removeFromEngine()
        this.labelRenderer.removeFromEngine()

        super.removeFromEngine()

        return this
    }

}
