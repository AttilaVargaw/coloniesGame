import { LUNAR_UNIT, SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const solarisBeta = {
    asteroidBelts: [
        { innerRadius: 1 * SOLAR_UNIT, outerRadius: 1.2 * SOLAR_UNIT, color: "#22222aaa" },
    ],
    navigationalPoint: true,
    name: "Helios Beta",
    marker: { color: "#fbe57d", radius: STAR_SIZE, label: "Helios Beta", emitLight: true },
    archetype: "sol",
    orbit: { radius: 200, eccentricity: 0, inclination: 0, angle: -Math.PI / 2 },
    systems: [{
        bodies: [{
            archetype: "mars", marker: { color: "#b17d5d", radius: 8, label: "Pallas" }, orbit: { radius: 2 * SOLAR_UNIT, angle: 2, eccentricity: 0.017, inclination: 0.2 }, name: "Pallas"
        },
        ]
    },
        , {
        bodies: [{
            archetype: "mercury", marker: { color: "#8f742d", radius: 8, label: "Troy" }, orbit: { radius: 0.3 * SOLAR_UNIT, angle: 2, eccentricity: 0.017, inclination: 0 }, name: "Troy"
        },
        ]
    },
    {
        bodies: [
            {
                population: 4300000000,
                marker: { color: "#4d5c6d", radius: 10, label: "Virgon" },
                archetype: "kobol",
                orbit: { radius: 0 },
                name: "Virgon"
            },
            {
                population: 100_000,
                marker: { color: "#a0948d", radius: 4, label: "Hibernia" },
                archetype: "luna",
                orbit: { radius: 2.1 * LUNAR_UNIT },
                name: "Hibernia"
            }
        ],
        orbit: { radius: 1.35 * SOLAR_UNIT, inclination: 0 }
    },
    {
        bodies: [{
            population: 260000000,
            marker: { color: "#829873", radius: 10, label: "Leonis" }, archetype: "kobol", orbit: { radius: 0.95 * SOLAR_UNIT, inclination: 0 }, name: "Leonis"
        }],
    },
    {
        bodies: [{
            name: "Hera",
            archetype: "saturn",
            marker: { color: "#c67242", radius: 20, label: "Hera" },
            orbit: { radius: 7 * SOLAR_UNIT },
            systems: [{
                orbit: { radius: 0.1, angle: 0 },
                bodies: [{
                    name: "Euboea",
                    archetype: "luna",
                    marker: { color: "#888374", radius: 4, label: "Euboea" },
                    orbit: { radius: 1.5 * LUNAR_UNIT },
                }, {
                    name: "Iris",
                    archetype: "luna",
                    marker: { color: "#71877d", radius: 4, label: "Iris" },
                    orbit: { radius: 1.8 * LUNAR_UNIT, eccentricity: 0.02 },
                }]
            }]
        }],
    }],
} as BodyBlueprint;
