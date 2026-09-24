import { System } from "./system"
import { Engine } from "@/engine/core/engine"
import { DayPassedEvent } from "@/engine/lib/events"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { PositionComponent } from "@engine/components/position"
import { JumpNodeComponent, JumpGraphComponent } from "@game/components/jumpGraph"
import { JUMP_GRAPH_MAX_DISTANCE } from "../constants"
import { jumpAStar } from "../utils/jumpPathfinder"
import type { Entity } from "@engine/entities/entity"

export class JumpGraphSystem extends System {
    private graphEntity?: Entity
    private graph?: JumpGraphComponent

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.engine = engine

        engine.subscribe(DayPassedEvent, this.rebuildGraph)

        this.createGraphEntity()

        return this
    }

    removeFromEngine(): this {
        this.engine?.unsubscribe(DayPassedEvent, this.rebuildGraph)
        if(this.graphEntity && this.engine) {
            this.engine.removeEntity(this.graphEntity)
            this.graphEntity = undefined
        }
        super.removeFromEngine()
        return this
    }

    private createGraphEntity() {
        if(!this.engine) return
        this.graphEntity = this.engine.createEntity("jumpGraph")
            .addComponent(new JumpGraphComponent())
        this.engine.addEntity(this.graphEntity)
        this.graph = this.graphEntity.getComponent(JumpGraphComponent)!
    }

    private getWorldPosition(entity: Entity): { x: number, y: number } | undefined {
        if(!this.engine) return undefined
        const position = entity.getComponent(PositionComponent)
        if(!position) return undefined
        const [x, y] = getAbsolute(entity, this.engine)
        return { x, y }
    }

    private collectJumpNodes(): { entity: Entity; x: number, y: number }[] {
        if(!this.engine) return []
        const allEntities = this.engine.getAllEntities()
        const jumpNodes: { entity: Entity; x: number, y: number }[] = []

        for(const entity of allEntities) {
            const jumpNode = entity.getComponent(JumpNodeComponent)
            const pos = this.getWorldPosition(entity)
            if(jumpNode && pos) {
                jumpNodes.push({ entity, ...pos })
            }
        }

        return jumpNodes
    }

    rebuildGraph = () => {
        if(!this.engine || !this.graph) return

        this.graph.clear()

        const jumpNodes = this.collectJumpNodes()

        for(let i = 0; i < jumpNodes.length; i++) {
            for(let j = i + 1; j < jumpNodes.length; j++) {
                const a = jumpNodes[i]
                const b = jumpNodes[j]

                const dx = a.x - b.x
                const dy = a.y - b.y
                const dist = Math.hypot(dx, dy)

                if(dist < JUMP_GRAPH_MAX_DISTANCE) {
                    this.graph.addEdge(a.entity, b.entity)
                    this.graph.addEdge(b.entity, a.entity)
                }
            }
        }
    }

    findJumpPath(start: Entity, end: Entity): Entity[] {
        if(!this.graph || !this.engine) return []

        const startPos = this.getWorldPosition(start)
        const endPos = this.getWorldPosition(end)
        if(!startPos || !endPos) return []

        const jumpNodes = this.collectJumpNodes()

        if(jumpNodes.length === 0) return []

        let nearestStart: { node: Entity; dist: number } | undefined
        let nearestEnd: { node: Entity; dist: number } | undefined

        for(const { entity, x, y } of jumpNodes) {
            const distToStart = Math.hypot(x - startPos.x, y - startPos.y)
            const distToEnd = Math.hypot(x - endPos.x, y - endPos.y)

            if(!nearestStart || distToStart < nearestStart.dist) {
                nearestStart = { node: entity, dist: distToStart }
            }
            if(!nearestEnd || distToEnd < nearestEnd.dist) {
                nearestEnd = { node: entity, dist: distToEnd }
            }
        }

        if(!nearestStart || !nearestEnd) return []

        if(nearestStart.node === nearestEnd.node) {
            return [start, nearestStart.node, end]
        }

        const path = jumpAStar(
            nearestStart.node,
            nearestEnd.node,
            this.graph,
            (entity) => this.getWorldPosition(entity)
        )
        if(path.length === 0) return []

        return [start, ...path, end]
    }
}