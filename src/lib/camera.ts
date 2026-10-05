import { mat4, vec2, vec3 } from "gl-matrix"

export interface ProjectedPoint {
    x: number
    y: number
    scale: number
    depth: number
}

interface CameraSettings {
    distance?: number
    initialPosition?: vec3
    yaw?: number
    pitch?: number
    fieldOfView?: number
    scaleX?: number
    scaleY?: number
    minDistance?: number
    maxDistance?: number
    minHeightAboveTarget?: number
}

interface ViewBasis {
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
    lookAt: vec3
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
        scale: vec2
        cssWidth: number
        cssHeight: number
    }

    private viewMatrix = mat4.create()
    private viewBasisCache: ViewBasis | null = null
    private viewBasisDirty = true

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
        this.pitch = settings.pitch ?? Math.PI / 3.0
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
        this.updateViewport()
    }

    private invalidateView() {
        this.viewBasisDirty = true
        this.updateViewport()
    }

    private ensureViewBasis(): ViewBasis {
        if(!this.viewBasisDirty && this.viewBasisCache) {
            return this.viewBasisCache
        }

        const camPos: vec3 = [
            this.lookAt[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
            this.lookAt[1] + this.distance * Math.sin(this.pitch),
            this.lookAt[2] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
        ]

        mat4.lookAt(this.viewMatrix, camPos, this.lookAt, [0, 1, 0])

        this.viewBasisCache = {
            fx: -this.viewMatrix[2],
            fy: -this.viewMatrix[6],
            fz: -this.viewMatrix[10],
            rx: this.viewMatrix[0],
            ry: this.viewMatrix[4],
            rz: this.viewMatrix[8],
            ux: this.viewMatrix[1],
            uy: this.viewMatrix[5],
            uz: this.viewMatrix[9],
            camX: camPos[0],
            camY: camPos[1],
            camZ: camPos[2],
        }
        this.viewBasisDirty = false
        return this.viewBasisCache
    }

    begin() {
        this.context.save()
        this.context.scale(this.viewport.scale[0], this.viewport.scale[1])
        this.context.translate(-this.viewport.left, -this.viewport.top)
    }

    end() {
        this.context.restore()
    }

    public updateViewport() {
        this.aspectRatio = this.context.canvas.width / this.context.canvas.height
        this.viewport.width = this.distance * Math.tan(this.fieldOfView)
        this.viewport.height = this.viewport.width / this.aspectRatio
        this.viewport.left = this.lookAt[0] - this.viewport.width / 2
        this.viewport.top = this.lookAt[1] - this.viewport.height / 2
        this.viewport.right = this.viewport.left + this.viewport.width
        this.viewport.bottom = this.viewport.top + this.viewport.height
        this.viewport.scale[0] = this.context.canvas.width / this.viewport.width
        this.viewport.scale[1] = this.context.canvas.height / this.viewport.height
        this.viewport.cssWidth = this.context.canvas.clientWidth || this.context.canvas.width
        this.viewport.cssHeight = this.context.canvas.clientHeight || this.context.canvas.height
    }

    public get cssWidth(): number {
        return this.viewport.cssWidth
    }

    public get cssHeight(): number {
        return this.viewport.cssHeight
    }

    public get cameraPosition(): vec3 {
        const { camX, camY, camZ } = this.viewBasis
        return [camX, camY, camZ]
    }

    public get viewBasis() {
        return this.ensureViewBasis()
    }

    public zoomTo(z: number) {
        const effectiveMin = this.minHeightAboveTarget / Math.sin(this.pitch)
        this.targetDistance = Math.min(this.maxDistance, Math.max(effectiveMin, z))
        this.invalidateView()
    }

    public updateSmoothZoom(dt: number) {
        if(Math.abs(this.distance - this.targetDistance) > 0.01) {
            const t = 1 - Math.pow(0.02, dt / 16.667)
            this.distance += (this.targetDistance - this.distance) * t
            this.invalidateView()
        } else if(this.distance !== this.targetDistance) {
            this.distance = this.targetDistance
            this.invalidateView()
        }
    }

    public zoomToAnchored(z: number, screenX: number, screenY: number) {
        const before = this.screenToWorld(screenX, screenY)
        this.zoomTo(z)
        const after = this.screenToWorld(screenX, screenY)
        this.lookAt[0] += before.x - after.x
        this.lookAt[1] += before.y - after.y
        this.invalidateView()
    }

    public zoomBy(factor: number, screenX: number, screenY: number) {
        this.zoomToAnchored(this.distance * factor, screenX, screenY)
    }

    public panByPixels(dxPixels: number, dyPixels: number) {
        const f = this.viewport.cssHeight / (2 * Math.tan(this.fieldOfView / 2))
        const worldDeltaRight = (dxPixels / f) * this.distance
        const worldDeltaForward = (-dyPixels / f) * this.distance
        const { fx, fy, fz, rx, ry, rz } = this.viewBasis
        this.lookAt[0] += worldDeltaRight * rx + worldDeltaForward * fx
        this.lookAt[1] += worldDeltaRight * ry + worldDeltaForward * fy
        this.lookAt[2] += worldDeltaRight * rz + worldDeltaForward * fz
        this.invalidateView()
    }

    public moveTo(x: number, y: number, z: number) {
        this.lookAt[0] = x
        this.lookAt[1] = y
        this.lookAt[2] = z
        this.invalidateView()
    }

    public invalidateViewBasis() {
        this.viewBasisDirty = true
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
        const projected = this.project([x, y, z])
        if(projected) {
            obj.x = projected.x
            obj.y = projected.y
        }
        return obj
    }

    public getBasisVectors(): { right: vec3; up: vec3 } {
        const { rx, ry, rz, ux, uy, uz } = this.viewBasis
        return {
            right: [rx, ry, rz],
            up: [ux, uy, uz],
        }
    }

    project([wx, wy, wz]: vec3): ProjectedPoint | null {
        const { fx, fy, fz, rx, ry, rz, ux, uy, uz, camX, camY, camZ } = this.viewBasis

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

    public screenToWorldRay(screenX: number, screenY: number): { origin: vec3; direction: vec3 } {
        const { fx, fy, fz, rx, ry, rz, ux, uy, uz, camX, camY, camZ } = this.viewBasis

        const f = this.viewport.cssHeight / (2 * Math.tan(this.fieldOfView / 2))

        const ndcX = (screenX - this.viewport.cssWidth / 2) / f
        const ndcY = -(screenY - this.viewport.cssHeight / 2) / f

        const dirX = rx * ndcX + ux * ndcY + fx
        const dirY = ry * ndcX + uy * ndcY + fy
        const dirZ = rz * ndcX + uz * ndcY + fz
        const direction = vec3.normalize(vec3.create(), [dirX, dirY, dirZ])

        return {
            origin: [camX, camY, camZ],
            direction,
        }
    }
}
