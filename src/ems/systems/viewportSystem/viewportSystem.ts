import { Engine } from "../../engine";
import { CircleNode } from "./circleNode";
import { RectNode } from "./rectNode";
import { SystemWithNodes, } from "../system";
import { ColorComponent } from "../../components/colorComponent";
import { PositionComponent } from "../../components/position";
import { RadiusComponent } from "../../components/radiusComponent";
import { SizeComponent } from "../../components/sizeComponent";
import { LabelNode } from "./labelNode";
import { LabelComponent } from "../../components/label";
import { EventHandlerComponent } from "../../components/EventHandlerComponent";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { ShapeComponent } from "../../components/ShapeComponent";
import { HexagoneNode } from "./HexagoneNode";
import { Entity } from "@/ems/entities/entity";
import { shortByIndex } from "@/lib/shortByIndex";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    removeFromEngine() {
        if(!this.engine) {
            return
        }

        window.removeEventListener("wheel", this.onWheel)
        this.engine.unsubscribe("entityAdded", this.onUpdateIndices)
        this.engine.unregisterNodeType(ViewportNode)
        this.engine.unregisterNodeType(CircleNode)
        this.engine.unregisterNodeType(HexagoneNode)
        this.engine.unregisterNodeType(RectNode)
        this.engine.unregisterNodeType(LabelNode)

        for(const eventHandler of this.eventHandlers) {
            this.engine.removeEntity(eventHandler)
        }
        this.eventHandlers.clear()

        this.nodes.length = 0
        this.circles.length = 0
        this.rects.length = 0
        this.labels.length = 0
        this.shapes.length = 0

        super.removeFromEngine()
    }

    private onUpdateIndices = () => {
        this.circles.sort(shortByIndex)
        this.rects.sort(shortByIndex)
        this.shapes.sort(shortByIndex)
        this.labels.sort(shortByIndex)
    }

    private rects: RectNode[] = []
    private circles: CircleNode[] = []
    private shapes: HexagoneNode[] = []
    private labels: LabelNode[] = []
    private readonly eventHandlers: Set<Entity> = new Set()

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

    update(_dt: number) {
        if(!this.engine) return

        const redrawArray = this.engine.commands.get("redraw")!

        if(redrawArray.length) {
            for(const { viewPort: { camera } } of this.nodes) {
                const ctx = camera.context
                this.clear(ctx)

                camera.begin();

                //implement culling somehow!

                for(const shape of this.shapes) {
                    shape.render(ctx);
                }

                for(const rect of this.rects) {
                    rect.render(ctx);
                }

                for(const circle of this.circles) {
                    circle.render(ctx);
                }

                for(const label of this.labels) {
                    label.render(ctx)
                }

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

    addToEngine(engine: Engine) {
        window.addEventListener("wheel", this.onWheel)

        engine.registerNodeType(ViewportNode,
            new Set([
                ViewportComponent
            ]),
            (entity) => (
                {
                    viewPort: entity.getComponent(ViewportComponent)!,
                    entity
                }
            ))
            .registerNodeType(CircleNode, new Set([PositionComponent, RadiusComponent, ColorComponent]), (entity) => new CircleNode(
                entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(RadiusComponent)!,
                entity.getComponent(ColorComponent)
            ))
            .registerNodeType(HexagoneNode, new Set([PositionComponent, ShapeComponent, ColorComponent]), (entity) =>
                new HexagoneNode(
                    entity,
                    entity.getComponent(PositionComponent)!,
                    entity.getComponent(ColorComponent)!,
                    entity.getComponent(ShapeComponent)!,
                )
            )
            .registerNodeType(RectNode, new Set([PositionComponent, SizeComponent]), (entity) => (
                new RectNode(
                    entity,
                    entity.getComponent(PositionComponent)!,
                    entity.getComponent(SizeComponent)!,
                    entity.getComponent(ColorComponent)!,
                )
            ))
            .registerNodeType(LabelNode,
                new Set([
                    PositionComponent,
                    LabelComponent,
                ]),
                (entity) =>
                    new LabelNode(
                        entity,
                        entity.getComponent(PositionComponent)!,
                        entity.getComponent(LabelComponent)!,
                    )
            )

        this.engine = engine
        this.nodes = engine.getNodeList(ViewportNode)
        this.circles = engine.getNodeList(CircleNode)
        this.rects = engine.getNodeList(RectNode)
        this.labels = engine.getNodeList(LabelNode)
        this.shapes = engine.getNodeList(HexagoneNode)

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

    }

}
