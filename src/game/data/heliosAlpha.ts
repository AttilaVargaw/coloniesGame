import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT, STAR_SIZE } from "@game/constants"

// const testR = generateRescource({
//     population: starterPopulation,
//     goods: starterGoods,
//     goodsRequirements: {},
//     name: "water",
//     workerRequirement: { worker: 10, clerks: 10 }
// })

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: STAR_SIZE, label: "Helios Alpha" },
    archetype: "sol",
    orbit: { radius: 300, angle: 0, eccentricity: 0 },
    binaryPairs: [{
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: 0, eccentricity: 0 },
        separation: 0.1,
        bodies: [{
            marker: { color: "#879cb8", radius: 8, label: "Caprica" },
            archetype: "kobol",
            orbit: { radius: 1, angle: 2, eccentricity: 0.017 },
            name: "Caprica",
            population: 4900000000,
            vessels: [
                { marker: { color: "red", radius: 4, label: "Minerva" }, orbit: { radius: 10, angle: 2, eccentricity: 0.007 } }
            ],
        },
        {
            marker: { color: "#a08156", radius: 8, label: "Gemenon" },
            archetype: "kobol",
            orbit: { radius: 2, angle: 4, eccentricity: 0.02 },
            name: "Gemenon",
            population: 2800000000,
        }]
    }],
    children: [
        {
            marker: { color: "#f99838", radius: 4, label: "Icarus" },
            archetype: "mercury",
            orbit: { radius: 0.4 * SOLAR_UNIT, angle: 2 },
            name: "Icarus",
        },
        {
            marker: { color: "#b1b3ba", radius: 4, label: "Persephone" },
            archetype: "mercury",
            orbit: { radius: 44, angle: 4, eccentricity: 0.4 },
            name: "Persephone",
        },
        {
            marker: { color: "#928262", radius: 40, label: "Zeus" },
            archetype: "venus",
            orbit: { radius: 6.5 * SOLAR_UNIT, angle: 5, eccentricity: 0.007 },
            name: "Zeus",
            children: [
                { marker: { color: "#c7d9d7", radius: 5, label: "Nike" }, orbit: { radius: 2.1, angle: 0, eccentricity: 0.3 }, name: "Nike", archetype: "mars" },
                { marker: { color: "#777678", radius: 5, label: "Hebe" }, orbit: { radius: 4, angle: 0, eccentricity: 0.7 }, name: "Hebe", archetype: "mars" }
            ]
        },
        {
            marker: { color: "#56738c", radius: 8, label: "Picon" },
            archetype: "kobol",
            orbit: { radius: 0.95 * SOLAR_UNIT, angle: 4.2, eccentricity: 0.015 },
            name: "Picon",
            population: 1_400_000_000,
        },
        {
            marker: { color: "#887266", radius: 8, label: "Tauron" },
            archetype: "kobol",
            orbit: { radius: 1.3 * SOLAR_UNIT, angle: 2, eccentricity: 0.025 },
            name: "Tauron",
            population: 1_200_000_000,
        },

    ],
    asteroidBelts: [
        { color: "#808080", innerRadius: 1.5 * SOLAR_UNIT, outerRadius: 1.7 * SOLAR_UNIT }
    ]
} as const as BodyBlueprint;
