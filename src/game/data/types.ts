import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";
import { soiRatios } from "../factories/helpers";
import type { WaypointGrid } from "../factories/waypointGrid";

export type Vessel = {
    readonly name: string
    readonly radius: number
    readonly orbitRadius: number
    readonly angle?: number
}

export type Colony = {
    readonly population?: number;
    readonly sign?: string;
    readonly patronGod?: Modifier;
    readonly name: string
    readonly distanceFromParent: number
    readonly radius: number
    readonly soi?: number
    readonly archetype: keyof typeof soiRatios
    readonly eccentricity?: number
    readonly moons?: ReadonlyMap<string, Colony>
    readonly vessels?: Vessel[]
    readonly angle?: number
    readonly color: string
}

export type Star = {
    sign: string
    x: number
    y: number
    name: string,
    planets: Map<string, Colony>
    soi?: number
    binaryPairs?: ReadonlyMap<string, number>
    color: string
}

export const StartState = {
    map: {
        waypoints: new Map<string, Entity>(),
        attractors: new Map<string, Entity>(),
        grids: new Map<string, WaypointGrid>(),
    },
} as const
