export interface ProjectedPoint {
    x: number
    y: number
    scale: number
    depth: number
}

export default class Camera {
    lookAt: [number, number, number]
    yaw: number
    pitch: number
    distance: number
    fieldOfView: number
    minDistance: number
    maxDistance: number
    private aspectRatio: number = 1.0
    public context: CanvasRenderingContext2D

    private viewport: {
        left: number
        right: number
        top: number
        bottom: number
        width: number
        height: number
        scale: [number, number]
        cssWidth: number
        cssHeight: number
    }

    constructor(public renderingContext: CanvasRenderingContext2D, settings = {
        distance: 1000.0,
        initialPosition: [0, 0, 0] as [number, number, number],
        yaw: 0,
        pitch: Math.PI / 2,
        fieldOfView: Math.PI / 4.0,
        scaleX: 1.0,
        scaleY: 1.0,
        minDistance: 100.0,
        maxDistance: 12000.0,
    }) {
        this.context = renderingContext
        this.distance = settings.distance
        this.minDistance = settings.minDistance
        this.maxDistance = settings.maxDistance
        this.lookAt = settings.initialPosition
        this.yaw = settings.yaw
        this.pitch = settings.pitch
        this.fieldOfView = settings.fieldOfView
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

    private viewBasisCache: {
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
    } | null = null

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

        const worldUp = [0, 0, 1]

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

    private computeViewBasis(): { fx: number; fy: number; fz: number; rx: number; ry: number; rz: number; ux: number; uy: number; uz: number; camX: number; camY: number; camZ: number } {
        const basis = this.ensureViewBasis()
        return { ...basis }
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
    }

    public get cssWidth(): number {
        return this.viewport.cssWidth
    }

    public get cssHeight(): number {
        return this.viewport.cssHeight
    }

    public get cameraPosition(): [number, number, number] {
        return [
            this.lookAt[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
            this.lookAt[1] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
            this.lookAt[2] + this.distance * Math.sin(this.pitch),
        ]
    }

    public get viewBasis(): { fx: number; fy: number; fz: number; rx: number; ry: number; rz: number; ux: number; uy: number; uz: number } {
        const { fx, fy, fz, rx, ry, rz, ux, uy, uz } = this.computeViewBasis()
        return { fx, fy, fz, rx, ry, rz, ux, uy, uz }
    }

    public zoomTo(z: number) {
        this.distance = Math.min(this.maxDistance, Math.max(this.minDistance, z))
        this.updateViewport()
        this.markViewDirty()
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
        const worldDeltaUp = (-dyPixels / f) * this.distance

        const { right, up } = this.getBasisVectors()

        this.moveTo(
            this.lookAt[0] + worldDeltaRight * right[0] + worldDeltaUp * up[0],
            this.lookAt[1] + worldDeltaRight * right[1] + worldDeltaUp * up[1],
            this.lookAt[2] + worldDeltaRight * right[2] + worldDeltaUp * up[2],
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

    public getBasisVectors(): { right: [number, number, number]; up: [number, number, number] } {
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

    public screenToWorldRay(screenX: number, screenY: number): { origin: [number, number, number]; direction: [number, number, number] } {
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
