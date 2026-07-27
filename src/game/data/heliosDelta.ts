import { ObitingBodyBlueprint } from "./types";

export const heliosDelta = {
    archetype: "sol",
    color: "#fffcc9",
    name: "Helios Delta",
    radius: 40,
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        { name: "Canceron", archetype: "kobol", color: "red", orbit: { radius: 10 }, radius: 10, tribe: { population: 6_700_000_000, sign: "♍︎", x: 35, name: "Virgonese" } },
        { name: "Aquaria", tribe: { population: 25_000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, },
        { name: "Aerilon", tribe: { population: 1_200_000_000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, }
    ],
} as const as ObitingBodyBlueprint;
