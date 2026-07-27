import { ObitingBodyBlueprint } from "./types";

export const solarisBeta = {
    name: "Helios Beta",
    marker: { color: "#fffcc9", radius: 40, label: "Helios Beta" },
    archetype: "sol",
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        {
            population: 4300000000,
            marker: { color: "red", radius: 10, label: "Virgon" }, archetype: "kobol", orbit: { radius: 10 }, name: "Virgon"
        },
        {
            population: 260000000,
            marker: { color: "red", radius: 10, label: "Leonis" }, archetype: "kobol", orbit: { radius: 10 }, name: "Leonis"
        },
    ],
} as const as ObitingBodyBlueprint;
