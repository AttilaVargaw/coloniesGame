import { System } from "@engine/systems/system"
import { ViewportSystem } from "@engine/systems/viewportSystem/viewportSystem"
import { JumpDriveComponent } from "@/game/components/vessel"
import { ClickEventData, KeydownEvent } from "@/engine/lib/events"
import type { Engine } from "@/engine/core/engine"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { SoiComponent } from "@engine/components/soiComponent"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { TWO_PI } from "@/game/constants"
import { SelectionManager } from "@game/systems/selectionSystem"
import Camera from "@lib/camera"
import { Entity } from "@engine/entities/entity"

export class OrbitSelectionSystem extends System {
    private selection: { ship: Entity, target: Entity, cx: number, cy: number, minRadius: number, maxRadius: number } | null = null
    private mouseX = 0
    private mouseY = 0

    constructor(private viewport?: ViewportSystem) {
        super()
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        engine.subscribe(KeydownEvent, this.onKeydown)

        document.addEventListener("mousemove", this.onMouseMove)

        return this
    }

    removeFromEngine(): this {
        if(this.engine) {
            document.removeEventListener("mousemove", this.onMouseMove)
            this.engine.unsubscribe(KeydownEvent, this.onKeydown as (data: unknown) => void)
        }
        this.selection = null
        this.viewport = undefined
        super.removeFromEngine()
        return this
    }

    private onMouseMove = (data: { clientX: number, clientY: number }) => {
        if(!this.viewport || !this.viewport.camera) return
        const rect = this.viewport!.camera.context.canvas.getBoundingClientRect()

        this.mouseX = data.clientX - rect.left
        this.mouseY = data.clientY - rect.top
    }

    private onKeydown = ({ key }: { key: string; preventDefault(): void }) => {
        if(key === "Escape" && this.selection) {
            this.cancelOrbitSelection()
        }
    }

    cancelOrbitSelection() {
        if(!this.selection) return
        const { ship } = this.selection
        const drive = ship.getComponent(JumpDriveComponent)
        if(drive) {
            drive.isOrbitSelecting = false
        }
        this.selection = null
    }

    confirmOrbitSelection() {
        if(!this.selection || !this.engine || !this.viewport || !this.viewport.camera) return
        const { ship, target } = this.selection

        const drive = ship.getComponent(JumpDriveComponent)
        if(!drive) return

        drive.isOrbitSelecting = false

        const [cx, cy, cz] = getAbsolute(target, this.engine)
        const camera = this.viewport.camera
        const projected = camera.project(cx, cy, cz)
        if(!projected) return

        const screenDist = Math.hypot(this.mouseX - projected.x, this.mouseY - projected.y)
        const dist = screenDist / projected.scale
        const r = Math.max(this.selection.minRadius, Math.min(this.selection.maxRadius, dist))

        const theta = Math.atan2(this.mouseY - projected.y, this.mouseX - projected.x)

        drive.clickX = cx + r * Math.cos(theta)
        drive.clickY = cy + r * Math.sin(theta)

        this.selection = null
    }

    update(_dt: number): void {
        if(!this.engine || !this.viewport || !this.viewport.camera) return

        if(!this.selection) {
            this.detectOrbitSelection()
        }

        if(this.selection) {
            const { target, minRadius, maxRadius } = this.selection
            const drive = this.selection.ship.getComponent(JumpDriveComponent)
            if(!drive?.isOrbitSelecting) {
                this.selection = null
                return
            }

            const camera = this.viewport.camera
            const [cx, cy, cz] = getAbsolute(target, this.engine)
            const projected = camera.project(cx, cy, cz)
            if(!projected) {
                return
            }

            const screenDist = Math.hypot(this.mouseX - projected.x, this.mouseY - projected.y)
            const dist = screenDist / projected.scale
            const r = Math.max(minRadius, Math.min(maxRadius, dist))

            this.drawPreview(camera, target, r)
        }

        const clickQueue = this.engine.getEvents(ClickEventData)
        if(clickQueue?.length && this.selection) {
            for(const { data } of clickQueue) {
                if(!data.shiftKey) {
                    this.confirmOrbitSelection()
                }
            }
            clickQueue.clear()
        }
    }

    private detectOrbitSelection() {
        if(!this.engine) return
        const selectionSystem = this.engine.getSystem(SelectionManager)
        if(!selectionSystem) return
        const ship = selectionSystem.currentSelection
        if(!ship) return

        const drive = ship.getComponent(JumpDriveComponent)
        if(!drive?.isOrbitSelecting) return

        const target = drive.target
        if(!target) return

        const [cx, cy] = getAbsolute(target, this.engine)
        const soi = target.getComponent(SoiComponent)?.radius ?? 0
        const radius = target.getComponent(RadiusComponent)?.radius ?? 0
        const minRadius = radius + 30

        this.selection = {
            ship,
            target,
            cx,
            cy,
            minRadius,
            maxRadius: soi
        }
    }

    private drawPreview(camera: Camera, target: Entity, r: number) {
        if(!this.engine) {
            return
        }

        const ctx = camera.context
        const [cx, cy, cz] = getAbsolute(target, this.engine)
        const projected = camera.project(cx, cy, cz)
        if(!projected) {
            return
        }

        ctx.save()
        ctx.strokeStyle = "rgba(255, 255, 100, 0.6)"
        ctx.lineWidth = 4
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.arc(projected.x, projected.y, r * projected.scale, 0, TWO_PI)
        ctx.stroke()
        ctx.restore()
    }
}
