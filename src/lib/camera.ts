import { Vector2 } from "./Vector2"
import { Vector3 } from "./Vector3"

export interface ProjectedPoint {
    x: number
    y: number
    scale: number
    depth: number
}

interface CameraSettings {
    distance?: number
    initialPosition?: Vector3
    yaw?: number
    pitch?: number
    fieldOfView?: number
    scaleX?: number
    scaleY?: number
    minDistance?: number
    maxDistance?: number
    minHeightAboveTarget?: number
}

type ViewBase = {
    fx: number
    fy: number
    fz: number
    rx: number
    ry: number
    rz: number
    ux: number
    uy: number
    uz: number
    camX: number
    camY: number
    camZ: number
}

export default class Camera {
    lookAt: Vector3
    yaw: number
    pitch: number
    distance: number
    fieldOfView: number
    minDistance: number
    maxDistance: number
    minHeightAboveTarget: number
    public aspectRatio: number = 1.0
    private targetDistance: number

    private viewport: {
        left: number
        right: number
        top: number
        bottom: number
        width: number
        height: number
        scale: Vector2
        cssWidth: number
        cssHeight: number
    }

    constructor(
        settings: CameraSettings = {},
        public context: CanvasRenderingContext2D,
    ) {
        this.distance = settings.distance ?? 1000.0
        this.minDistance = settings.minDistance ?? 100.0
        this.maxDistance = settings.maxDistance ?? 12000.0
        this.minHeightAboveTarget = settings.minHeightAboveTarget ?? 20.0
        this.lookAt = settings.initialPosition ?? [0, 1, 0]
        this.yaw = settings.yaw ?? 0
        this.pitch = settings.pitch ?? 0
        this.fieldOfView = settings.fieldOfView ?? Math.PI / 4.0
        this.targetDistance = this.distance
        this.viewport = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            scale: [settings.scaleX || 1.0, settings.scaleY || 1.0],
            cssWidth: 0,
            cssHeight: 0,
        }
        this.init()
    }

    private init() {
        this.updateViewport()
    }

    private viewBasisCache: ViewBase | null = null

    private viewBasisDirty = true

    private markViewDirty() {
        this.viewBasisDirty = true
    }

    private ensureViewBasis() {
        if(!this.viewBasisDirty && this.viewBasisCache) {
            return this.viewBasisCache
        }

        const cosPitch = Math.cos(this.pitch)
        const sinPitch = Math.sin(this.pitch)
        const cosYaw = Math.cos(this.yaw)
        const sinYaw = Math.sin(this.yaw)

        const camX = this.lookAt[0] + this.distance * cosPitch * sinYaw
        const camY = this.lookAt[1] + this.distance * cosPitch * cosYaw
        const camZ = this.lookAt[2] + this.distance * sinPitch

        let fx = this.lookAt[0] - camX
        let fy = this.lookAt[1] - camY
        let fz = this.lookAt[2] - camZ
        const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz)
        fx /= fLen
        fy /= fLen
        fz /= fLen

        const worldUp = [0, 1, 0]

        let rx: number
        let ry: number
        let rz: number

        if(Math.abs(fx * worldUp[0] + fy * worldUp[1] + fz * worldUp[2]) > 0.9999) {
            rx = 1
            ry = 0
            rz = 0
        } else {
            rx = fy * worldUp[2] - fz * worldUp[1]
            ry = fz * worldUp[0] - fx * worldUp[2]
            rz = fx * worldUp[1] - fy * worldUp[0]
            const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz)
            rx /= rLen
            ry /= rLen
            rz /= rLen
        }

        const ux = ry * fz - rz * fy
        const uy = rz * fx - rx * fz
        const uz = rx * fy - ry * fx

        this.viewBasisCache = { fx, fy, fz, rx, ry, rz, ux, uy, uz, camX, camY, camZ }
        this.viewBasisDirty = false

        return this.viewBasisCache
    }

    private computeViewBasis() {
        return this.ensureViewBasis()
    }

    begin() {
        this.context.save()

        this.applyScale()
        this.applyTranslation()
    }

    end() {
        this.context.restore()
    }

    private applyScale() {
        this.context.scale(this.viewport.scale[0], this.viewport.scale[1])
    }

    private applyTranslation() {
        this.context.translate(-this.viewport.left, -this.viewport.top)
    }

    public updateViewport() {
        this.aspectRatio = this.context.canvas.width / this.context.canvas.height
        this.viewport.width = this.distance * Math.tan(this.fieldOfView)
        this.viewport.height = this.viewport.width / this.aspectRatio
        this.viewport.left = this.lookAt[0] - (this.viewport.width / 2.0)
        this.viewport.top = this.lookAt[1] - (this.viewport.height / 2.0)
        this.viewport.right = this.viewport.left + this.viewport.width
        this.viewport.bottom = this.viewport.top + this.viewport.height
        this.viewport.scale[0] = this.context.canvas.width / this.viewport.width
        this.viewport.scale[1] = this.context.canvas.height / this.viewport.height
        this.viewport.cssWidth = this.context.canvas.clientWidth || this.context.canvas.width
        this.viewport.cssHeight = this.context.canvas.clientHeight || this.context.canvas.height
        this.markViewDirty()
    }

    public get cssWidth(): number {
        return this.viewport.cssWidth
    }

    public get cssHeight(): number {
        return this.viewport.cssHeight
    }

    public get cameraPosition(): Vector3 {
        return [
            this.lookAt[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
            this.lookAt[1] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
            this.lookAt[2] + this.distance * Math.sin(this.pitch),
        ]
    }

    public get viewBasis() {
        return this.computeViewBasis()
    }

    public zoomTo(z: number) {
        const effectiveMin = this.minHeightAboveTarget / Math.sin(this.pitch)
        this.targetDistance = Math.min(this.maxDistance, Math.max(effectiveMin, z))
        this.updateViewport()
        this.markViewDirty()
    }

    public updateSmoothZoom(dt: number) {
        if(Math.abs(this.distance - this.targetDistance) > 0.01) {
            const t = 1 - Math.pow(0.02, dt / 16.667)
            this.distance += (this.targetDistance - this.distance) * t
            this.updateViewport()
            this.markViewDirty()
        } else if(this.distance !== this.targetDistance) {
            this.distance = this.targetDistance
            this.updateViewport()
            this.markViewDirty()
        }
    }

    public zoomToAnchored(z: number, screenX: number, screenY: number) {
        const before = this.screenToWorld(screenX, screenY)
        this.zoomTo(z)
        const after = this.screenToWorld(screenX, screenY)
        this.moveTo(
            this.lookAt[0] + (before.x - after.x),
            this.lookAt[1] + (before.y - after.y),
            this.lookAt[2]
        )
    }

    public zoomBy(factor: number, screenX: number, screenY: number) {
        this.zoomToAnchored(this.distance * factor, screenX, screenY)
    }

    public panByPixels(dxPixels: number, dyPixels: number) {
        const f = this.viewport.cssHeight / (2 * Math.tan(this.fieldOfView / 2))
        const worldDeltaRight = (dxPixels / f) * this.distance
        const worldDeltaForward = (-dyPixels / f) * this.distance
        const { fx, fy, fz, rx, ry, rz } = this.viewBasis
        this.moveTo(
            this.lookAt[0] + worldDeltaRight * rx + worldDeltaForward * fx,
            this.lookAt[1] + worldDeltaRight * ry + worldDeltaForward * fy,
            this.lookAt[2] + worldDeltaRight * rz + worldDeltaForward * fz,
        )
    }

    moveTo(x: number, y: number, z: number) {
        this.lookAt[0] = x
        this.lookAt[1] = y
        this.lookAt[2] = z
        this.updateViewport()
        this.markViewDirty()
    }

    public invalidateViewBasis() {
        this.markViewDirty()
    }

    public get visibleBounds() {
        return {
            left: 0,
            right: this.viewport.cssWidth,
            top: 0,
            bottom: this.viewport.cssHeight,
        }
    }

    public screenToWorld(x: number, y: number, obj: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
        const ray = this.screenToWorldRay(x, y)
        const [dx, dy, dz] = ray.direction
        const t = (this.lookAt[2] - ray.origin[2]) / dz
        obj.x = ray.origin[0] + dx * t
        obj.y = ray.origin[1] + dy * t
        obj.z = this.lookAt[2]
        return obj
    }

    public worldToScreen(x: number, y: number, z = 0, obj: { x: number; y: number } = { x: 0, y: 0 }) {
        const projected = this.project(x, y, z)
        if(projected) {
            obj.x = projected.x
            obj.y = projected.y
        }
        return obj
    }

    public getBasisVectors(): { right: Vector3; up: Vector3 } {
        const { rx, ry, rz, ux, uy, uz } = this.computeViewBasis()

        return {
            right: [rx, ry, rz],
            up: [ux, uy, uz],
        }
    }

    private computeCameraPosition(): { camX: number; camY: number; camZ: number } {
        return {
            camX: this.lookAt[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
            camY: this.lookAt[1] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
            camZ: this.lookAt[2] + this.distance * Math.sin(this.pitch),
        }
    }

    public project(wx: number, wy: number, wz: number): ProjectedPoint | null {
        const { fx, fy, fz, rx, ry, rz, ux, uy, uz } = this.computeViewBasis()
        const { camX, camY, camZ } = this.computeCameraPosition()

        const vx = wx - camX
        const vy = wy - camY
        const vz = wz - camZ

        const x = vx * rx + vy * ry + vz * rz
        const y = vx * ux + vy * uy + vz * uz
        const z = vx * fx + vy * fy + vz * fz

        if(z <= 0.01) {
            return null
        }

        const f = this.viewport.cssHeight / (2 * Math.tan(this.fieldOfView / 2))
        const screenX = (x / z) * f + this.viewport.cssWidth / 2
        const screenY = -(y / z) * f + this.viewport.cssHeight / 2
        const scale = f / z

        return { x: screenX, y: screenY, scale, depth: z }
    }

    public screenToWorldRay(screenX: number, screenY: number): { origin: Vector3; direction: Vector3 } {
        const { fx, fy, fz, rx, ry, rz, ux, uy, uz } = this.computeViewBasis()
        const { camX, camY, camZ } = this.computeCameraPosition()

        const f = this.viewport.cssHeight / (2 * Math.tan(this.fieldOfView / 2))

        const ndcX = (screenX - this.viewport.cssWidth / 2) / f
        const ndcY = -(screenY - this.viewport.cssHeight / 2) / f

        const dirX = rx * ndcX + ux * ndcY + fx
        const dirY = ry * ndcX + uy * ndcY + fy
        const dirZ = rz * ndcX + uz * ndcY + fz
        const dLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ)

        return {
            origin: [camX, camY, camZ],
            direction: [dirX / dLen, dirY / dLen, dirZ / dLen],
        }
    }
}
