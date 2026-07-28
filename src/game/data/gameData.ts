import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";
import { BodyBlueprint } from "./BodyBlueprint";

export const MapCreationData = {
    marker: { color: "#000", radius: 10, label: "" },
    archetype: "kobol",
    name: "universe-root",
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    vessels: [],
    binaryPairs: [{
        separation: 2,
        orbit: {
            radius: 6,
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
} as const as BodyBlueprint