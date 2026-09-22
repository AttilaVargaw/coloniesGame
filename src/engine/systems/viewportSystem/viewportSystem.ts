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
import Camera from "@/lib/camera";

const mulberry32 = (seed: number) => {
    seed |= 0
    return () => {
        seed = seed + 0x6D2B79F5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

const rng = mulberry32(42)
const createStarfield = (count: number) => {
    return Array.from({ length: count }, () => {
        const theta = rng() * Math.PI * 2
        const phi = Math.acos(2 * rng() - 1)
        const r = 50000 + rng() * 150000
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
            r: 0.5 + rng() * 1.0,
            opacity: 0.3 + rng() * 0.6,
        }
    })
}

const starfield = createStarfield(512)

const rotationIndicatorColor = "rgba(255, 255, 255, 0.2)";

function drawRotationIndicator(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save();
    ctx.strokeStyle = rotationIndicatorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(camera.cssWidth / 2, camera.cssHeight / 2, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(camera.cssWidth / 2 - 6, camera.cssHeight / 2);
    ctx.lineTo(camera.cssWidth / 2 + 6, camera.cssHeight / 2);
    ctx.moveTo(camera.cssWidth / 2, camera.cssHeight / 2 - 6);
    ctx.lineTo(camera.cssWidth / 2, camera.cssHeight / 2 + 6);
    ctx.stroke();
    ctx.restore();
}

function drawStarfield(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save()
    ctx.fillStyle = "#ffffff"

    const buckets = new Map<number, { x: number; y: number; r: number }[]>()
    const glowBuckets = new Map<number, { x: number; y: number; r: number }[]>()
    for(const s of starfield) {
        const projected = camera.project(s.x, s.y, s.z)
        if(!projected) {
            continue
        }
        const alpha = s.opacity * Math.min(1, projected.scale * 80)
        const radius = Math.max(0.5, Math.min(3, s.r * projected.scale * 200))
        const bucket = Math.round(alpha * 10) / 10

        if(!buckets.has(bucket)) buckets.set(bucket, [])
        buckets.get(bucket)!.push({ x: projected.x, y: projected.y, r: radius })

        if(alpha > 0.6 && radius > 1.5) {
            const glowAlpha = (alpha - 0.6) * 0.4
            const glowRadius = radius * 4
            const glowBucket = Math.round(glowAlpha * 10) / 10
            if(!glowBuckets.has(glowBucket)) glowBuckets.set(glowBucket, [])
            glowBuckets.get(glowBucket)!.push({ x: projected.x, y: projected.y, r: glowRadius })
        }
    }

    const drawBucket = (stars: { x: number; y: number; r: number }[], alpha: number) => {
        ctx.globalAlpha = alpha
        ctx.beginPath()
        for (const star of stars) {
            ctx.moveTo(star.x + star.r, star.y)
            ctx.arc(star.x, star.y, star.r, 0, TWO_PI)
        }
        ctx.fill()
    }

    for (const [alpha, stars] of glowBuckets) drawBucket(stars, alpha)
    for (const [alpha, stars] of buckets)     drawBucket(stars, alpha)

    ctx.restore()
}

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
                drawRotationIndicator(ctx, camera,);
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
            const inclinationAngle = orbit.inclination || 0
            const cosI = Math.cos(inclinationAngle)
            const sinI = Math.sin(inclinationAngle)
            const b = orbit.semiMinorAxis
            const focusOffset = orbit.radius * orbit.eccentricity
            const arg = orbit.argumentOfPeriapsis || 0
            const cosA = Math.cos(arg)
            const sinA = Math.sin(arg)
            const lan = orbit.longitudeOfAscendingNode || 0
            const cosL = Math.cos(lan)
            const sinL = Math.sin(lan)

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
