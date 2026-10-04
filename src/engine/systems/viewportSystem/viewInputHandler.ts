import { ViewportSystem } from "./viewportSystem";
import Camera from "@/lib/camera";
import { Vector3 } from "@/lib/Vector3";
import { MousedownEvent, MouseupEvent, MousemoveEvent } from "@/engine/lib/events";
import { Queue } from "@/engine/lib/commandQueue";
import { getPlatform } from "@/engine/lib/platform";

interface CameraFollowTarget {
    isFollowing(): boolean
    stopFollowing(): void
}

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
    private panVelocity: Vector3 = [0, 0, 0]

    constructor(private readonly viewportSystem: ViewportSystem, private readonly cameraFollowSystem?: CameraFollowTarget) { }

    private static readonly DRAG_THRESHOLD = 3
    private static readonly ZOOM_SPEED = 1
    private static readonly KEY_PAN_SPEED = 0.02
    private static readonly KEY_PAN_ACCELERATION = 0.3
    private static readonly MOUSE_ROTATE_SPEED = 0.008
    private static readonly WHEEL_ZOOM_STEP = 40
    private static readonly EDGE_PAN_THRESHOLD = 30
    private static readonly EDGE_PAN_SPEED = 1.5
    private static readonly ROTATION_INERTIA_DECAY = 0.82
    private static readonly ROTATION_INERTIA_THRESHOLD = 0.01
    private static readonly MAX_ZOOM = 5_000
    private static readonly MIN_ZOOM = -1000

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
        return this.cameraFollowSystem?.isFollowing() ?? false
    }

    private static applyOrbitRotation(camera: Camera, dx: number, dy: number) {
        camera.yaw -= dx * ViewportInputHandler.MOUSE_ROTATE_SPEED
        camera.pitch = Math.max(0.05, Math.min(Math.PI / 2, camera.pitch - dy * ViewportInputHandler.MOUSE_ROTATE_SPEED))

        camera.invalidateViewBasis()
    }

    private applyKeyScroll(dt: number, camera: Camera) {
        let panForward = 0
        let panRight = 0
        if (this.heldKeys.has("w")) panForward += 1
        if (this.heldKeys.has("s")) panForward -= 1
        if (this.heldKeys.has("d")) panRight += 1
        if (this.heldKeys.has("a")) panRight -= 1

        if (panForward || panRight) {
            const { rx, ry, fx, fy } = camera.viewBasis
            const targetSpeed = ViewportInputHandler.KEY_PAN_SPEED * camera.distance
            const targetVx = (panForward * fx + panRight * rx) * targetSpeed
            const targetVy = (panForward * fy + panRight * ry) * targetSpeed
            const t = 1 - Math.pow(1 - ViewportInputHandler.KEY_PAN_ACCELERATION, dt / 16.667)
            this.panVelocity[0] += (targetVx - this.panVelocity[0]) * t
            this.panVelocity[1] += (targetVy - this.panVelocity[1]) * t
        }

        if (this.heldKeys.has("-") || this.heldKeys.has("=")) {
            this._isZooming = true
            camera.zoomBy(Math.pow(ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        } else if (this.heldKeys.has("+") || this.heldKeys.has("_")) {
            this._isZooming = true
            camera.zoomBy(Math.pow(1 / ViewportInputHandler.ZOOM_SPEED, dt), this.pointer.x, this.pointer.y)
        }
    }

    private applyEdgePan(dt: number, camera: Camera) {
        if (this._isDragging || !this.viewportSystem) return

        const bounds = camera.visibleBounds
        const { x, y } = this.pointer
        const threshold = ViewportInputHandler.EDGE_PAN_THRESHOLD
        const step = (dt / 1000) * ViewportInputHandler.EDGE_PAN_SPEED

        let panRight = 0
        let panForward = 0

        if (x < threshold) panRight -= (1 - x / threshold) * step
        if (x > bounds.right - threshold) panRight += (1 - (bounds.right - x) / threshold) * step
        if (y < threshold) panForward -= (1 - y / threshold) * step
        if (y > bounds.bottom - threshold) panForward += (1 - (bounds.bottom - y) / threshold) * step

        if (panRight || panForward) {
            const { rx, ry, fx, fy } = camera.viewBasis
            const targetSpeed = ViewportInputHandler.KEY_PAN_SPEED * camera.distance
            const targetVx = (panRight * rx + panForward * fx) * targetSpeed
            const targetVy = (panRight * ry + panForward * fy) * targetSpeed
            const t = 1 - Math.pow(0.1, dt / 16.667)
            this.panVelocity[0] += (targetVx - this.panVelocity[0]) * t
            this.panVelocity[1] += (targetVy - this.panVelocity[1]) * t
        }
    }

    private applyPanVelocity(dt: number, camera: Camera) {
        const [vx, vy] = this.panVelocity
        if (vx !== 0 || vy !== 0) {
            camera.moveTo(
                camera.lookAt[0] + vx * dt,
                camera.lookAt[1] + vy * dt,
                camera.lookAt[2]
            )
            const damping = Math.pow(0.55, dt / 16.667)
            this.panVelocity[0] *= damping
            this.panVelocity[1] *= damping

            if (Math.abs(this.panVelocity[0]) < 0.001 && Math.abs(this.panVelocity[1]) < 0.001) {
                this.panVelocity[0] = 0
                this.panVelocity[1] = 0
            }
        }
    }

    private static onContextMenu = (event: MouseEvent) => {
        event.preventDefault()
    }

    private onMouseEnter = () => {
        getPlatform().window.addEventListener("wheel", this.onWheel, { passive: false })
    }

    private onMouseLeave = () => {
        getPlatform().window.removeEventListener("wheel", this.onWheel)
    }

    addToEngine() {
        const canvas = this.viewportSystem.camera.context.canvas
        if (!canvas || !this.viewportSystem.engineRef) {
            return
        }

        this.mousedownArray = this.viewportSystem.engineRef.getEvents(MousedownEvent)
        this.mouseupArray = this.viewportSystem.engineRef.getEvents(MouseupEvent)
        this.mouseMovedArray = this.viewportSystem.engineRef.getEvents(MousemoveEvent)

        canvas.addEventListener("mouseenter", this.onMouseEnter)
        canvas.addEventListener("mouseleave", this.onMouseLeave)
        canvas.addEventListener("contextmenu", ViewportInputHandler.onContextMenu)
        getPlatform().window.addEventListener("keydown", this.onKeyDown)
        getPlatform().window.addEventListener("keyup", this.onKeyUp)
    }

    removeFromEngine() {
        getPlatform().window.removeEventListener("keydown", this.onKeyDown)
        getPlatform().window.removeEventListener("keyup", this.onKeyUp)
        getPlatform().window.removeEventListener("wheel", this.onWheel)

        const canvas = this.viewportSystem.camera.context.canvas
        if (canvas) {
            canvas.removeEventListener("mouseenter", this.onMouseEnter)
            canvas.removeEventListener("mouseleave", this.onMouseLeave)
            canvas.removeEventListener("contextmenu", ViewportInputHandler.onContextMenu)
        }

        this.heldKeys.clear()
        this.panVelocity[0] = 0
        this.panVelocity[1] = 0
        this.panVelocity[2] = 0
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const key = event.key

        if (allButtons.has(key)) {
            if (wasdButtons.has(key)) {
                this.cameraFollowSystem?.stopFollowing()
            }
            this.heldKeys.add(key)
            event.preventDefault()
        }
    }

    private onKeyUp = (event: KeyboardEvent) => {
        this.heldKeys.delete(event.key)
    }

    private onWheel = (event: WheelEvent) => {
        if (!this.viewportSystem.engineRef) return

        event.preventDefault()

        const { camera } = this.viewportSystem
        const rect = camera.context.canvas.getBoundingClientRect()
        this.lastWheelScreen = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        }

        this.wheelZoomAccum += event.deltaY
    }

    private mousedownArray: Queue<MousedownEvent> | null = null
    private mouseupArray: Queue<MouseupEvent> | null = null
    private mouseMovedArray: Queue<MousemoveEvent> | null = null

    update(dt: number) {
        if (!this.viewportSystem.engineRef) {
            return
        }

        this._isZooming = false

        const camera = this.viewportSystem.camera

        this.updatePointerPosition()
        this.handleDragStart()
        this.handleDragMove(camera)
        this.handleDragEnd()

        if (!this._isDragging && this.wasRotatingWithoutTarget) {
            this.applyRotationInertia(camera)
        }

        this.applyKeyScroll(dt, camera)
        this.applyEdgePan(dt, camera)
        this.applyPanVelocity(dt, camera)
        this.applyWheelZoom(camera)
    }

    private updatePointerPosition() {
        for (const { data } of this.mouseMovedArray!) {
            this.pointer = { x: data.x, y: data.y }
        }
    }

    private handleDragStart() {
        for (const { data } of this.mousedownArray!) {
            const button = data.button
            if (button === 2 || button === 1) {
                this._isDragging = true
                this.dragButton = button
                this.lastPointer = { x: data.x, y: data.y }
                this.dragMoved = false
                this.rotationVelocityX = 0
                this.rotationVelocityY = 0
                this.wasRotatingWithoutTarget = false
                getPlatform().document.body.style.cursor = button === 2 ? "grab" : "move"
            }
        }
        this.mousedownArray?.clear()
    }

    private handleDragMove(camera: Camera) {
        if (!this._isDragging || !this.lastPointer || this.dragButton === null) return

        for (const { data } of this.mouseMovedArray!) {
            const dx = data.x - this.lastPointer.x
            const dy = data.y - this.lastPointer.y
            if (dx || dy) {
                if (this.dragButton === 2) {
                    camera.panByPixels(dx, dy)
                } else if (this.dragButton === 1) {
                    if (this.hasFollowTarget) {
                        camera.yaw -= dx * ViewportInputHandler.MOUSE_ROTATE_SPEED
                        camera.pitch = Math.max(0.05, Math.min(Math.PI / 2, camera.pitch - dy * ViewportInputHandler.MOUSE_ROTATE_SPEED))

                        camera.invalidateViewBasis()
                    } else {
                        ViewportInputHandler.applyOrbitRotation(camera, dx, dy)
                        this.wasRotatingWithoutTarget = true
                    }
                    this.rotationVelocityX = dx
                    this.rotationVelocityY = dy
                }
                if (Math.abs(dx) > ViewportInputHandler.DRAG_THRESHOLD || Math.abs(dy) > ViewportInputHandler.DRAG_THRESHOLD) {
                    this.dragMoved = true
                }
                this.lastPointer = { x: data.x, y: data.y }
            }
        }
    }

    private handleDragEnd() {
        let released = false
        for (const { data } of this.mouseupArray!) {
            if (data.button === this.dragButton) {
                released = true
                break
            }
        }
        if (released) {
            this._isDragging = false
            this.dragButton = null
            this.lastPointer = null
            this.dragMoved = false
            getPlatform().document.body.style.cursor = "default"
        }
        this.mouseupArray?.clear()
    }

    private zoomWheel(camera: Camera, factor: number) {
        this._isZooming = true

        if (this.wheelZoomAccum > 0 && camera.lookAt[2] >= ViewportInputHandler.MAX_ZOOM) {
            return
        }
        if (this.wheelZoomAccum < 0 && camera.lookAt[2] <= ViewportInputHandler.MIN_ZOOM) {
            return
        }

        if (this.hasFollowTarget) {
            camera.zoomBy(factor, this.lastWheelScreen.x, this.lastWheelScreen.y)
        } else {
            this.viewportSystem.camera.moveTo(
                camera.lookAt[0],
                camera.lookAt[1],
                Math.max(ViewportInputHandler.MIN_ZOOM, Math.min(camera.lookAt[2] += this.wheelZoomAccum, ViewportInputHandler.MAX_ZOOM))
            )
        }
    }

    private applyWheelZoom(camera: Camera) {
        const step = ViewportInputHandler.WHEEL_ZOOM_STEP

        if (this.wheelZoomAccum >= step) {
            this.zoomWheel(camera, 1.02)
            this.wheelZoomAccum -= step
        } else if (this.wheelZoomAccum <= -step) {
            this.zoomWheel(camera, 0.98)
            this.wheelZoomAccum += step
        }
    }

    private applyRotationInertia(camera: Camera) {
        if (Math.abs(this.rotationVelocityX) > ViewportInputHandler.ROTATION_INERTIA_THRESHOLD ||
            Math.abs(this.rotationVelocityY) > ViewportInputHandler.ROTATION_INERTIA_THRESHOLD) {
            ViewportInputHandler.applyOrbitRotation(camera, this.rotationVelocityX, this.rotationVelocityY)
            this.rotationVelocityX *= ViewportInputHandler.ROTATION_INERTIA_DECAY
            this.rotationVelocityY *= ViewportInputHandler.ROTATION_INERTIA_DECAY
        } else {
            this.wasRotatingWithoutTarget = false
            this.rotationVelocityX = 0
            this.rotationVelocityY = 0
        }
    }
}
