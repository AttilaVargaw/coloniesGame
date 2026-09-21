import { SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosGamma = {
    name: "Helios Gamma",
    marker: { color: "#fbf988", radius: STAR_SIZE, label: "Helios Gamma" },
    orbit: { radius: 300, eccentricity: 0.01 },
    archetype: "sol",
    children: [
        {
            name: "Thanatos",
            archetype: "mercury",
            marker: { color: "#caa17f", radius: 8, label: "Thanatos" },
            orbit: { radius: 0.35 * SOLAR_UNIT, angle: 2, eccentricity: 0.017 },
        },
        {
            marker: { color: "#909ec0", radius: 8, label: "Scorpia" },
            orbit: { radius: SOLAR_UNIT * 1, eccentricity: 0.01 },
            name: "Scorpia",
            archetype: "kobol",
            population: 450000000,
        },
        {
            marker: { color: "#837a79", radius: 8, label: "Sagitarron" },
            name: "Sagitarron",
            archetype: "kobol",
            orbit: { radius: SOLAR_UNIT * 1.1, eccentricity: 0.1 },
            population: 1700000000,
        },
        {
            marker: { color: "#759477", radius: 8, label: "Libran" },
            name: "Libran",
            archetype: "kobol",
            orbit: { radius: SOLAR_UNIT * 0.95, eccentricity: 0.1 },
            population: 2100000,
            children: [
                { archetype: "mercury", marker: { color: "#909ec0", radius: 4, label: "Herse" }, orbit: { radius: 3.1 }, name: "Herse" },
                { archetype: "mercury", marker: { color: "#7e816b", radius: 4, label: "Pandrossos" }, orbit: { radius: 2.5 }, name: "Pandrossos" }
            ]
        },
        {
            name: "Ophion",
            archetype: "saturn",
            marker: { color: "#e9d46f", radius: 20, label: "Ophion" },
            orbit: { radius: 7 * SOLAR_UNIT },
            rings: [
                { color: "#222a", innerRadius: 30, outerRadius: 50 }
            ]
        }
    ],
} as const satisfies BodyBlueprint
