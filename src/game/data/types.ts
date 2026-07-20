import type { Entity } from "@engine/entities/entity";
import type { Modifier } from "@engine/modifier";

export type Colony = {
    readonly population?: number;
    readonly sign?: string;
    readonly patronGod?: Modifier;
    readonly name: string
    readonly radius: number
}

export type Star = {
    sign: string
    x: number
    y: number
    name: string,
    planets: Map<string, Colony>
}

export const StartState = {
    map: { sectors: new Map<string, Entity>() },
} as const
