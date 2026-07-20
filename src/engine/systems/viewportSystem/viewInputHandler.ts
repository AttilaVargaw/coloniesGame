import { ViewportSystem } from "./viewportSystem";
import Camera from "@/lib/camera";

export class ViewportInputHandler {
    private isDragging = false
    private lastPointer: { x: number, y: number } | null = null
    private dragMoved = false
    private pointer: { x: number, y: number } = { x: 0, y: 0 }

    private readonly heldKeys = new Set<string>()

    constructor(private readonly viewportSystem: ViewportSystem) {}

    private static readonly DRAG_THRESHOLD = 3
    private static readonly ZOOM_SPEED = 1.0015
    private static readonly KEY_PAN_SPEED = 250
    private static readonly WHEEL_ZOOM_SPEED = 1.0015

    consumeDragMoved() {
        const moved = this.dragMoved
        this.dragMoved = false
        return moved
    }

    private applyKeyScroll(dt: number, camera: Camera) {
        const { pointer } = this

        let panX = 0
        let panY = 0
        if(this.heldKeys.has("ArrowLeft")) panX -= 1
        if(this.heldKeys.has("ArrowRight")) panX += 1
        if(this.heldKeys.has("ArrowUp")) panY -= 1
        if(this.heldKeys.has("ArrowDown")) panY += 1

        if(panX || panY) {
            const step = ViewportInputHandler.KEY_PAN_SPEED * (dt / 1000) * (camera.distance / 1000)
            camera.moveTo(
                camera.lookAt[0] + panX * step,
                camera.lookAt[1] + panY * step
            )
            this.viewportSystem.redrawQueue!.enqueue({ data: {} })
        }

        if(this.heldKeys.has("+") || this.heldKeys.has("=")) {
            camera.zoomBy(Math.pow(ViewportInputHandler.ZOOM_SPEED, dt), pointer.x, pointer.y)
            this.viewportSystem.redrawQueue!.enqueue({ data: {} })
        }
        if(this.heldKeys.has("-") || this.heldKeys.has("_")) {
            camera.zoomBy(Math.pow(1 / ViewportInputHandler.ZOOM_SPEED, dt), pointer.x, pointer.y)
            this.viewportSystem.redrawQueue!.enqueue({ data: {} })
        }
    }

    addToEngine() {
        window.addEventListener("wheel", this.onWheel, { passive: false })
        window.addEventListener("keydown", this.onKeyDown)
        window.addEventListener("keyup", this.onKeyUp)
    }

    removeFromEngine() {
        window.removeEventListener("wheel", this.onWheel)
        window.removeEventListener("keydown", this.onKeyDown)
        window.removeEventListener("keyup", this.onKeyUp)

        this.heldKeys.clear()
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
        if(!this.viewportSystem.engineRef) return

        event.preventDefault()

        const { camera } = this.viewportSystem.viewport
        const rect = camera.context.canvas.getBoundingClientRect()
        const screenX = event.clientX - rect.left
        const screenY = event.clientY - rect.top
        const factor = Math.pow(ViewportInputHandler.WHEEL_ZOOM_SPEED, event.deltaY)

        camera.zoomBy(factor, screenX, screenY)

        this.viewportSystem.redrawQueue?.enqueue({ data: {} })
    }

    update(dt: number) {
        if(!this.viewportSystem.engineRef) return

        const camera = this.viewportSystem.viewport.camera
        const mousedownArray = this.viewportSystem.engineRef.events.get("mousedown")!
        const mouseupArray = this.viewportSystem.engineRef.events.get("mouseup")!
        const mouseMovedArray = this.viewportSystem.engineRef.events.get("mouseMoved")!

        for(const { data } of mouseMovedArray) {
            const mouseData = data as { x: number; y: number }
            this.pointer = { x: mouseData.x, y: mouseData.y }
        }

        for(const { data } of mousedownArray) {
            this.isDragging = true
            const mouseData = data as { x: number; y: number }
            this.lastPointer = { x: mouseData.x, y: mouseData.y }
            this.dragMoved = false
            document.body.style.cursor = "grabbing"
        }
        mousedownArray.clear()

        if(this.isDragging && this.lastPointer) {
            for(const { data } of mouseMovedArray) {
                const mouseData = data as { x: number; y: number }
                const dx = mouseData.x - this.lastPointer.x
                const dy = mouseData.y - this.lastPointer.y
                if(dx || dy) {
                    camera.panByPixels(dx, dy)
                    if(Math.abs(dx) > ViewportInputHandler.DRAG_THRESHOLD || Math.abs(dy) > ViewportInputHandler.DRAG_THRESHOLD) {
                        this.dragMoved = true
                    }
                    this.lastPointer = { x: mouseData.x, y: mouseData.y }
                    this.viewportSystem.redrawQueue!.enqueue({ data: {} })
                }
            }
        }

        if(mouseupArray.length) {
            this.isDragging = false
            this.lastPointer = null
            document.body.style.cursor = "default"
        }
        mouseupArray.clear()

        this.applyKeyScroll(dt, camera)
    }
}
