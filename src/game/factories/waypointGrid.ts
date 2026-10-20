import { TWO_PI } from "../constants"
import type { Entity } from "@/engine/entities/entity"

export interface Ring {
    radius: number
    waypointCount: number
    spread: number
}

export const DEFAULT_RINGS: Ring[] = [
    { radius: 100, waypointCount: 12, spread: TWO_PI },
    { radius: 300, waypointCount: 24, spread: TWO_PI },
    { radius: 600, waypointCount: 36, spread: TWO_PI },
    { radius: 1000, waypointCount: 48, spread: TWO_PI },
    { radius: 1500, waypointCount: 60, spread: TWO_PI },
    { radius: 2100, waypointCount: 72, spread: TWO_PI },
    { radius: 2800, waypointCount: 84, spread: TWO_PI },
] as const

export class WaypointGrid {
    readonly starId: string
    readonly starEntity: Entity
    readonly rings: Ring[]
    readonly waypoints: Map<string, Entity> = new Map()
    readonly attractors: Map<string, Entity> = new Map()

    constructor(starId: string, starEntity: Entity, rings: Ring[] = DEFAULT_RINGS) {
        this.starId = starId
        this.starEntity = starEntity
        this.rings = rings
    }

    static getKey(ringIdx: number, angleIdx: number): string {
        return `${ringIdx}:${angleIdx}`
    }

    getWaypoint(ringIdx: number, angleIdx: number): Entity | undefined {
        return this.waypoints.get(WaypointGrid.getKey(ringIdx, angleIdx))
    }

    getRingCount(): number {
        return this.rings.length
    }

    getAllWaypoints(): Entity[] {
        return Array.from(this.waypoints.values())
    }

    getAllAttractors(): Entity[] {
        return Array.from(this.attractors.values())
    }
}
