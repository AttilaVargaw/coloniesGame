import { ViewportSystem } from "./viewportSystem";
import Camera from "@/lib/camera";
import { MousedownEvent, MouseupEvent, MousemoveEvent } from "@/engine/lib/events";
import { CameraFollowSystem } from "@/game/systems/cameraFollowSystem";
import { CAMERA_INITIAL_DISTANCE } from "@/game/constants";

const wasdButtons = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
const allButtons = new Set(["+", "=", "-", "_", ...wasdButtons])

export class ViewportInputHandler {
    private _isDragging = false
    private _isZooming = false
    private dragButton: number | null = null
    private lastPointer: { x: number, y: number } | null = null
    private dragMoved = false
    private pointer: { x: number, y: number } = { x: 0, y: 0 }
    private wheelZoomAccum = 0
    private lastWheelScreen = { x: 0, y: 0 }

    private readonly heldKeys = new Set<string>()

    private rotationVelocityX = 0
    private rotationVelocityY = 0
    private wasRotatingWithoutTarget = false

    constructor(private readonly viewportSystem: ViewportSystem, private readonly cameraFollowSystem: CameraFollowSystem) { }

    private static readonly DRAG_THRESHOLD = 3
    private static readonly ZOOM_SPEED = 1
    private static readonly KEY_PAN_SPEED = 1.2
    private static readonly MOUSE_ROTATE_SPEED = 0.008
    private static readonly WHEEL_ZOOM_STEP = 80
    private static readonly EDGE_PAN_THRESHOLD = 30
    private static readonly EDGE_PAN_SPEED = 1.5
    private static readonly ROTATION_INERTIA_DECAY = 0
    private static readonly ROTATION_INERTIA_THRESHOLD = 0

    get isDragging() {
        return this._isDragging
    }

    get isZooming() {
        return this._isZooming
    }

    consumeDragMoved() {
        const moved = this.dragMoved
        this.dragMoved = false
        return moved
    }

    get isRotatingWithoutTarget(): boolean {
        return this.wasRotatingWithoutTarget
    }

    private get hasFollowTarget(): boolean {
        return this.cameraFollowSystem.isFollowing()
    }

    private applyOrbitRotation(camera: Camera, dx: number, dy: number) {
        camera.yaw -= dx * ViewportInputHandler.MOUSE_ROTATE_SPEED
        camera.pitch = Math.max(0.05, Math.min(Math.PI / 2, camera.pitch - dy * ViewportInputHandler.MOUSE_ROTATE_SPEED))
        camera.invalidateViewBasis()
    }

    private applyKeyScroll(dt: number, camera: Camera) {
        let panForward = 0
        let panRight = 0
        if(this.heldKeys.has("w")) panForward += 1
        if(this.heldKeys.has("s")) panForward -= 1
        if(this.heldKeys.has("d")) panRight += 1
        if(this.heldKeys.has("a")) panRight -= 1

        if(panForward || panRight) {
            const { rx, ry, fx, fy, } = camera.viewBasis
            const speed = ViewportInputHandler.KEY_PAN_SPEED * dt


            camera.moveTo(
                camera.lookAt[0] + (panForward * fx + panRight * rx) * speed,
                camera.lookAt[1] + (panForward * fy + panRight * ry) * speed,
                camera.lookAt[2]
            )
        }

        if(this.heldKeys.has("-") || this.heldKeys.has("=")) {
            this._isZooming = true
            camera.zoomBy(Math.pow(ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        } else if(this.heldKeys.has("+") || this.heldKeys.has("_")) {
            this._isZooming = true
            camera.zoomBy(Math.pow(1 / ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        }
    }

    private panCamera(camera: Camera, panRight: number, panForward: number, step: number) {
        if(!panRight && !panForward) return

        const { fx, fy, fz, rx, ry, rz } = camera.viewBasis
        const speed = ViewportInputHandler.KEY_PAN_SPEED * step
        camera.moveTo(
            camera.lookAt[0] + (panRight * rx + panForward * fx) * speed,
            camera.lookAt[1] + (panRight * ry + panForward * fy) * speed,
            camera.lookAt[2] + (panRight * rz + panForward * fz) * speed,
        )
    }

    private applyEdgePan(dt: number, camera: Camera) {
        if(this._isDragging || !this.viewportSystem.viewport) return

        const bounds = camera.visibleBounds
        const { x, y } = this.pointer
        const threshold = ViewportInputHandler.EDGE_PAN_THRESHOLD
        const step = (dt / 1000) * ViewportInputHandler.EDGE_PAN_SPEED

        let panRight = 0
        let panForward = 0

        if(x < threshold) panRight -= (1 - x / threshold) * step
        if(x > bounds.right - threshold) panRight += (1 - (bounds.right - x) / threshold) * step
        if(y < threshold) panForward -= (1 - y / threshold) * step
        if(y > bounds.bottom - threshold) panForward += (1 - (bounds.bottom - y) / threshold) * step

        this.panCamera(camera, panRight, panForward, step)
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
        window.removeEventListener("wheel", this.onWheel)
        canvas.removeEventListener("mouseenter", this.onMouseEnter)
        canvas.removeEventListener("mouseleave", this.onMouseLeave)
        canvas.removeEventListener("contextmenu", this.onContextMenu)
        this.heldKeys.clear()
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const key = event.key

        if(allButtons.has(key)) {
            if(wasdButtons.has(key)) {
                this.cameraFollowSystem.stopFollowing()
                //this.viewportSystem.viewport!.camera.distance = CAMERA_INITIAL_DISTANCE
            }
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
        this.lastWheelScreen = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        }

        this.wheelZoomAccum += event.deltaY
    }

    update(dt: number) {
        if(!this.viewportSystem.engineRef) {
            return
        }

        this._isZooming = false

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
                this.rotationVelocityX = 0
                this.rotationVelocityY = 0
                this.wasRotatingWithoutTarget = false
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
                        if(this.hasFollowTarget) {
                            camera.yaw -= dx * ViewportInputHandler.MOUSE_ROTATE_SPEED
                            camera.pitch = Math.max(0.05, Math.min(Math.PI / 2, camera.pitch - dy * ViewportInputHandler.MOUSE_ROTATE_SPEED))
                            camera.invalidateViewBasis()
                        } else {
                            this.applyOrbitRotation(camera, dx, dy)
                            this.wasRotatingWithoutTarget = true
                        }
                        this.rotationVelocityX = dx
                        this.rotationVelocityY = dy
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
            this.dragMoved = false
            document.body.style.cursor = "default"
        }
        mouseupArray.clear()

        if(!this._isDragging && this.wasRotatingWithoutTarget) {
            this.applyRotationInertia(camera)
        }

        this.applyKeyScroll(dt, camera)
        this.applyEdgePan(dt, camera)
        this.applyWheelZoom(camera)
    }

    private zoomWheel(camera: Camera, factor: number) {
        this._isZooming = true
        if(this.hasFollowTarget) {
            camera.zoomBy(factor, this.lastWheelScreen.x, this.lastWheelScreen.y)
        } else {
            this.viewportSystem.viewport.camera.moveTo(
                camera.lookAt[0],
                camera.lookAt[1],
                camera.lookAt[2] += this.wheelZoomAccum
            )
        }
    }

    private applyWheelZoom(camera: Camera) {
        const step = ViewportInputHandler.WHEEL_ZOOM_STEP

        if(this.wheelZoomAccum >= step) {
            this.zoomWheel(camera, 1.05)
            this.wheelZoomAccum -= step
        } else if(this.wheelZoomAccum <= -step) {
            this.zoomWheel(camera, 0.95)
            this.wheelZoomAccum += step
        }
    }

    private applyRotationInertia(camera: Camera) {
        if(Math.abs(this.rotationVelocityX) > ViewportInputHandler.ROTATION_INERTIA_THRESHOLD ||
            Math.abs(this.rotationVelocityY) > ViewportInputHandler.ROTATION_INERTIA_THRESHOLD) {
            this.applyOrbitRotation(camera, this.rotationVelocityX, this.rotationVelocityY)
            this.rotationVelocityX *= ViewportInputHandler.ROTATION_INERTIA_DECAY
            this.rotationVelocityY *= ViewportInputHandler.ROTATION_INERTIA_DECAY
        } else {
            this.wasRotatingWithoutTarget = false
            this.rotationVelocityX = 0
            this.rotationVelocityY = 0
        }
    }
}
