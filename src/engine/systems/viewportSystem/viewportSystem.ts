import { World } from "../../core/world";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { Entity } from "@engine/entities/entity";
import { CircleRenderer } from "./renderers/circleRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { HexagonRenderer } from "./renderers/hexagonRenderer";
import { LabelRenderer } from "./renderers/labelRenderer";
import { Queue } from "@engine/lib/commandQueue";
import { ViewportInputHandler } from "./viewInputHandler";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { DEBUG_VISUALIZE_PATHS, getActivePaths } from "@game/systems/moveSystem";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    public redrawQueue?: Queue<RedrawCommand>
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

        if(this.redrawQueue?.length) {
            for(const { viewPort: { camera } } of this.nodes) {
                const ctx = camera.context
                this.clear(ctx)

                camera.begin();

                this.updateSubsystems(dt);

                if(DEBUG_VISUALIZE_PATHS) {
                    this.drawDebugPaths(ctx)
                }

                camera.end();
            }

        }
        this.redrawQueue?.clear()
    }

    private drawDebugPaths(ctx: CanvasRenderingContext2D) {
        if(!this.engine) return

        const paths = getActivePaths()
        if(paths.length === 0) return

        for(const { ship, waypoints } of paths) {
            const [sx, sy] = getAbsolute(ship, this.engine)

            ctx.beginPath()
            ctx.moveTo(sx, sy)

            for(const waypoint of waypoints) {
                const [wx, wy] = getAbsolute(waypoint, this.engine)
                ctx.lineTo(wx, wy)
            }

            ctx.strokeStyle = "rgba(255, 215, 0, 0.6)"
            ctx.lineWidth = 2
            ctx.setLineDash([6, 3])
            ctx.stroke()
            ctx.setLineDash([])
        }
    }

    registerNodes(engine: World) {
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

    addToEngine(engine: World): this {
        super.addToEngine(engine)
        this.inputHandler = new ViewportInputHandler(this)
        this.inputHandler.addToEngine()
        this.nodes = engine.getNodeList(ViewportNode)

        this
            .addSubsystem(new HexagonRenderer(this))
            .addSubsystem(new CircleRenderer(this))
            .addSubsystem(new RectRenderer(this))
            .addSubsystem(new LabelRenderer(this))

        engine.registerCommandQueue(RedrawCommand)
        // .registerCommandQueue("mousedown")
        // .registerCommandQueue("mouseup")
        // .registerCommandQueue("mouseMoved")

        this.redrawQueue = engine.getCommands(RedrawCommand)

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

        this.engine.removeCommandQueue(RedrawCommand)
        // .removeCommandQueue("mousedown")
        // .removeCommandQueue("mouseup")
        // .removeCommandQueue("mouseMoved")

        this.nodes.length = 0
        this.redrawQueue = undefined

        super.removeFromEngine()

        return this
    }

}
