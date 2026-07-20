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

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };
    public redrawQueue?: Queue<unknown>
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

                camera.end();
            }

        }
        this.redrawQueue?.clear()
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

        engine.registerCommandQueue("redraw")
        // .registerCommandQueue("mousedown")
        // .registerCommandQueue("mouseup")
        // .registerCommandQueue("mouseMoved")

        this.redrawQueue = engine.commands.get("redraw")

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

        this.engine.removeCommandQueue("redraw")
        // .removeCommandQueue("mousedown")
        // .removeCommandQueue("mouseup")
        // .removeCommandQueue("mouseMoved")

        this.nodes.length = 0
        this.redrawQueue = undefined

        super.removeFromEngine()

        return this
    }

}
