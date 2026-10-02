import type { Engine } from "@/engine/core/engine";
import { System, } from "../system";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { CAMERA_INITIAL_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, FIELD_OF_VIEW, TWO_PI } from "@/game/constants";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { BaseRenderer } from "./renderers/baseRenderer";
import { ProjectedPoint } from "@/lib/camera";
import Camera from "@/lib/camera";
// import { drawRotationIndicator } from "./drawRotationIndicator";
// import { drawStarfield } from "./drawStarfield";
// import { drawNebulas } from "./drawNebulas";
// import { drawCameraGizmo, drawCameraTarget } from "./drawCameraGizmo";
// import { applyBloomLayer, applyColorGrading, applyVignette } from "./postProcess";
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

let bloomSourceCanvas: HTMLCanvasElement | null = null
let bloomSourceCtx: CanvasRenderingContext2D | null = null

function ensureCanvas(canvas: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
    if(!canvas || canvas.width !== width || canvas.height !== height) {
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        return c
    }
    return canvas
}

interface RenderEntry {
    renderer: BaseRenderer<any>
    node: any
    projected: ProjectedPoint
}

export class ViewportSystem extends System {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    private inputHandler!: ViewportInputHandler
    private fpsFrameCount = 0
    private fpsLastTime = performance.now()
    private currentFps = 0
    private frameTimeSamples: number[] = []
    private lastFrameTime = 0
    private rendererTimings = new Map<string, number>()
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

    // get viewport() {
    //     return this._viewport?.viewPort
    // }

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

    private scheduleRender(dt: number, bloomTargetCtx: CanvasRenderingContext2D) {
        if(!this.engine) {
            return
        }
        const bloomEntries: RenderEntry[] = []
        const labelEntries: RenderEntry[] = []
        const timings: Map<string, number> = new Map()
        const totalStart = performance.now()

        this.projectRenderers(timings, labelEntries, bloomEntries, bloomTargetCtx)

        bloomEntries.sort((a, b) => b.projected.depth - a.projected.depth)

        const drawStart = performance.now()

        timings.set("draw", (timings.get("draw") || 0) + (performance.now() - drawStart))

        this.finishRenderers(timings)

        const compositeStart = performance.now()

        if(bloomTargetCtx) {
            bloomTargetCtx.clearRect(0, 0, bloomTargetCtx.canvas.width, bloomTargetCtx.canvas.height)
            for(const entry of bloomEntries) {
                entry.renderer.drawNodes(entry.node, dt, bloomTargetCtx)
            }
        }
        timings.set("composite", (timings.get("composite") || 0) + (performance.now() - compositeStart))

        this.pendingLabelEntries = labelEntries
        const totalMs = performance.now() - totalStart
        this.frameTimeSamples.push(totalMs)
        if(this.frameTimeSamples.length > 60) {
            this.frameTimeSamples.shift()
        }
        this.lastFrameTime = totalMs
        this.rendererTimings = new Map(Object.entries(timings))
    }

    private projectRenderers(
        timings: Map<string, number> = new Map(),
        labelEntries: RenderEntry[],
        bloomEntries: RenderEntry[],
        bloomTargetCtx: CanvasRenderingContext2D | undefined
    ) {
        if(!this.engine) return

        for(const [key, renderer] of this.renderers.entries()) {
            const t0 = performance.now()
            if(!renderer) {
                continue
            }

            renderer.beginFrame()
            const t1 = performance.now()
            renderer.projectNodes()
            const t2 = performance.now()
            timings.set(key.name, (timings.get(key.name)!) + (t2 - t0))
            timings.set(`${name}:project`, (timings.get(`${name}:project`) || 0) + (t2 - t1))

            for(const { node, projected } of renderer.getProjectedCacheEntries()) {
                if(renderer instanceof LabelRenderer) {
                    labelEntries.push({ renderer, node, projected })
                } else if('emitLight' in node && (node as any).emitLight) {
                    if(bloomTargetCtx) {
                        bloomEntries.push({ renderer, node, projected })
                    }
                }
            }
        }
    }

    private finishRenderers(timings: Map<string, number>) {
        if(!this.engine) return

        for(const [key, renderer] of this.renderers.entries()) {
            const name = key.name
            const t0 = performance.now()
            renderer?.endFrame()
            timings.set(`${name}:end`, (timings.get(`${name}:end`) || 0) + (performance.now() - t0))
        }
    }

    private pendingLabelEntries: RenderEntry[] = []

    // private renderLabels() {
    //     if(!this.engine || !this.viewport) { return }

    //     const canvas = this.viewport.camera.context

    //     for(const entry of this.pendingLabelEntries) {
    //         entry.renderer.drawNode(entry.node, 0, canvas)
    //     }

    //     this.pendingLabelEntries = []
    // }

    setRendererClasses(args: (new (...args: any[]) => BaseRenderer<any>)[]) {
        if(!this.engine) {
            return
        }

        this.renderers = args.reduce((prev, curr) => {
            const renderer = new curr(this)
            prev.set(curr, renderer)
            renderer?.addToEngine?.(this.engine!)
            //renderer?.init?.()

            return prev
        }, new Map())
    }

    clearWebgl() {
        if(!this.engine) {
            return
        }

        const gl = this.engine.getCanvas("webgl2").getContext("webgl2")

        if(!gl) {
            return
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
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
        bloomSourceCtx = bloomSourceCanvas.getContext("2d")!

        ViewportSystem.clear(context)
        //     this.clearWebgl()

        drawStarfield(context, this.camera)
        drawNebulas(context, this.camera)

        if(isDrawOrbit) {
            drawOrbits(context, this.engine, this.camera)
        }

        this.scheduleRender(dt, bloomSourceCtx)

        this.renderers.entries().forEach(([_key, renderer]) => {
            renderer.beginFrame()
        })

        this.drawLensFlares(context, this.camera)

        if(showBloom) {
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
        if(this.rendererTimings.size) {
            y += 18
            ctx.font = "12px monospace"
            ctx.fillStyle = "#aaa"
            for(const [key, ms] of this.rendererTimings) {
                ctx.fillText(`${key}: ${ms.toFixed(2)}ms`, 64, y)
                y += 14
            }
        }
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

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.inputHandler.removeFromEngine()

        super.removeFromEngine()

        return this
    }

}
