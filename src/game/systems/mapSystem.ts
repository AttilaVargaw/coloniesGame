import { World } from "@engine/core/world";
import { SystemWithNodes } from "./system";
import { PathNode } from "@game/components/pathComponent";
import { init } from "@game/factories/mapBuilder";
import { StartState } from "@game/data/types";
import type { Entity } from "@engine/entities/entity";
import { aStar } from "@game/utils/pathfinder";

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

    addToEngine(engine: World): this {
        super.addToEngine(engine)

        return this
    }

    findPath(start: Entity, end: Entity): Entity[] {
        return aStar(start, end)
    }

    init(mapSize: number) {
        if(!this.engine) return this

        init(this.engine, mapSize)

        return this
    }

    clear() {
        if(!this.engine) return this

        StartState.map.sectors.forEach(sector => {
            this.engine?.removeEntity(sector)
        })
        StartState.map.sectors.clear()

        return this
    }
}
