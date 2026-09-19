import { WorldPosition } from "@/engine/components/position";

export type MapMarker = Readonly<{
    radius: number;
    color: string;
    label?: string;
    labelColor?: string;
    textSize?: number;
    shade?: boolean;
    offset?: WorldPosition;
}>
