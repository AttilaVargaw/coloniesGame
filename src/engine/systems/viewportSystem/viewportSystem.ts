import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { Entity } from "@engine/entities/entity";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { DEBUG_VISUALIZE_PATHS } from "@game/systems/moveSystem";
import { OrbitNode } from "../orbitSystem/orbitNode";
import { TWO_PI } from "@/game/constants";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { drawRotationIndicator } from "./drawRotationIndicator";
import { drawStarfield } from "./drawStarfield";
import { precomputeOrbitalTrig } from "../orbitSystem/orbitalTrig";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    private readonly eventHandlers: Set<Entity> = new Set()
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    private inputHandler!: ViewportInputHandler

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

        for(const { viewPort: { camera } } of this.nodes) {
            const ctx = camera.context
            this.clear(ctx)
            drawStarfield(ctx, camera)

            if(this.inputHandler.isRotatingWithoutTarget) {
                drawRotationIndicator(ctx, camera)
            }

            if(DEBUG_VISUALIZE_PATHS) {
                this.drawOrbits(ctx)
            }
        }
    }

    private drawOrbits(ctx: CanvasRenderingContext2D) {
        if(!this.engine) {
            return
        }

        const { camera } = this.viewport
        ctx.save()

        ctx.strokeStyle = "rgba(100, 149, 237, 0.35)"
        ctx.lineWidth = 1

        const cssWidth = camera.cssWidth
        const cssHeight = camera.cssHeight

        for(const node of this.engine.getNodeList(OrbitNode)) {
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

        for(const eventHandler of this.eventHandlers) {
            this.engine.removeEntity(eventHandler)
        }
        this.eventHandlers.clear()

        this.nodes.length = 0

        super.removeFromEngine()

        return this
    }

}
