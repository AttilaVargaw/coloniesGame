import { ObitingBodyBlueprint } from "./types";

export const heliosDelta = {
    name: "Helios Delta",
    marker: { color: "#fffcc9", radius: 40, label: "Helios Delta" },
    archetype: "sol",
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        {
            marker: { color: "red", radius: 10, label: "Canceron" },
            archetype: "kobol", orbit: { radius: 10 },
            name: "Canceron",
            population: 6_700_000_000,
        },
        {
            marker: { color: "red", radius: 10, label: "Aquaria" },
            archetype: "kobol", orbit: { radius: 10 }, name: "Aquaria", population: 25_000
        },
        {
            marker: { color: "red", radius: 10, label: "Aerilon" },
            archetype: "kobol", orbit: { radius: 10 }, name: "Aerilon", population: 1_200_000_000
        },
    ],
} as const as ObitingBodyBlueprint;
