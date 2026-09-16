import { ViewportSystem } from "./viewportSystem";
import Camera from "@/lib/camera";
import { MousedownEvent, MouseupEvent, MousemoveEvent } from "@/engine/lib/events";

export class ViewportInputHandler {
    private _isDragging = false
    private dragButton: number | null = null
    private lastPointer: { x: number, y: number } | null = null
    private dragMoved = false
    private pointer: { x: number, y: number } = { x: 0, y: 0 }

    private readonly heldKeys = new Set<string>()

    constructor(private readonly viewportSystem: ViewportSystem) { }

    private static readonly DRAG_THRESHOLD = 3
    private static readonly ZOOM_SPEED = 1.0015
    private static readonly KEY_PAN_SPEED = 1000.0
    private static readonly MOUSE_ROTATE_SPEED = 0.005
    private static readonly WHEEL_ZOOM_SPEED = 1.0015
    private static readonly EDGE_PAN_THRESHOLD = 30
    private static readonly EDGE_PAN_SPEED = 1.5

    get isDragging() {
        return this._isDragging
    }

    consumeDragMoved() {
        const moved = this.dragMoved
        this.dragMoved = false
        return moved
    }

    private applyKeyScroll(dt: number, camera: Camera) {
        const step = (dt / 1000)

        let panRight = 0
        let panUp = 0
        if(this.heldKeys.has("d")) panRight += 1
        if(this.heldKeys.has("a")) panRight -= 1
        if(this.heldKeys.has("w")) panUp += 1
        if(this.heldKeys.has("s")) panUp -= 1

        if(panRight || panUp) {
            const { right, up } = camera.getBasisVectors()
            const speed = ViewportInputHandler.KEY_PAN_SPEED * step
            camera.moveTo(
                camera.lookAt[0] + (panRight * right[0] + panUp * up[0]) * speed,
                camera.lookAt[1] + (panRight * right[1] + panUp * up[1]) * speed,
                camera.lookAt[2] + (panRight * right[2] + panUp * up[2]) * speed,
            )
        }

        if(this.heldKeys.has("-") || this.heldKeys.has("=")) {
            camera.zoomBy(Math.pow(ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        }
        if(this.heldKeys.has("+") || this.heldKeys.has("_")) {
            camera.zoomBy(Math.pow(1 / ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        }
    }

    private applyEdgePan(dt: number, camera: Camera) {
        if(this._isDragging || !this.viewportSystem.viewport) return

        const bounds = camera.visibleBounds
        const { x, y } = this.pointer
        const threshold = ViewportInputHandler.EDGE_PAN_THRESHOLD
        const step = (dt / 1000) * ViewportInputHandler.EDGE_PAN_SPEED

        let panRight = 0
        let panUp = 0

        if(x < threshold) panRight -= (1 - x / threshold) * step
        if(x > bounds.right - threshold) panRight += (1 - (bounds.right - x) / threshold) * step
        if(y < threshold) panUp -= (1 - y / threshold) * step
        if(y > bounds.bottom - threshold) panUp += (1 - (bounds.bottom - y) / threshold) * step

        if(panRight || panUp) {
            const { right, up } = camera.getBasisVectors()
            const speed = ViewportInputHandler.KEY_PAN_SPEED * step
            camera.moveTo(
                camera.lookAt[0] + (panRight * right[0] + panUp * up[0]) * speed,
                camera.lookAt[1] + (panRight * right[1] + panUp * up[1]) * speed,
                camera.lookAt[2] + (panRight * right[2] + panUp * up[2]) * speed,
            )
        }
    }

    private onContextMenu = (event: MouseEvent) => {
        event.preventDefault()
    }

    private onMouseEnter = () => {
        window.addEventListener("wheel", this.onWheel, { passive: false })
    }

    private onMouseLeave = () => {
        window.removeEventListener("wheel", this.onWheel)
    }

    addToEngine() {
        const canvas = this.viewportSystem?.viewport?.camera?.context.canvas
        if(!canvas) {
            return
        }

        canvas.addEventListener("mouseenter", this.onMouseEnter)
        canvas.addEventListener("mouseleave", this.onMouseLeave)
        canvas.addEventListener("contextmenu", this.onContextMenu)
        window.addEventListener("keydown", this.onKeyDown)
        window.addEventListener("keyup", this.onKeyUp)
    }

    removeFromEngine() {
        const canvas = this.viewportSystem?.viewport?.camera?.context.canvas
        if(!canvas) {
            return
        }

        window.removeEventListener("keydown", this.onKeyDown)
        window.removeEventListener("keyup", this.onKeyUp)
        canvas.removeEventListener("mouseenter", this.onMouseEnter)
        canvas.removeEventListener("mouseleave", this.onMouseLeave)
        canvas.removeEventListener("contextmenu", this.onContextMenu)
        this.heldKeys.clear()
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const key = event.key
        if(["+", "=", "-", "_", "w", "a", "s", "d"].includes(key)) {
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
    }

    update(dt: number) {
        if(!this.viewportSystem.engineRef) {
            return
        }

        const camera = this.viewportSystem.viewport.camera
        const mousedownArray = this.viewportSystem.engineRef.getEvents(MousedownEvent)!
        const mouseupArray = this.viewportSystem.engineRef.getEvents(MouseupEvent)!
        const mouseMovedArray = this.viewportSystem.engineRef.getEvents(MousemoveEvent)!

        for(const { data } of mouseMovedArray) {
            this.pointer = { x: data.x, y: data.y }
        }

        for(const { data } of mousedownArray) {
            const button = data.button
            if(button === 2 || button === 1) {
                this._isDragging = true
                this.dragButton = button
                this.lastPointer = { x: data.x, y: data.y }
                this.dragMoved = false
                document.body.style.cursor = button === 2 ? "grab" : "move"
            }
        }
        mousedownArray.clear()

        if(this._isDragging && this.lastPointer && this.dragButton !== null) {
            for(const { data } of mouseMovedArray) {
                const dx = data.x - this.lastPointer.x
                const dy = data.y - this.lastPointer.y
                if(dx || dy) {
                    if(this.dragButton === 2) {
                        camera.panByPixels(dx, dy)
                    } else if(this.dragButton === 1) {
                        camera.yaw += dx * ViewportInputHandler.MOUSE_ROTATE_SPEED
                        camera.pitch = Math.max(0.05, Math.min(Math.PI / 2, camera.pitch + dy * ViewportInputHandler.MOUSE_ROTATE_SPEED))
                        camera.invalidateViewBasis()
                    }
                    if(Math.abs(dx) > ViewportInputHandler.DRAG_THRESHOLD || Math.abs(dy) > ViewportInputHandler.DRAG_THRESHOLD) {
                        this.dragMoved = true
                    }
                    this.lastPointer = { x: data.x, y: data.y }
                }
            }
        }

        let released = false
        for(const { data } of mouseupArray) {
            if(data.button === this.dragButton) {
                released = true
                break
            }
        }
        if(released) {
            this._isDragging = false
            this.dragButton = null
            this.lastPointer = null
            document.body.style.cursor = "default"
        }
        mouseupArray.clear()

        this.applyKeyScroll(dt, camera)
        this.applyEdgePan(dt, camera)
    }
}
