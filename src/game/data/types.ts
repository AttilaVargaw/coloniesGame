import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";
import { PlanetArchetype } from "../factories/helpers";
import type { WaypointGrid } from "../factories/waypointGrid";

export type VesselBlueprint = {
    readonly name: string
    readonly radius: number
    readonly orbit: OrbitBlueprint
}

export type OrbitBlueprint = {
    readonly radius: number
    readonly eccentricity?: number
    readonly angle?: number
}

export type TribalData = {
    readonly name: string
    readonly sign?: string;
    readonly patronGod?: Modifier;
    readonly population: number;
}

export type BodyBlueprint = {
    readonly tribe?: TribalData
    readonly name: string
    readonly radius: number
    readonly archetype: PlanetArchetype
    readonly children?: BodyBlueprint[]
    readonly vessels?: VesselBlueprint[]
    // readonly angle: number
    readonly color: string
    readonly binaryPairs?: { bodies: [BodyBlueprint, BodyBlueprint], separation: number, orbit: OrbitBlueprint }[]
    readonly orbit: OrbitBlueprint
}

// export type Star = {
//     sign: string
//     x: number
//     y: number
//     name: string,
//     planets: Map<string, Colony>
//     soi?: number
//     color: string
// }

export const StartState = {
    map: {
        waypoints: new Map<string, Entity>(),
        attractors: new Map<string, Entity>(),
        grids: new Map<string, WaypointGrid>(),
    },
} as const
