import { ObitingBodyBlueprint } from "./types";

export const heliosDelta = {
    name: "Helios Delta",
    marker: { color: "#fffcc9", radius: 40, label: "Helios Delta" },
    archetype: "sol",
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        { marker: { color: "red", radius: 10, label: "Canceron" }, archetype: "kobol", orbit: { radius: 10 }, name: "Canceron", tribe: { population: 6_700_000_000, sign: "♍︎", name: "Virgonese" } },
        { marker: { color: "red", radius: 10, label: "Aquaria" }, archetype: "kobol", orbit: { radius: 10 }, name: "Aquaria", tribe: { population: 25_000, sign: "︎♌︎", name: "Leonid" } },
        { marker: { color: "red", radius: 10, label: "Aerilon" }, archetype: "kobol", orbit: { radius: 10 }, name: "Aerilon", tribe: { population: 1_200_000_000, sign: "︎♌︎", name: "Leonid" } },
    ],
} as const as ObitingBodyBlueprint;
