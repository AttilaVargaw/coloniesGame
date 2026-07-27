import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";
import { PlanetArchetype } from "../factories/helpers";
import type { WaypointGrid } from "../factories/waypointGrid";

export type MapMarker = {
    readonly radius: number
    readonly color: string
    readonly label: string
    readonly labelColor?: string
    readonly textSize?: number
}

export type ObitingBodyBlueprint = {
    readonly orbit: OrbitBlueprint
    marker: MapMarker
    readonly archetype: PlanetArchetype
    readonly children?: HomeworldBlueprint[]
    readonly vessels?: VesselBlueprint[]
    readonly binaryPairs?: { bodies: [HomeworldBlueprint, HomeworldBlueprint], separation: number, orbit: OrbitBlueprint }[]
    readonly population: number;
}

export type VesselBlueprint = {
    marker: MapMarker
    orbit: OrbitBlueprint
}

export type TribalData = {
    readonly name: string
    readonly sign?: string;
    readonly patronGod?: Modifier;
}

export type HomeworldBlueprint = {
    readonly tribe?: TribalData
} & ObitingBodyBlueprint

export type OrbitBlueprint = {
    readonly radius: number
    readonly eccentricity?: number
    readonly angle?: number
}

export const StartState = {
    map: {
        waypoints: new Map<string, Entity>(),
        attractors: new Map<string, Entity>(),
        grids: new Map<string, WaypointGrid>(),
    },
} as const
