import { Entity } from "@engine/entities/entity"
import { SystemWithNodes } from "@game/systems/system"
import { TargetableNode } from "../../engine/systems/targetNode"
import { TargetableComponent } from "@/engine/components/targetableComponent"
import { MapSystem } from "./mapSystem"
import { JumpDriveComponent } from "@/game/components/vessel"
import { setShipPath, clearShipPath } from "@/game/systems/moveSystem"
import { TargetChangedEvent } from "@/engine/lib/events"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { Engine } from "@/engine/core/engine"

export class TargetSystem extends SystemWithNodes<TargetableNode> {
    protected updateNode(_node: TargetableNode, _dt?: number): void {
    }

    protected registerNodes(engine: Engine): this {
        engine.registerNodeType(TargetableNode, new Set([TargetableComponent]), (entity) =>
            new TargetableNode(
                entity,
                entity.getComponent(TargetableComponent)!,
            )
        )

        return this
    }

    protected unregisterNodeTypes(): this {
        this.engine?.unregisterNodeType(TargetableNode)

        return this
    }

    setTarget(ship: Entity, target: Entity, clickX?: number, clickY?: number) {
        if(!this.engine) return
        if(!target.getComponent(TargetableComponent)) return

        const drive = this.applyTarget(ship, target)

        if(clickX !== undefined && clickY !== undefined && drive) {
            drive.clickX = clickX
            drive.clickY = clickY
        }

        this.engine.dispatchEvent(new TargetChangedEvent({ ship, target }))
    }

    setTargetForOrbitSelection(ship: Entity, target: Entity, _worldX?: number, _worldY?: number) {
        if(!this.engine) return
        if(!target.getComponent(TargetableComponent)) return

        const drive = this.applyTarget(ship, target)
        if(drive) {
            drive.isOrbitSelecting = true
            drive.target = target
        }

        this.engine.dispatchEvent(new TargetChangedEvent({ ship, target }))
    }

    private applyTarget(ship: Entity, target: Entity): JumpDriveComponent | undefined {
        if (!this.engine) return undefined

        const mapSystem = this.engine.getSystem(MapSystem)
        if (!mapSystem) return undefined

        const jumpPath = mapSystem.findJumpPath(ship, target)

        if (jumpPath && jumpPath.length > 1) {
            setShipPath(ship, jumpPath)
            const drive = ship.getComponent(JumpDriveComponent)
            return drive
        }

        const selectionSceneNode = this.engine.getSceneNode(ship)
        if (!selectionSceneNode?.parent?.entity) return undefined

        const path = mapSystem.findPath(selectionSceneNode.parent.entity, target)

        if(path && path.length > 1) {
            setShipPath(ship, path)
        } else {
            const drive = ship.getComponent(JumpDriveComponent)
            if(drive) {
                drive.target = target
            }
            return ship.getComponent(JumpDriveComponent)
        }

        const drive = ship.getComponent(JumpDriveComponent)
        return drive
    }

    clearTarget(ship: Entity) {
        if(!this.engine) return

        clearShipPath(ship)
        const drive = ship.getComponent(JumpDriveComponent)
        if(drive) {
            drive.target = undefined
        }

        this.engine.dispatchEvent(new TargetChangedEvent({ ship, target: undefined }))
    }

    findNearestTarget(ship: Entity, worldX: number, worldY: number): Entity | undefined {
        if(!this.engine) return undefined

        let bestDist = Infinity
        let bestEntity: Entity | undefined

        for(const node of this.nodes) {
            if(node.entity === ship) continue
            const [ex, ey] = getAbsolute(node.entity, this.engine!)
            const dist = Math.hypot(ex - worldX, ey - worldY)
            if(dist < bestDist) {
                bestDist = dist
                bestEntity = node.entity
            }
        }

        return bestEntity
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.nodes = engine.getNodeList(TargetableNode)

        return this
    }

    removeFromEngine(): this {
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }
}
