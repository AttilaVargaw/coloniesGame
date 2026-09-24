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
import { drawCameraGizmo } from "./drawCameraGizmo";
import { precomputeOrbitalTrig } from "../orbitSystem/orbitalTrig";
import { ColorComponent } from "../../components/colorComponent";
import { RadiusComponent } from "../../components/radiusComponent";

interface RenderEntry {
    renderer: BaseRenderer<any>
    node: any
    projected: ProjectedPoint
}

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
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

    private clear(ctx: CanvasRenderingContext2D) {
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

            if(!color?.shade || !radius || radius.radius < 10) continue

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

            ctx.strokeStyle = `${starColor}14`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(screenX, screenY)
            ctx.lineTo(centerX, centerY)
            ctx.stroke()

            const steps = Math.min(6, Math.max(1, Math.floor(dist / 80)))
            for(let i = 1; i <= steps; i++) {
                const t = i / (steps + 1)
                const fx = screenX + dx * t
                const fy = screenY + dy * t
                const flareAlpha = 0.25 * (1 - t) * Math.max(0, 1 - Math.abs(t - 0.3) * 2)
                const flareRadius = 2 + 2 * Math.sin(t * Math.PI)

                ctx.fillStyle = `${starColor}${Math.round(flareAlpha * 255).toString(16).padStart(2, "0")}`
                ctx.beginPath()
                ctx.arc(fx, fy, flareRadius, 0, TWO_PI)
                ctx.fill()
            }

            if(dist < 300) {
                const centralAlpha = 0.15 * (1 - dist / 300)
                const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 20)
                gradient.addColorStop(0, `${starColor}${Math.round(centralAlpha * 255).toString(16).padStart(2, "0")}`)
                gradient.addColorStop(1, "rgba(0,0,0,0)")
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(centerX, centerY, 20, 0, TWO_PI)
                ctx.fill()
            }
        }

        ctx.restore()
    }

    private scheduleRender(_dt: number) {
        if (!this.engine) {
            return
        }

        const allEntries: RenderEntry[] = []

        for (const rendererClass of this.rendererClasses) {
            const renderer = this.engine.getSystem(rendererClass as new (...args: any[]) => BaseRenderer<any>) as BaseRenderer<any> | undefined
            if (!renderer) {
                continue
            }

            renderer.projectNodes()

            for (const { node, projected } of renderer.getProjectedCacheEntries()) {
                allEntries.push({ renderer, node, projected })
            }
        }

        allEntries.sort((a, b) => b.projected.depth - a.projected.depth)

        for (const entry of allEntries) {
            entry.renderer.drawNode(entry.node, _dt)
        }
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
        if (elapsed >= 500) {
            this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed)
            this.fpsFrameCount = 0
            this.fpsLastTime = now
        }

        for(const { viewPort: { camera } } of this.nodes) {
            const ctx = camera.context
            this.clear(ctx)
            drawStarfield(ctx, camera)
            drawNebulas(ctx, camera)

            if(this.inputHandler.isRotatingWithoutTarget) {
                drawRotationIndicator(ctx, camera)
            }

            if(this.engine.getDebugManager().get("showCameraGizmo")) {
                drawCameraGizmo(ctx, camera)
            }

            if(this.engine.getDebugManager().get("drawOrbits")) {
                this.drawOrbits(ctx)
            }

            if(this.engine.getDebugManager().get("showJumpGraph")) {
                this.drawJumpGraph(ctx)
            }

            if(this.engine.getDebugManager().get("showFpsCounter")) {
                this.drawFpsCounter(ctx)
            }

            this.scheduleRender(dt)
            this.drawLensFlares(ctx, camera)
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
