import type { Modifier } from "@/engine/modifier";

export type TribalData = Readonly<{
    name: string;
    sign?: string;
    patronGod?: Modifier;
}>
