import { World } from "../../core/world";
import { SystemWithNodes } from "../system";
import { OrbitNode } from "./orbitNode";
import { Entity } from "../../entities/entity";
import { DayPassedEvent } from "../../lib/events";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { PositionComponent } from "../../components/position";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { StartState } from "@game/data/types";
import { OrbitComponent } from "@/engine/components/orbitComponent";

const RING_RADIUS = 100
const MAX_RINGS = 12

function getExpectedRingRadius(orbitRadius: number): number {
    const ring = Math.max(1, Math.min(MAX_RINGS, Math.round(orbitRadius / RING_RADIUS)))
    return ring * RING_RADIUS
}

export class OrbitSystem extends SystemWithNodes<OrbitNode> {
    protected updateNode(_node: OrbitNode, _dT?: number): void { }

    protected registerNodes(engine: World): this {
        engine.registerNodeType(OrbitNode, new Set([OrbitComponent]), (entity) => {
            return new OrbitNode(entity,
                entity.getComponent(PositionComponent)!,
                entity.getComponent(OrbitComponent)!)
        })

        return this
    }

    protected unregisterNodeTypes(): this {
        if(!this.engine) {
            return this
        }

        this.engine.unregisterNodeType(OrbitNode)

        return this
    }

    addToEngine(engine: World): this {
        super.addToEngine(engine)

        this.engine = this.engine!.subscribe(
            DayPassedEvent,
            this.onDayPassed
        )

        this.nodes = this.engine!.getNodeList(OrbitNode)

        return this
    }

    removeFromEngine(): this {
        if(!this.engine) return this

        this.engine.unsubscribe(DayPassedEvent, this.onDayPassed)
        this.nodes.length = 0
        super.removeFromEngine()

        return this
    }

    private onDayPassed = (): void => {
        if(!this.engine) return

        for(const node of this.nodes) {
            const { orbit, entity } = node

            orbit.angle += 20 / Math.max(orbit.radius, 1)
            const twoPi = Math.PI * 2
            if(orbit.angle > twoPi || orbit.angle < -twoPi) {
                orbit.angle = orbit.angle % twoPi
            }

            const sceneNode = this.engine.getSceneNode(entity)
            const parentEntity = sceneNode?.parentRef?.entity
            let centerX = 0
            let centerY = 0
            if(parentEntity) {
                const [px, py] = getAbsolute(parentEntity, this.engine)
                centerX = px
                centerY = py
            }

            const worldX = centerX + Math.cos(orbit.angle) * orbit.radius
            const worldY = centerY + Math.sin(orbit.angle) * orbit.radius

            if(parentEntity) {
                this.snapToClosestSector(entity, worldX, worldY, parentEntity, orbit.radius)
            }
        }

        this.engine?.addCommand(new RedrawCommand())
    }

    private snapToClosestSector = (entity: Entity, worldX: number, worldY: number, parentEntity: Entity, orbitRadius: number): void => {
        if(!this.engine) return

        const expectedRadius = getExpectedRingRadius(orbitRadius)
        const [parentX, parentY] = getAbsolute(parentEntity, this.engine)

        let closestSector: Entity | null = null
        let closestDist = Infinity

        for(const [, sector] of StartState.map.sectors) {
            const pos = sector.getComponent(PositionComponent)!
            const dx = pos.x - parentX
            const dy = pos.y - parentY
            const sectorRadius = Math.sqrt(dx * dx + dy * dy)

            if(Math.abs(sectorRadius - expectedRadius) > RING_RADIUS * 0.5) {
                continue
            }

            const toX = pos.x - worldX
            const toY = pos.y - worldY
            const dist = toX * toX + toY * toY

            if(dist < closestDist) {
                closestDist = dist
                closestSector = sector
            }
        }

        if(closestSector) {
            const position = entity.getComponent(PositionComponent)!
            const sectorPos = closestSector.getComponent(PositionComponent)!

            position.x = sectorPos.x - parentX
            position.y = sectorPos.y - parentY

            this.engine.reindexEntity(entity)
        }
    }
}
