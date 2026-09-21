import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";
import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT } from "../constants";

export const MapCreationData = {
    marker: { color: "#fff0", radius: 20, label: "Baricentre" },
    archetype: "mars",
    name: "Baricentre",
    radius: 100,
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    color: "grey",
    vessels: [],
    children: [
        {
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Helicon" },
            name: "Naucratis",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 15 * SOLAR_UNIT,
                angle: Math.PI / 2
            },
        },
        {
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Cocalus" },
            name: "Naucratis",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 15 * SOLAR_UNIT,
                angle: - Math.PI / 2
            },
        },
    ],
    binaryPairs: [{
        angle: Math.PI / 2,
        children: [
            {
                archetype: "jupiter",
                marker: { color: "#48a4ad", radius: 20, label: "Ragnar" },
                name: "Ragnar",
                orbit: {
                    radius: 12 * SOLAR_UNIT,
                    angle: 0, eccentricity: 0
                },
                children: [
                    {
                        archetype: "venus", marker: { color: "blue", radius: 2, label: "Sigurd" }, name: "Sigurd", orbit: {
                            radius: 3,
                        }
                    },
                ]
            },
            {
                archetype: "mars",
                marker: { color: "#888", radius: 20, label: "Delium" },
                name: "Delium",
                color: "#888",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: 0,
                },
            },
            {
                archetype: "mars",
                marker: { color: "#888", radius: 20, label: "Knossos" },
                name: "Knossos",
                color: "#888",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: Math.PI,
                },
            }
        ],
        separation: .5 * SOLAR_UNIT,
        orbit: {
            radius: 15 * 20,
            angle: 0
        },
        bodies: [
            solarisAlpha,
            solarisBeta,
        ],
    }, {
        angle: Math.PI / 2,
        separation: .5 * SOLAR_UNIT,
        orbit: {
            angle: Math.PI,
            radius: 300,
        },
        bodies: [
            heliosGamma,
            heliosDelta,
        ],
        children: [
            {
                archetype: "mars",
                marker: { color: "#888", radius: 20, label: "Gortyn" },
                name: "Gortyn",
                color: "#888",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: 0
                },
            },
            {
                archetype: "mars",
                marker: { color: "#888", radius: 20, label: "Naucratis" },
                name: "Naucratis",
                color: "#888",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: Math.PI
                },
            },
        ]
    }]
} as const satisfies BodyBlueprint