import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { JumpGraphSystem } from "@game/systems/jumpGraphSystem";
import { OrbitNode } from "../orbitSystem/orbitNode";
import { TWO_PI } from "@/game/constants";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { drawStarfield } from "./drawStarfield";
import { drawNebulas } from "./drawNebulas";
import { drawCameraGizmo } from "./drawCameraGizmo";
import { precomputeOrbitalTrig } from "../orbitSystem/orbitalTrig";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    private inputHandler!: ViewportInputHandler
    private fpsFrameCount = 0
    private fpsLastTime = performance.now()
    private currentFps = 0

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

        const jumpGraphSystem = this.engine.getSystem(JumpGraphSystem)
        if(!jumpGraphSystem) return

        const graph = jumpGraphSystem['graph']
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
