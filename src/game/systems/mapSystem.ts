import { SystemWithNodes } from "./system";
import { PathNode } from "@game/components/pathComponent";
import { init } from "@game/factories/mapBuilder";
import { StartState } from "../data/StartState";
import type { Entity } from "@engine/entities/entity";
import { aStar } from "@game/utils/pathfinder";
import { Engine } from "@/engine/core/engine";
import { JumpGraphSystem } from "./jumpGraphSystem";

export class MapSystem extends SystemWithNodes<PathNode> {
    protected updateNode(_node: PathNode, _dT?: number): void {
    }
    removeFromEngine() {
        if(!this.engine) {
            return this
        }

        this.clear()
        super.removeFromEngine()

        return this
    }

    update(_dt: number): void {

    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)

        return this
    }

    findPath(start: Entity, end: Entity): Entity[] {
        return aStar(start, end)
    }

    findJumpPath(start: Entity, end: Entity): Entity[] {
        const jumpGraphSystem = this.engine?.getSystem(JumpGraphSystem)
        if (!jumpGraphSystem) return []
        return jumpGraphSystem.findJumpPath(start, end)
    }

    init() {
        if(!this.engine) return this

        return init(this.engine)
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
}
