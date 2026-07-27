import type { ObitingBodyBlueprint } from "./types";
import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";

export const MapCreationData = {
    angle: 0,
    archetype: "kobol",
    color: "red",
    name: "universe-root",
    radius: 10,
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    vessels: [],
    binaryPairs: [{
        separation: 4,
        orbit: {
            radius: 4,
            angle: 0
        },
        bodies: [
            solarisBeta,
            solarisAlpha,
        ]
    }, {
        separation: 2,
        orbit: {
            angle: Math.PI,
            radius: 4
        },
        bodies: [
            heliosGamma,
            heliosDelta,
        ]
    }]
} as const as ObitingBodyBlueprint