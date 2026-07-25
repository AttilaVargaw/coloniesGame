import type { Engine } from "@/engine/core/engine";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { Entity } from "@engine/entities/entity";
import { CircleRenderer } from "./renderers/circleRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { HexagonRenderer } from "./renderers/hexagonRenderer";
import { LabelRenderer } from "./renderers/labelRenderer";
import { ViewportInputHandler } from "./viewInputHandler";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { DEBUG_VISUALIZE_PATHS, getActivePaths, getTodaysJumps } from "@game/systems/moveSystem";
import { OrbitNode } from "../orbitSystem/orbitNode";
import { TWO_PI } from "@/game/constants";
export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    private readonly eventHandlers: Set<Entity> = new Set()
    private inputHandler!: ViewportInputHandler

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
        ctx.fillStyle = "#002";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore()
    }

    update(dt: number) {
        if(!this.engine) return

        this.inputHandler.update(dt)

        for(const { viewPort: { camera } } of this.nodes) {
            const ctx = camera.context
            this.clear(ctx)

            camera.begin();

            if(DEBUG_VISUALIZE_PATHS) {
                this.drawDebugPaths(ctx)
                this.drawOrbits(ctx)
            }

            this.updateSubsystems(dt);

            camera.end();
        }


    }

    private drawDebugPaths(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const remainingPaths = getActivePaths()
        if(remainingPaths.length > 0) {
            for(const { ship, waypoints } of remainingPaths) {
                if(waypoints.length === 0) continue
                const [sx, sy] = getAbsolute(ship, this.engine)

                ctx.beginPath()
                ctx.moveTo(sx, sy)

                for(const waypoint of waypoints) {
                    const [wx, wy] = getAbsolute(waypoint, this.engine)
                    ctx.lineTo(wx, wy)
                }

                ctx.strokeStyle = "rgba(255, 215, 0, 0.25)"
                ctx.lineWidth = 1
                ctx.setLineDash([4, 4])
                ctx.stroke()
                ctx.setLineDash([])
            }
        }

        const todayJumps = getTodaysJumps()
        if(todayJumps.length > 0) {
            for(const { path } of todayJumps) {
                if(path.length < 2) continue
                const [sx, sy] = getAbsolute(path[0], this.engine)

                ctx.beginPath()
                ctx.moveTo(sx, sy)

                for(let i = 1; i < path.length; i++) {
                    const [wx, wy] = getAbsolute(path[i], this.engine)
                    ctx.lineTo(wx, wy)
                }

                ctx.strokeStyle = "rgba(255, 215, 0, 0.85)"
                ctx.lineWidth = 2
                ctx.setLineDash([])
                ctx.stroke()
            }
        }
    }

    private drawOrbits(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const orbitNodes = this.engine.getNodeList(OrbitNode)

        for(const node of orbitNodes) {
            const sceneNode = this.engine.getSceneNode(node.entity)
            const parentEntity = sceneNode?.parentRef?.entity
            if(!parentEntity) continue

            const [cx, cy] = getAbsolute(parentEntity, this.engine)
            const { radius: a, eccentricity: e } = node.orbit
            const b = node.orbit.semiMinorAxis

            const focusOffset = a * e

            ctx.beginPath()
            ctx.ellipse(
                cx - focusOffset,
                cy,
                a,
                b,
                0,
                0,
                TWO_PI
            )
            ctx.strokeStyle = "rgba(100, 149, 237, 0.2)"
            ctx.lineWidth = 3
            ctx.setLineDash([2, 4])
            ctx.stroke()
            ctx.setLineDash([])
        }
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

        super.registerNodes(engine)

        return this
    }

    init() {
        this.inputHandler.addToEngine()
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.inputHandler = new ViewportInputHandler(this)
        this.nodes = engine.getNodeList(ViewportNode)

        this
            .addSubsystem(new HexagonRenderer(this))
            .addSubsystem(new CircleRenderer(this))
            .addSubsystem(new RectRenderer(this))
            .addSubsystem(new LabelRenderer(this))

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
