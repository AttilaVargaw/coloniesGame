import { WorldPosition } from "@/engine/components/position";

export type MapMarker = {
    readonly radius: number;
    readonly color: string;
    readonly label?: string;
    readonly labelColor?: string;
    readonly textSize?: number;
    readonly shade?: boolean;
    readonly offset?: WorldPosition;
};
