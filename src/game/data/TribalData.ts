import type { Modifier } from "@/engine/modifier";

export type TribalData = {
    readonly name: string;
    readonly sign?: string;
    readonly patronGod?: Modifier;
};
