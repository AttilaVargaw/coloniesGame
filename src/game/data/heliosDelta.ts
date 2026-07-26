import { BodyBlueprint } from "./types";
//     // ["Canceron", { population: 6_700_000_000, sign: "♋︎", x: 8, y: 0 }],
//     // ["Aquaria", { population: 25_000, sign: "♒︎", x: 9, y: 0 }],
//     // ["Aerilon", { population: 1_200_000_000, sign: "♈︎", x: 10, y: 0 }],
// ] as const)
export const heliosDelta = {
    archetype: "sol",
    color: "#fffcc9",
    name: "Helios Delta",
    radius: 10,
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        { name: "Canceron", archetype: "kobol", color: "red", orbit: { radius: 10 }, radius: 10, tribe: { population: 6_700_000_000, sign: "♍︎", x: 35, name: "Virgonese" } },
        { name: "Aquaria", tribe: { population: 25_000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, },
        { name: "Aerilon", tribe: { population: 1_200_000_000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, }
    ],
} as const as BodyBlueprint;
