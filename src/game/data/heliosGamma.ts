import { LUNAR_UNIT, SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosGamma = {
    name: "Helios Gamma",
    marker: { color: "#fbf988", radius: STAR_SIZE, label: "Helios Gamma" },
    orbit: { radius: 200, eccentricity: 0, inclination: 0, angle: Math.PI /2 },
    archetype: "sol",
    systems: [{
        bodies: [{
            name: "Thanatos",
            archetype: "mercury",
            marker: { color: "#caa17f", radius: 8, label: "Thanatos" },
            orbit: { radius: 0.35 * SOLAR_UNIT, angle: 2, eccentricity: 0.017, inclination: 0 },
        }],
    }, {
        bodies: [{
            marker: { color: "#909ec0", radius: 8, label: "Scorpia" },
            orbit: { radius: SOLAR_UNIT * 1, eccentricity: 0.01, inclination: 0 },
            name: "Scorpia",
            archetype: "kobol",
            population: 450000000,
        }],
    }, {
        bodies: [{
            marker: { color: "#837a79", radius: 8, label: "Sagitarron" },
            name: "Sagitarron",
            archetype: "kobol",
            orbit: { radius: SOLAR_UNIT * 1.1, eccentricity: 0.1, inclination: 0 },
            population: 1700000000,
        }],
    }, {
        bodies: [{
            marker: { color: "#759477", radius: 8, label: "Libran" },
            name: "Libran",
            archetype: "kobol",
            orbit: { radius: SOLAR_UNIT * 0.95, eccentricity: 0.1, inclination: 0.3 },
            population: 2100000,
            systems: [{
                orbit: { radius: .01, angle: 0 },
                bodies: [
                    { archetype: "luna", marker: { color: "#909ec0", radius: 4, label: "Herse" }, orbit: { radius: LUNAR_UNIT * 3.1 }, name: "Herse" },
                    { archetype: "luna", marker: { color: "#7e816b", radius: 4, label: "Pandrossos" }, orbit: { radius: LUNAR_UNIT * 1.5 }, name: "Pandrossos" }
                ]
            }]
        }],
    }, {
        bodies: [{
            name: "Ophion",
            archetype: "saturn",
            marker: { color: "#e9d46f", radius: 20, label: "Ophion" },
            orbit: { radius: 7 * SOLAR_UNIT, inclination: 0.45 },
            rings: [
                { color: "#222a", innerRadius: 30, outerRadius: 50 }
            ]
        }],
    }],
} as const satisfies BodyBlueprint;
