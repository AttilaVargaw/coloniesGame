import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT, STAR_SIZE } from "@game/constants"

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: STAR_SIZE, label: "Helios Alpha", shade: true, emitLight: true },
    archetype: "sol",
    orbit: { radius: 200, angle: Math.PI / 2, eccentricity: 0, inclination: 0 },
    systems: [{
        bodies: [{
            marker: { color: "#f99838", radius: 4, label: "Icarus" },
            archetype: "mercury",
            orbit: { radius: 0.4 * SOLAR_UNIT, angle: 2, inclination: 0 },
            name: "Icarus",
        }],
    }, {
        bodies: [{
            marker: { color: "#b1b3ba", radius: 4, label: "Persephone" },
            archetype: "mercury",
            orbit: { radius: 44, angle: 4, eccentricity: 0.4, inclination: 0 },
            name: "Persephone",
        }],
    }, {
        bodies: [{
            marker: { color: "#928262", radius: 40, label: "Zeus" },
            name: "Zeus",
            archetype: "venus",
            orbit: { radius: 6.5 * SOLAR_UNIT, angle: 5, eccentricity: 0.007, inclination: 0.05 },
            systems: [{
                orbit: { radius: 0.1, angle: 0 },
                bodies: [
                    { marker: { color: "#c7d9d7", radius: 5, label: "Nike" }, orbit: { radius: 4.8, angle: 0, eccentricity: 0.3 }, name: "Nike", archetype: "luna" },
                    { marker: { color: "#777678", radius: 5, label: "Hebe" }, orbit: { radius: 5.5, angle: 0, eccentricity: 0.5 }, name: "Hebe", archetype: "luna" }
                ]
            }]
        }],
    }, {
        bodies: [{
            marker: { color: "#56738c", radius: 8, label: "Picon" },
            archetype: "kobol",
            orbit: { radius: 0.95 * SOLAR_UNIT, angle: 4.2, eccentricity: 0.015, inclination: 0.2 },
            name: "Picon",
            population: 1_400_000_000,
        }],
    }, {
        bodies: [{
            marker: { color: "#887266", radius: 8, label: "Tauron" },
            archetype: "kobol",
            orbit: { radius: 1.3 * SOLAR_UNIT, angle: 2, eccentricity: 0.025, inclination: 0 },
            name: "Tauron",
            population: 1_200_000_000,
        }],
    }, {
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: 0, eccentricity: 0 },
        bodies: [{
            marker: { color: "#879cb8", radius: 8, label: "Caprica" },
            archetype: "kobol",
            orbit: { radius: 2, angle: 0, eccentricity: 0.02, inclination: 0 },
            name: "Caprica",
            population: 4900000000,
            vessels: [
                { marker: { color: "white", radius: 4, label: "Battlestar\nMinerva", }, orbit: { radius: 10, angle: 2, eccentricity: 0.007 } }
            ],
        }, {
            mass: 0.9,
            marker: { color: "#a08156", radius: 8, label: "Gemenon" },
            archetype: "kobol",
            orbit: { radius: 2, angle: Math.PI, eccentricity: 0.02, inclination: 0 },
            name: "Gemenon",
            population: 2800000000,
        }],
    }],
    asteroidBelts: [
        { innerRadius: 1.4 * SOLAR_UNIT, outerRadius: 2.0 * SOLAR_UNIT, color: "#22222aaa", name: "Erebos" },
    ]
} as const satisfies BodyBlueprint;
