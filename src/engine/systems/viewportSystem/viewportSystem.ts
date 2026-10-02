import type { Engine } from "@/engine/core/engine";
import { System, } from "../system";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { CAMERA_INITIAL_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, FIELD_OF_VIEW, TWO_PI } from "@/game/constants";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { BaseRenderer } from "./renderers/baseRenderer";
import Camera from "@/lib/camera";
import { LabelRenderer } from "./renderers/labelRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { ColorComponent } from "../../components/colorComponent";
import { RadiusComponent } from "../../components/radiusComponent";
import { RenderableNode } from "./renderers/renderableNode";
import { drawCameraGizmo, drawCameraTarget } from "./drawCameraGizmo";
import { applyBloomLayer, applyColorGrading, applyVignette } from "./postProcess";
import { drawStarfield } from "./drawStarfield";
import { drawNebulas } from "./drawNebulas";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { WebglRenderManager } from "./renderers/webglRenderer/webGlRendererManager";
import { drawOrbits } from "./renderOrbits";
import { drawJumpGraph } from "./renderers/drawJumpGraph";
import { ShapeRenderer } from "./renderers/shapeRenderer";

let bloomSourceCanvas: HTMLCanvasElement | null = null

function ensureCanvas(canvas: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
    if(!canvas || canvas.width !== width || canvas.height !== height) {
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        return c
    }
    return canvas
}
export class ViewportSystem extends System {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    private inputHandler!: ViewportInputHandler
    private fpsFrameCount = 0
    private fpsLastTime = performance.now()
    private currentFps = 0
    private frameTimeSamples: number[] = []
    private renderers: Map<new (...args: any[]) => BaseRenderer<any>, BaseRenderer<RenderableNode>> = new Map()
    private webglRenderManager: WebglRenderManager

    camera: Camera

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

        this.inputHandler.update(dt)
        this.fpsFrameCount++
        const now = performance.now()
        const elapsed = now - this.fpsLastTime
        if(elapsed >= 500) {
            this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed)
            this.fpsFrameCount = 0
            this.fpsLastTime = now
        }

        const {
            bloomSettings,
            debugflags: {
                showBloom,
                showColorGrading,
                showVignette,
                drawOrbits: isDrawOrbit,
                showCameraGizmo,
                showCameraTarget,
                showFpsCounter,
                showJumpGraph,
                showCullingOverlay,
                showFrameTime }
        } = this.engine.getDebugManager()

        const { context } = this.camera


        bloomSourceCanvas = ensureCanvas(bloomSourceCanvas, context.canvas.width, context.canvas.height)
        const bloomCtx = bloomSourceCanvas.getContext("2d")!
        bloomCtx.clearRect(0, 0, bloomSourceCanvas.width, bloomSourceCanvas.height)

        ViewportSystem.clear(context)
        //     this.clearWebgl()

        drawStarfield(context, this.camera)
        drawNebulas(context, this.camera)

        if(isDrawOrbit) {
            drawOrbits(context, this.engine, this.camera)
        }

        // this.scheduleRender(bloomSourceCtx)

        this.renderers.entries().forEach(([_key, renderer]) => {
            renderer.beginFrame()
            renderer.projectNodes()
            renderer.drawNodes(context)
            renderer.endFrame()
        })

        this.webglRenderManager.projectNodes()
        this.webglRenderManager.render()

        this.drawLensFlares(context, this.camera)

        if(showBloom) {
            this.drawBloomSource(bloomCtx, this.camera)
            applyBloomLayer(context, bloomSourceCanvas, bloomSettings)
        }

        if(showColorGrading) {
            applyColorGrading(context, context.canvas.width, context.canvas.height)
        }

        if(showVignette) {
            applyVignette(context, context.canvas.width, context.canvas.height)
        }

        if(this.inputHandler.isRotatingWithoutTarget) {
            drawRotationIndicator(context, this.camera)
        }

        if(showCameraGizmo) {
            drawCameraGizmo(context, this.camera)
        }

        if(showCameraTarget) {
            drawCameraTarget(context, this.camera)
        }

        if(showJumpGraph) {
            drawJumpGraph(context, this.engine, this.camera)
        }

        //this.renderLabels()

        if(showFpsCounter) {
            this.drawFpsCounter(context)
        }

        if(showFrameTime) {
            this.drawFrameTime(this.camera.context)
        }

        if(showCullingOverlay) {
            this.drawCullingOverlay(context)
        }
    }

    private drawFpsCounter(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.font = "16px monospace"
        ctx.fillStyle = "#0f0"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`FPS: ${this.currentFps}`, 10, 10)
        ctx.restore()
    }

    private drawFrameTime(ctx: CanvasRenderingContext2D) {
        if(!this.frameTimeSamples.length) return
        const showFps = this.engine?.getDebugManager().debugflags.showFpsCounter ?? false
        const avg = this.frameTimeSamples.reduce((a, b) => a + b, 0) / this.frameTimeSamples.length
        const max = Math.max(...this.frameTimeSamples)
        ctx.save()
        ctx.font = "14px monospace"
        ctx.fillStyle = "#0ff"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        let y = showFps ? 32 : 10
        ctx.fillText(`Frame: ${avg.toFixed(1)}ms (${(1000 / Math.max(1, avg)).toFixed(0)}fps) max ${max.toFixed(1)}ms`, 64, y)
        ctx.restore()
    }

    private drawCullingOverlay(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const rectRenderer = this.renderers.get(RectRenderer)
        //const viewport = this.viewport
        if(!rectRenderer) return

        ctx.save()
        ctx.font = "14px monospace"
        ctx.fillStyle = "#0f0"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        const lines = [
            `Distance: ${this.camera.distance.toFixed(0)}`,
            `Rect projected: ${rectRenderer.projectedCount}`,
            `Rect culled: ${rectRenderer.culledCount}`,
        ] as const

        let y = 30
        for(const line of lines) {
            ctx.fillText(line, 10, y)
            y += 18
        }

        ctx.restore()
    }

    init() {
        this.inputHandler = new ViewportInputHandler(this, this.engine!.getSystem(CameraFollowSystem)!)
        this.inputHandler.addToEngine()
    }

    addToEngine(engine: Engine): this {
        this.engine = engine
        super.addToEngine(engine)

        this.renderers = [
            ShapeRenderer,
            LabelRenderer
        ].reduce((prev, curr) => {
            const renderer = new curr(this)

            prev.set(curr, renderer)

            renderer.addToEngine(this.engine!)
            renderer.init?.()

            return prev
        }, new Map())

        this.webglRenderManager.addToEngine(engine)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.inputHandler.removeFromEngine()

        for(const renderer of this.renderers.values()) {
            renderer.removeFromEngine()
        }

        super.removeFromEngine()

        return this
    }

}
