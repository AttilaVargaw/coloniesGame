import { Engine } from "../../engine";
import { SystemWithNodes, } from "../system";
import { ViewportComponent } from "../../components/viewportComponent";
import { ViewportNode } from "./ViewportNode";
import { Entity } from "@/ems/entities/entity";
import { CircleRenderer } from "./renderers/circleRenderer";
import { RectRenderer } from "./renderers/rectRenderer";
import { HexagonRenderer } from "./renderers/hexagonRenderer";
import { LabelRenderer } from "./renderers/labelRenderer";
import Camera from "@/lib/camera";

export class ViewportSystem extends SystemWithNodes<ViewportNode> {
    protected updateNode(_node: ViewportNode, _dT?: number) { };

    removeFromEngine(): this {
        if(!this.engine) {
            return this
        }

        window.removeEventListener("wheel", this.onWheel)
        window.removeEventListener("keydown", this.onKeyDown)
        window.removeEventListener("keyup", this.onKeyUp)

        this.heldKeys.clear()
        this.engine.unregisterNodeType(ViewportNode)

        for(const eventHandler of this.eventHandlers) {
            this.engine.removeEntity(eventHandler)
        }
        this.eventHandlers.clear()

        this.nodes.length = 0
        this.engine.commands.delete("redraw")

        super.removeFromEngine()
        super.unregisterNodeTypes()

        return this
    }

    private readonly eventHandlers: Set<Entity> = new Set()

    private isDragging = false
    private lastPointer: { x: number, y: number } | null = null
    private dragMoved = false

    private pointer: { x: number, y: number } = { x: 0, y: 0 }

    private static readonly DRAG_THRESHOLD = 3
    private static readonly ZOOM_SPEED = 1.0015
    private static readonly KEY_PAN_SPEED = 250
    private static readonly WHEEL_ZOOM_SPEED = 1.0015

    consumeDragMoved() {
        const moved = this.dragMoved
        this.dragMoved = false
        return moved
    }

    private readonly heldKeys = new Set<string>()

    private applyKeyScroll(dt: number, camera: Camera) {
        const { pointer } = this

        let panX = 0
        let panY = 0
        if(this.heldKeys.has("ArrowLeft")) panX -= 1
        if(this.heldKeys.has("ArrowRight")) panX += 1
        if(this.heldKeys.has("ArrowUp")) panY -= 1
        if(this.heldKeys.has("ArrowDown")) panY += 1

        if(panX || panY) {
            const step = ViewportSystem.KEY_PAN_SPEED * (dt / 1000) * (camera.distance / 1000)
            camera.moveTo(
                camera.lookAt[0] + panX * step,
                camera.lookAt[1] + panY * step
            )
            this.engine!.commands.get("redraw")!.push({ name: "redraw", data: {} })
        }

        if(this.heldKeys.has("+") || this.heldKeys.has("=")) {
            camera.zoomBy(Math.pow(ViewportSystem.ZOOM_SPEED, dt), pointer.x, pointer.y)
            this.engine!.commands.get("redraw")!.push({ name: "redraw", data: {} })
        }
        if(this.heldKeys.has("-") || this.heldKeys.has("_")) {
            camera.zoomBy(Math.pow(1 / ViewportSystem.ZOOM_SPEED, dt), pointer.x, pointer.y)
            this.engine!.commands.get("redraw")!.push({ name: "redraw", data: {} })
        }
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
        const mouseMovedArray = this.engine.commands.get("mouseMoved")!

        for(const { data } of mouseMovedArray) {
            this.pointer = { x: data.x, y: data.y }
        }

        for(const { data } of mousedownArray) {
            this.isDragging = true
            this.lastPointer = { x: data.x, y: data.y }
            this.dragMoved = false
            document.body.style.cursor = "grabbing"
        }
        mousedownArray.length = 0

        if(this.isDragging && this.lastPointer) {
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

        this.applyKeyScroll(dt, camera)

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
        redrawArray.length = 0
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const key = event.key
        if(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_"].includes(key)) {
            this.heldKeys.add(key)
            event.preventDefault()
        }
    }

    private onKeyUp = (event: KeyboardEvent) => {
        this.heldKeys.delete(event.key)
    }

    private onWheel = (event: WheelEvent) => {
        if(!this.engine) return

        event.preventDefault()

        const { camera } = this.nodes[0].viewPort
        const rect = camera.context.canvas.getBoundingClientRect()
        const screenX = event.clientX - rect.left
        const screenY = event.clientY - rect.top
        const factor = Math.pow(ViewportSystem.WHEEL_ZOOM_SPEED, event.deltaY)

        camera.zoomBy(factor, screenX, screenY)

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
        window.addEventListener("wheel", this.onWheel, { passive: false })
        window.addEventListener("keydown", this.onKeyDown)
        window.addEventListener("keyup", this.onKeyUp)
        this.nodes = engine.getNodeList(ViewportNode)
        engine.commands.set("redraw", [])

        this
            .addSubsystem(new HexagonRenderer)
            .addSubsystem(new CircleRenderer)
            .addSubsystem(new RectRenderer)
            .addSubsystem(new LabelRenderer)


        return this
    }

}
