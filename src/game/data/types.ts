import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";
import { PlanetArchetype } from "../factories/helpers";
import type { WaypointGrid } from "../factories/waypointGrid";
import { WorldPosition } from "@/engine/components/position";

export type MapMarker = {
    readonly radius: number
    readonly color: string
    readonly label?: string
    readonly labelColor?: string
    readonly textSize?: number
    readonly shade?: boolean
    readonly offset?: WorldPosition
}

export type OrbitalBlueprint = {
    readonly radius: number
    readonly eccentricity?: number
    readonly angle?: number
}

export type TribalData = {
    readonly name: string
    readonly sign?: string;
    readonly patronGod?: Modifier;
}

export type BodyBlueprint = {
    readonly population?: number
    readonly name: string
    readonly radius?: number
    readonly archetype: PlanetArchetype
    readonly color?: string
    readonly marker: MapMarker
    readonly orbit: OrbitalBlueprint
    //readonly tribe?: TribalData
    readonly children?: BodyBlueprint[]
    readonly vessels?: VesselBlueprint[]
    readonly binaryPairs?: { bodies: [BodyBlueprint, BodyBlueprint], separation: number, orbit: OrbitalBlueprint }[]
}

// export type HomeworldBlueprint = BodyBlueprint & {
//     readonly tribe: TribalData
// }

export type ObitingBodyBlueprint = BodyBlueprint

export type VesselBlueprint = {
    readonly marker: MapMarker
    readonly orbit: OrbitalBlueprint
}

export const StartState = {
    map: {
        waypoints: new Map<string, Entity>(),
        attractors: new Map<string, Entity>(),
        grids: new Map<string, WaypointGrid>(),
    },
} as const
