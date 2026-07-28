import type { Entity } from "@/engine/entities/entity";
import type { WaypointGrid } from "../factories/waypointGrid";

export const StartState = {
    map: {
        waypoints: new Map<string, Entity>(),
        attractors: new Map<string, Entity>(),
        grids: new Map<string, WaypointGrid>(),
    },
} as const;
