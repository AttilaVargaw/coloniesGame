import { Engine } from "../../engine";
import { SystemWithNodes, } from "../system";
import { EventHandlerComponent } from "../../components/EventHandlerComponent";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { Entity } from "@/ems/entities/entity";
import { CircleRenderer } from "./renderers/circleRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { HexagonRenderer } from "./renderers/hexagonRenderer";
import { LabelRenderer } from "./renderers/labelRenderer";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        window.removeEventListener("wheel", this.onWheel)
        this.engine.unregisterNodeType(ViewportNode)

        for(const eventHandler of this.eventHandlers) {
            this.engine.removeEntity(eventHandler)
        }
        this.eventHandlers.clear()

        this.nodes.length = 0

        super.removeFromEngine()
        super.unregisterNodeTypes()

        return this
    }

    private readonly eventHandlers: Set<Entity> = new Set()

    private isDragging = false
    private lastPointer: { x: number, y: number } | null = null
    private dragMoved = false

    private static readonly DRAG_THRESHOLD = 3

    consumeDragMoved() {
        const moved = this.dragMoved
        this.dragMoved = false
        return moved
    }

    get viewport() {
        return this.nodes[0].viewPort
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

        const camera = this.nodes[0].viewPort.camera
        const mousedownArray = this.engine.commands.get("mousedown")!
        const mouseupArray = this.engine.commands.get("mouseup")!

        for(const { data } of mousedownArray) {
            this.isDragging = true
            this.lastPointer = { x: data.x, y: data.y }
            this.dragMoved = false
            document.body.style.cursor = "grabbing"
        }
        mousedownArray.length = 0

        if(this.isDragging && this.lastPointer) {
            const mouseMovedArray = this.engine.commands.get("mouseMoved")!
            for(const { data } of mouseMovedArray) {
                const dx = data.x - this.lastPointer.x
                const dy = data.y - this.lastPointer.y
                if(dx || dy) {
                    camera.panByPixels(dx, dy)
                    if(Math.abs(dx) > ViewportSystem.DRAG_THRESHOLD || Math.abs(dy) > ViewportSystem.DRAG_THRESHOLD) {
                        this.dragMoved = true
                    }
                    this.lastPointer = { x: data.x, y: data.y }
                    this.engine.commands.get("redraw")!.push({ name: "redraw", data: {} })
                }
            }
        }

        if(mouseupArray.length) {
            this.isDragging = false
            this.lastPointer = null
            document.body.style.cursor = "default"
        }
        mouseupArray.length = 0

        const redrawArray = this.engine.commands.get("redraw")!

        if(redrawArray.length) {
            for(const { viewPort: { camera } } of this.nodes) {
                const ctx = camera.context
                this.clear(ctx)

                camera.begin();

                //implement culling somehow!
                this.updateSubsystems(dt);

                camera.end();
            }

        }
        redrawArray!.length = 0
    }

    private moveEventHandler = (key: string, [deltaX, deltaY]: [number, number]) =>
        new EventHandlerComponent(key, ({ shiftKey }: KeyboardEvent) => {
            if(!this.engine) return

            const { camera } = this.nodes[0].viewPort
            const [loookatX, loookatY] = camera.lookAt

            camera.moveTo(loookatX + (shiftKey ? deltaX * 10 : deltaX), loookatY + (shiftKey ? deltaY * 10 : deltaY))
            this.engine.commands.get("redraw")!.push({ name: "redraw", data: {} })
        })

    private zoomEventHandler = (key: string, delta: number) =>
        new EventHandlerComponent(key, ({ shiftKey }: KeyboardEvent) => {
            if(!this.engine) return

            const { camera } = this.nodes[0].viewPort

            camera.zoomTo(camera.distance + (shiftKey ? delta * 10 : delta))

            this.engine.commands.get("redraw")!.push({ name: "redraw", data: {} })
        })

    private onWheel = (event: WheelEvent) => {
        if(!this.engine) return

        const { camera } = this.nodes[0].viewPort
        camera.zoomTo(camera.distance + (event.deltaY > 0 ? 100 : -100))

        this.engine.commands.get("redraw")!.push({ name: "redraw", data: {} })
    }

    registerNodes(engine: Engine) {
        engine.registerNodeType(ViewportNode,
            new Set([
                ViewportComponent
            ]),
            (entity) => (
                {
                    viewPort: entity.getComponent(ViewportComponent)!,
                    entity
                }
            )
        )

        super.registerNodes(engine)

        return this
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        window.addEventListener("wheel", this.onWheel)
        //reduntant
        this.engine = engine
        this.nodes = engine.getNodeList(ViewportNode)

        this.addSubsystem(new CircleRenderer)
            .addSubsystem(new RectRenderer)
            .addSubsystem(new HexagonRenderer)
            .addSubsystem(new LabelRenderer)

        const eventHandlers = [
            this.engine.createEntity().addComponent(this.moveEventHandler("ArrowLeft", [-1, 0])),
            this.engine.createEntity().addComponent(this.moveEventHandler("ArrowRight", [1, 0])),
            this.engine.createEntity().addComponent(this.moveEventHandler("ArrowUp", [0, -1])),
            this.engine.createEntity().addComponent(this.moveEventHandler("ArrowDown", [0, 1])),
            this.engine.createEntity().addComponent(this.zoomEventHandler("-", 10)),
            this.engine.createEntity().addComponent(this.zoomEventHandler("+", -10))
        ]

        for(const eventHandler of eventHandlers) {
            this.engine.addEntity(eventHandler)
            this.eventHandlers.add(eventHandler)
        }


        return this
    }

}
