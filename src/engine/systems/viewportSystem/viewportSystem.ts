import type { Engine } from "@/engine/core/engine";
import { System, } from "../system";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { CAMERA_INITIAL_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, FIELD_OF_VIEW, TWO_PI } from "@/engine/lib/cameraConstants";
import { getPlatform } from "@/engine/lib/platform";
import { BaseRenderer } from "./renderers/baseRenderer";
import Camera from "@/lib/camera";
import { LabelRenderer } from "./renderers/labelRenderer";
import { ColorComponent } from "../../components/colorComponent";
import { RadiusComponent } from "../../components/radiusComponent";
import { RenderableNode } from "./renderers/renderableNode";
import { applyBloomLayer, applyColorGrading, applyVignette, applyContrastSaturation } from "./postProcess";
import { drawStarfield } from "./drawStarfield";
import { drawNebulas } from "./drawNebulas";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { WebglRenderManager } from "./renderers/webglRenderer/webGlRendererManager";
import { DebugRenderer } from "./renderers/debugRenderer";
import { PointerInteractionSystem } from "../pointerInteractionSystem";

let bloomSourceCanvas: HTMLCanvasElement | null = null

function ensureCanvas(canvas: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
    if(!canvas || canvas.width !== width || canvas.height !== height) {
        const c = getPlatform().createCanvas()
        c.width = width
        c.height = height
        return c
    }
    return canvas
}

export type RendererConstructor<T extends BaseRenderer<any>> = new (...args: any[]) => T
export class ViewportSystem extends System {
    private inputHandler!: ViewportInputHandler
    private _renderers: Map<RendererConstructor<any>, BaseRenderer<RenderableNode>> = new Map()
    private webglRenderManager: WebglRenderManager
    private debugRenderer: DebugRenderer

    camera: Camera

    renderers<T extends RendererConstructor<any>>(key: T): InstanceType<T> {
        return this._renderers.get(key)! as InstanceType<T>
    }

    constructor(canvasContext: CanvasRenderingContext2D) {
        super()
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
            yaw: 1.15,
            pitch: 0.8,
        }, canvasContext)

        this.webglRenderManager = new WebglRenderManager(this)
        this.debugRenderer = new DebugRenderer(this)
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

            const [sx, sy, sz] = getAbsolute(entity, this.engine)
            const projected = camera.project(sx, sy, sz)
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

    private drawNightBloom(bloomCtx: CanvasRenderingContext2D, bloom: { pixels: Uint8Array; width: number; height: number }): void {
        const tempCanvas = getPlatform().createCanvas()
        tempCanvas.width = bloom.width
        tempCanvas.height = bloom.height
        const tempCtx = tempCanvas.getContext("2d")!
        const imageData = tempCtx.createImageData(bloom.width, bloom.height)
        imageData.data.set(bloom.pixels)
        tempCtx.putImageData(imageData, 0, 0)

        bloomCtx.save()
        bloomCtx.globalCompositeOperation = "screen"
        bloomCtx.globalAlpha = 1
        bloomCtx.drawImage(tempCanvas, 0, 0, bloomCtx.canvas.width, bloomCtx.canvas.height)
        bloomCtx.restore()
    }

    private drawBloomSource(ctx: CanvasRenderingContext2D, camera: Camera) {
        if(!this.engine) return

        const allEntities = this.engine.getAllEntities()

        ctx.save()
        ctx.globalCompositeOperation = "source-over"

        for(const entity of allEntities) {
            const color = entity.getComponent(ColorComponent)
            const radius = entity.getComponent(RadiusComponent)

            if(!color?.emitLight || !radius || radius.radius < 10) continue

            const [sx, sy, sz] = getAbsolute(entity, this.engine)
            const projected = camera.project(sx, sy, sz)
            if(!projected) continue

            const screenX = projected.x
            const screenY = projected.y
            const screenRadius = radius.radius * projected.scale

            if(
                screenX + screenRadius * 3 < 0 ||
                screenX - screenRadius * 3 > camera.cssWidth ||
                screenY + screenRadius * 3 < 0 ||
                screenY - screenRadius * 3 > camera.cssHeight
            ) {
                continue
            }

            const fill = color.fill || "#ffffff"
            const r = parseInt(fill.slice(1, 3), 16) / 255
            const g = parseInt(fill.slice(3, 5), 16) / 255
            const b = parseInt(fill.slice(5, 7), 16) / 255

            const bloomRadius = screenRadius * 3
            const gradient = ctx.createRadialGradient(screenX, screenY, screenRadius * 0.5, screenX, screenY, bloomRadius)
            gradient.addColorStop(0, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.35)`)
            gradient.addColorStop(0.5, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.1)`)
            gradient.addColorStop(1, "rgba(0,0,0,0)")
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(screenX, screenY, bloomRadius, 0, TWO_PI)
            ctx.fill()
        }

        ctx.restore()
    }

    update(dt: number) {
        if(!this.engine) {
            return
        }

        this.camera.updateViewport()
        this.camera.updateSmoothZoom(dt)

        this.inputHandler.update(dt)
        this.debugRenderer.update(dt)

        const {
            bloomSettings,
            debugflags: {
                showBloom,
                showColorGrading,
                showVignette,
                showContrastSaturation,
            }
        } = this.engine.getDebugManager()

        const { context } = this.camera

        bloomSourceCanvas = ensureCanvas(bloomSourceCanvas, context.canvas.width, context.canvas.height)
        const bloomCtx = bloomSourceCanvas.getContext("2d")!
        bloomCtx.clearRect(0, 0, bloomSourceCanvas.width, bloomSourceCanvas.height)

        ViewportSystem.clear(context)

        drawStarfield(context, this.camera)
        drawNebulas(context, this.camera)

        this.debugRenderer.render()
        this._renderers.entries().forEach(([_key, renderer]) => {
            renderer.beginFrame()
            renderer.projectNodes()
            renderer.drawNodes(context)
            renderer.endFrame()
        })

        this.webglRenderManager.projectNodes()
        this.webglRenderManager.render()

        this.drawHoverIndicator(context)

        this.drawLensFlares(context, this.camera)

        if(showBloom) {
            this.drawBloomSource(bloomCtx, this.camera)
            const nightBloom = this.webglRenderManager.getBloomPixels()
            if(nightBloom) {
                this.drawNightBloom(bloomCtx, nightBloom)
            }
            applyBloomLayer(context, bloomSourceCanvas, bloomSettings)
        }

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
    }

    init(cameraFollowSystem?: { isFollowing(): boolean; stopFollowing(): void }) {
        this.inputHandler = new ViewportInputHandler(this, cameraFollowSystem)
        this.inputHandler.addToEngine()
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        super.addToEngine(engine)

        this._renderers = [
            LabelRenderer
        ].reduce((prev, curr) => {
            const renderer = new curr(this)

            prev.set(curr, renderer)

            renderer.addToEngine(this.engine!)
            renderer.init?.()

            return prev
        }, new Map())

        this.webglRenderManager.addToEngine(engine)
        this.debugRenderer.addToEngine(engine)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.inputHandler.removeFromEngine()

        for(const renderer of this._renderers.values()) {
            renderer.removeFromEngine()
        }

        super.removeFromEngine()

        return this
    }

}
