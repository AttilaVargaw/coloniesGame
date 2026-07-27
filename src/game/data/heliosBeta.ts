import { ObitingBodyBlueprint } from "./types";

// ] as const)
export const solarisBeta = {
    archetype: "sol",
    color: "#fffcc9",
    name: "Helios Beta",
    radius: 40,
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        { name: "Virgon", archetype: "kobol", color: "red", orbit: { radius: 10 }, radius: 10, tribe: { population: 4300000000, sign: "♍︎", x: 35, name: "Virgonese" } },
        { name: "Leonis", tribe: { population: 2600000000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, }
    ],
} as const as ObitingBodyBlueprint;
