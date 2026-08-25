import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";
import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT } from "../constants";

export const MapCreationData = {
    marker: { color: "#000", radius: 10, label: "" },
    archetype: "baricenter",
    name: "universe-root",
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    vessels: [],
    binaryPairs: [{
        children: [
            {
                archetype: "jupiter",
                marker: { color: "#48a4ad", radius: 20, label: "Ragnar" },
                name: "Ragnar",
                orbit: {
                    radius: 6 * SOLAR_UNIT,
                    angle: 0, eccentricity: 0
                },
                children: [
                    {
                        archetype: "venus", marker: { color: "blue", radius: 2, label: "Sigurd" }, name: "Sigurd", orbit: {
                            radius: 3,
                        }
                    }
                ]
            }
        ],
        separation: .5 * SOLAR_UNIT,
        orbit: {
            radius: 300,
            angle: 0
        },
        bodies: [
            solarisBeta,
            solarisAlpha,
        ],
    }, {
        separation: .5 * SOLAR_UNIT,
        orbit: {
            angle: Math.PI,
            radius: 300
        },
        bodies: [
            heliosGamma,
            heliosDelta,
        ]
    }]
} as const satisfies BodyBlueprint