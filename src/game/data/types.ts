import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";
import { PlanetArchetypes } from "../factories/helpers";

export type Colony = {
    readonly population?: number;
    readonly sign?: string;
    readonly patronGod?: Modifier;
    readonly name: string
    readonly distanceFromParent: number
    readonly radius: number
    readonly soi?: number
    readonly archetype: keyof typeof PlanetArchetypes
    readonly eccentricity?: number
    readonly moons?: ReadonlyMap<string, Colony>
}

export type Star = {
    sign: string
    x: number
    y: number
    name: string,
    planets: Map<string, Colony>
    soi?: number
    binaryPairs?: ReadonlyMap<string, number>
}

export const StartState = {
    map: { waypoints: new Map<string, Entity>(), attractors: new Map<string, Entity>() },
} as const
