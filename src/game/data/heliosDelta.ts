import { SOLAR_UNIT } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosDelta = {
    name: "Helios Delta",
    marker: { color: "#f7a75c", radius: 10, label: "Helios Delta" },
    archetype: "sol",
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        {
            marker: { color: "#6a7a82", radius: 10, label: "Canceron" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.1, angle: 0 },
            name: "Canceron",
            population: 6_700_000_000,
        },
        {
            marker: { color: "#849cbe", radius: 10, label: "Aquaria" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.35 }, name: "Aquaria", population: 25_000
        },
        {
            marker: { color: "#ced0dd", radius: 10, label: "Aerilon" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.1, angle: Math.PI / 2 }, name: "Aerilon", population: 1_200_000_000
        },
        {
            marker: { color: "#ecd591", radius: 10, label: "Styx" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.4 }, name: "Styx"
        },
        {
            marker: { color: "#a68b69", radius: 10, label: "Phoebe" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.6 }, name: "Styx"
        },
        {
            marker: { color: "#ae4937", radius: 40, label: "Hestia" },
            archetype: "venus",
            orbit: { radius: 6.5 * SOLAR_UNIT, angle: 5, eccentricity: 0.007 },
            name: "Hestia",
            children: [
                { marker: { color: "#695a55", radius: 5, label: "Rhea" }, orbit: { radius: 2.1, angle: 0, eccentricity: 0.3 }, name: "Rhea", archetype: "mercury" },
                { marker: { color: "#7f9894", radius: 5, label: "Kronos" }, orbit: { radius: 4, angle: 0, eccentricity: 0.7 }, name: "Kronos", archetype: "mercury" }
            ]
        },
    ],
} as const as BodyBlueprint;
