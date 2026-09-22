import { LUNAR_UNIT, SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosDelta = {
    navigatinalPoint: true,
    name: "Helios Delta",
    marker: { color: "#f7a75c", radius: STAR_SIZE, label: "Helios Delta" },
    archetype: "sol",
    orbit: { radius: 200, angle: -Math.PI / 2, eccentricity: 0, inclination: 0 },
    systems: [{
        bodies: [{
            marker: { color: "#6a7a82", radius: 10, label: "Canceron" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.1, angle: Math.PI / 3, eccentricity: 0.007, inclination: 0 },
            name: "Canceron",
            population: 6_700_000_000,
        }],
    }, {
        bodies: [{
            marker: { color: "#849cbe", radius: 10, label: "Aquaria" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.35, inclination: 0.4 }, name: "Aquaria", population: 25_000
        }],
    }, {
        bodies: [{
            marker: { color: "#ced0dd", radius: 10, label: "Aerilon" },
            archetype: "kobol", orbit: {
                radius: SOLAR_UNIT * 1.1,
                angle: 0,
                eccentricity: 0.007,
                inclination: 0
            }, name: "Aerilon", population: 1_200_000_000
        }],
    }, {
        bodies: [{
            marker: { color: "#ecd591", radius: 10, label: "Styx" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.4, inclination: 0.8 }, name: "Styx"
        }],
    }, {
        bodies: [{
            marker: { color: "#a68b69", radius: 10, label: "Phoebe" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.6, angle: 0, inclination: 0 }, name: "Phoebe"
        }],
    }, {
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: Math.PI / 6, eccentricity: 0.007, inclination: 0 },
        bodies: [
            {
                orbit: { radius: 0.01, inclination: 0 },
                marker: { color: "#ae4937", radius: 10, label: "Hestia" },
                archetype: "saturn",
                name: "Hestia",
                systems: [{
                    orbit: { radius: 0.01, inclination: 0 },
                    bodies: [
                    ]
                },
                ]
            },
            { marker: { color: "#695a55", radius: 5, label: "Rhea" }, orbit: { radius: 2.1 * LUNAR_UNIT, angle: 0, eccentricity: 0.3, periapsis: 0.1, inclination: 1 }, name: "Rhea", archetype: "luna" },
            { marker: { color: "#7f9894", radius: 5, label: "Kronos" }, orbit: { radius: 3.1 * LUNAR_UNIT, angle: 0, eccentricity: 0.4 }, name: "Kronos", archetype: "luna" }
        ],
    }],
} as const satisfies BodyBlueprint;
