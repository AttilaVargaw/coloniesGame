import { SystemWithNodes } from "./system";
import { PathComponent, PathNode } from "@game/components/pathComponent";
import { init } from "@game/factories/mapBuilder";
import { StartState } from "../data/StartState";
import type { Entity } from "@engine/entities/entity";
import { astar } from "@game/utils/pathfinder";
import { Engine } from "@/engine/core/engine";
import { DayPassedEvent } from "@/engine/lib/events";
import { getAbsolute } from "@/engine/lib/getAbsolute";
import { PositionComponent } from "@engine/components/position";
import { JumpNodeComponent, JumpGraphComponent } from "@game/components/jumpGraph";
import { JUMP_GRAPH_MAX_DISTANCE, JUMP_HOP_PENALTY } from "../constants";
import { createEntity } from "@/engine/lib/entityRegistry";
import { terminateTextureWorkerPool } from "../factories/textureWorkerPool";

export function findPath(start: Entity, end: Entity): Entity[] {
    const startPath = start.getComponent(PathComponent)
    const endPath = end.getComponent(PathComponent)

    if(!startPath || !endPath) {
        return []
    }

    const endPos = end.getComponent(PositionComponent)
    const h = (node: Entity): number => {
        const pos = node.getComponent(PositionComponent)
        if(!pos || !endPos) return Infinity
        return Math.hypot(pos.x - endPos.x, pos.y - endPos.y) / 100
    }

    return astar({
        start,
        end,
        getNeighbors: (node) => {
            const path = node.getComponent(PathComponent)
            if(!path) return []
            return path.connections.map((c) => c.entity).filter((e): e is Entity => e !== null && e !== undefined)
        },
        getCost: () => 1,
        heuristic: h,
    })
}

export class MapSystem extends SystemWithNodes<PathNode> {
    private graphEntity?: Entity
    private graph?: JumpGraphComponent

    // eslint-disable-next-line class-methods-use-this,no-empty-function
    protected updateNode(_node: PathNode, _dT?: number): void {
    }

    removeFromEngine() {
        if(!this.engine) {
            return this
        }

        this.engine.unsubscribe(DayPassedEvent, this.rebuildGraph)
        if(this.graphEntity) {
            this.engine.removeEntity(this.graphEntity)
            this.graphEntity = undefined
        }
        this.clear()
        super.removeFromEngine()

        return this
    }

    // eslint-disable-next-line class-methods-use-this,no-empty-function
    update(_dt: number): void {

    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        engine.subscribe(DayPassedEvent, this.rebuildGraph)
        this.createGraphEntity()

        return this
    }



    getJumpGraph(): JumpGraphComponent | undefined {
        return this.graph
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

        const path = astar({
            start: nearestStart.node,
            end: nearestEnd.node,
            getNeighbors: (entity) => this.graph!.getNeighbours(entity),
            getCost: (from, to) => {
                const fromPos = this.getWorldPosition(from)
                const toPos = this.getWorldPosition(to)
                if(!fromPos || !toPos) return Infinity
                return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y) + JUMP_HOP_PENALTY
            },
            heuristic: (entity) => {
                const pos = this.getWorldPosition(entity)
                if(!pos) return Infinity
                return Math.hypot(pos.x - endPos.x, pos.y - endPos.y)
            },
        })
        if(path.length === 0) return []

        return [start, ...path, end]
    }

    async init() {
        if(!this.engine) return this

        await init(this.engine)
        terminateTextureWorkerPool()

        return this
    }

    clear() {
        if(!this.engine) return this

        StartState.map.waypoints.forEach(waypoint => {
            this.engine?.removeEntity(waypoint)
        })
        StartState.map.waypoints.clear()

        StartState.map.attractors.forEach(attractor => {
            this.engine?.removeEntity(attractor)
        })
        StartState.map.attractors.clear()

        StartState.map.grids.forEach(grid => {
            grid.waypoints.clear()
            grid.attractors.clear()
        })
        StartState.map.grids.clear()

        return this
    }

    private createGraphEntity() {
        if(!this.engine) return
        this.graphEntity = createEntity("jumpGraph")
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
}
