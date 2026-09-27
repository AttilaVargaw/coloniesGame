import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { OrbitNode } from "../orbitSystem/orbitNode";
import { TWO_PI } from "@/game/constants";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { MapSystem } from "@game/systems/mapSystem";
import { BaseRenderer } from "./renderers/baseRenderer";
import { ProjectedPoint } from "@/lib/camera";
import Camera from "@/lib/camera";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { drawStarfield } from "./drawStarfield";
import { drawNebulas } from "./drawNebulas";
import { drawCameraGizmo, drawCameraTarget } from "./drawCameraGizmo";
import { applyBloomLayer, applyColorGrading, applyVignette } from "./postProcess";
import { LabelRenderer } from "./renderers/labelRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { precomputeOrbitalTrig } from "../orbitSystem/orbitalTrig";
import { ColorComponent } from "../../components/colorComponent";
import { RadiusComponent } from "../../components/radiusComponent";

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

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    // eslint-disable-next-line class-methods-use-this,no-empty-function
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    private inputHandler!: ViewportInputHandler
    private fpsFrameCount = 0
    private fpsLastTime = performance.now()
    private currentFps = 0
    private rendererClasses: Array<new (...args: any[]) => BaseRenderer<any>> = []

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

    get viewport() {
        return this.nodes?.[0]?.viewPort
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

    private scheduleRender(dt: number, bloomTargetCtx?: CanvasRenderingContext2D) {
        if(!this.engine) {
            return
        }

        const allEntries: RenderEntry[] = []
        const labelEntries: RenderEntry[] = []
        const bloomEntries: RenderEntry[] = []

        for(const rendererClass of this.rendererClasses) {
            const renderer = this.engine.getSystem(rendererClass as new (...args: any[]) => BaseRenderer<any>) as BaseRenderer<any> | undefined
            if(!renderer) {
                continue
            }

            renderer.projectNodes()

            for(const { node, projected } of renderer.getProjectedCacheEntries()) {
                if(renderer instanceof LabelRenderer) {
                    labelEntries.push({ renderer, node, projected })
                } else if('emitLight' in node && (node as any).emitLight) {
                    allEntries.push({ renderer, node, projected })
                    if(bloomTargetCtx) {
                        bloomEntries.push({ renderer, node, projected })
                    }
                } else {
                    allEntries.push({ renderer, node, projected })
                }
            }
        }

        allEntries.sort((a, b) => b.projected.depth - a.projected.depth)
        bloomEntries.sort((a, b) => b.projected.depth - a.projected.depth)

        for(const entry of allEntries) {
            entry.renderer.drawNode(entry.node, dt)
        }

        if(bloomTargetCtx) {
            bloomTargetCtx.clearRect(0, 0, bloomTargetCtx.canvas.width, bloomTargetCtx.canvas.height)
            for(const entry of bloomEntries) {
                entry.renderer.drawNode(entry.node, dt, bloomTargetCtx)
            }
        }

        this.pendingLabelEntries = labelEntries
    }

    private pendingLabelEntries: RenderEntry[] = []

    private renderLabels() {
        for(const entry of this.pendingLabelEntries) {
            entry.renderer.drawNode(entry.node, 0)
        }
        this.pendingLabelEntries = []
    }

    setRendererClasses(classes: Array<new (...args: any[]) => BaseRenderer<any>>) {
        this.rendererClasses = classes
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

        const { bloomSettings, debugflags: {
            showBloom,
            showColorGrading,
            showVignette,
            drawOrbits,
            showCameraGizmo,
            showCameraTarget,
            showFpsCounter,
            showJumpGraph,
            showCullingOverlay } } = this.engine.getDebugManager()

        for(const { viewPort: { camera } } of this.nodes) {
            const ctx = camera.context

            bloomSourceCanvas = ensureCanvas(bloomSourceCanvas, ctx.canvas.width, ctx.canvas.height)
            bloomSourceCtx = bloomSourceCanvas.getContext("2d")!

            ViewportSystem.clear(ctx)
            drawStarfield(ctx, camera)
            drawNebulas(ctx, camera)

            if(drawOrbits) {
                this.drawOrbits(ctx)
            }

            this.scheduleRender(dt, bloomSourceCtx)
            this.drawLensFlares(ctx, camera)

            if(showBloom) {
                applyBloomLayer(ctx, bloomSourceCanvas, bloomSettings)
            }

            if(showColorGrading) {
                applyColorGrading(ctx, ctx.canvas.width, ctx.canvas.height)
            }

            if(showVignette) {
                applyVignette(ctx, ctx.canvas.width, ctx.canvas.height)
            }

            if(this.inputHandler.isRotatingWithoutTarget) {
                drawRotationIndicator(ctx, camera)
            }

            if(showCameraGizmo) {
                drawCameraGizmo(ctx, camera)
            }

            if(showCameraTarget) {
                drawCameraTarget(ctx, camera)
            }

            if(showJumpGraph) {
                this.drawJumpGraph(ctx)
            }

            this.renderLabels()

            if(showFpsCounter) {
                this.drawFpsCounter(ctx)
            }

            if(showCullingOverlay) {
                this.drawCullingOverlay(ctx)
            }
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

    private drawCullingOverlay(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const rectRenderer = this.engine.getSystem(RectRenderer)
        const viewport = this.viewport
        if(!rectRenderer || !viewport) return

        ctx.save()
        ctx.font = "14px monospace"
        ctx.fillStyle = "#0f0"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        const lines = [
            `Distance: ${viewport.camera.distance.toFixed(0)}`,
            `Rect projected: ${rectRenderer.projectedCount}`,
            `Rect culled: ${rectRenderer.culledCount}`,
        ]

        let y = 30
        for(const line of lines) {
            ctx.fillText(line, 10, y)
            y += 18
        }

        ctx.restore()
    }

    private drawJumpGraph(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const mapSystem = this.engine.getSystem(MapSystem)
        if(!mapSystem) return

        const graph = mapSystem.getJumpGraph()
        if(!graph) return

        const { camera } = this.viewport
        ctx.save()
        ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"
        ctx.lineWidth = 1
        //ctx.setLineDash([4, 4])

        const drawn = new Set<string>()

        for(const [source, targets] of graph.adjacency) {
            for(const target of targets) {
                const key = [source.id, target.id].sort().join("->")
                if(drawn.has(key)) continue
                drawn.add(key)

                const [sx, sy, sz] = getAbsolute(source, this.engine)
                const [tx, ty, tz] = getAbsolute(target, this.engine)

                const sourceProjected = camera.project(sx, sy, sz)
                const targetProjected = camera.project(tx, ty, tz)

                if(!sourceProjected || !targetProjected) continue

                const cssWidth = camera.cssWidth
                const cssHeight = camera.cssHeight

                const minX = Math.min(sourceProjected.x, targetProjected.x)
                const maxX = Math.max(sourceProjected.x, targetProjected.x)
                const minY = Math.min(sourceProjected.y, targetProjected.y)
                const maxY = Math.max(sourceProjected.y, targetProjected.y)

                if(
                    maxX < 0 ||
                    minX > cssWidth ||
                    maxY < 0 ||
                    minY > cssHeight
                ) {
                    continue
                }

                ctx.beginPath()
                ctx.moveTo(sourceProjected.x, sourceProjected.y)
                ctx.lineTo(targetProjected.x, targetProjected.y)
                ctx.stroke()
            }
        }

        ctx.restore()
    }

    private drawOrbits(ctx: CanvasRenderingContext2D) {
        if(!this.engine) {
            return
        }

        const { camera } = this.viewport
        ctx.save()

        ctx.strokeStyle = "rgba(100, 149, 237, 0.2)"
        ctx.lineWidth = 1

        const cssWidth = camera.cssWidth
        const cssHeight = camera.cssHeight

        for(const node of this.engine.getNodeList(OrbitNode)) {
            if(node.orbit.hideOrbitInDebugDrawing) {
                continue
            }

            const sceneNode = this.engine.getSceneNode(node.entity)
            const parentEntity = sceneNode?.parent?.entity
            if(!parentEntity) {
                continue
            }

            const [cx, cy, cz] = getAbsolute(parentEntity, this.engine)
            const orbit = node.orbit

            const center = camera.project(cx, cy, cz)
            if(!center) {
                continue
            }

            const boundingRadius = orbit.radius * (1 + orbit.eccentricity)
            const screenRadius = boundingRadius * center.scale

            if(
                center.x + screenRadius < 0 ||
                center.x - screenRadius > cssWidth ||
                center.y + screenRadius < 0 ||
                center.y - screenRadius > cssHeight
            ) {
                continue
            }

            const segments = Math.max(24, Math.round(screenRadius / 4))
            const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)
            const b = orbit.semiMinorAxis
            const focusOffset = orbit.radius * orbit.eccentricity

            const points: { x: number; y: number }[] = []
            for(let i = 0; i <= segments; i++) {
                const angle = (i / segments) * TWO_PI
                const x = orbit.radius * Math.cos(angle) - focusOffset
                const y = b * Math.sin(angle)
                const rx = x * cosA - y * sinA
                const ry = x * sinA + y * cosA
                const x1 = rx * cosL - ry * cosI * sinL
                const y1 = rx * sinL + ry * cosI * cosL
                const projected = camera.project(cx + x1, cy + y1, cz + ry * sinI)
                if(projected) points.push({ x: projected.x, y: projected.y })
            }

            if(points.length < 2) continue

            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for(let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.stroke()
        }

        ctx.restore()
    }

    registerNodes(engine: Engine) {
        engine.registerNodeType(ViewportNode,
            new Set([
                ViewportComponent
            ]),
            (entity) => new ViewportNode(
                entity.getComponent(ViewportComponent)!,
                entity
            )
        )

        return this
    }

    init() {
        this.inputHandler = new ViewportInputHandler(this, this.engine!.getSystem(CameraFollowSystem)!)
        this.inputHandler.addToEngine()
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(ViewportNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        this.inputHandler.removeFromEngine()

        this.nodes.length = 0

        super.removeFromEngine()

        return this
    }

}
