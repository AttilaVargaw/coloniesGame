//     // ["Scorpia", {
//     //     population: 450_000_000, sign: "♏︎", x: 10, y: 6, patronGod: createPatronGodModifier({
//     //         name: "Dionysus",
//     //         description: "Dyonysus is the Lord of wine-making, orchards, fruit, vegetation, fertility, festivity, insanity, ritual madness, religious ecstasy, and theatre. His wine, music, and ecstatic dance were considered to free his followers from self-conscious fear and care, and subvert the oppressive restraints of the powerful. His thyrsus, a fennel-stem sceptre, sometimes wound with ivy and dripping with honey, is both a beneficent wand and a weapon used to destroy those who oppose his cult and the freedoms he represents. Those who partook of his mysteries were believed to become possessed and empowered by the god himself.",
//     //         onAdd: (entity) => {
//     //             return entity
//     //         },
//     //         onRemove: (entity) => {
//     //             return entity
//     //         },
//     //     })
//     // }],
//     // ["Sagitarron", {
//     //     population: 1_700_000_000, sign: "♐︎", x: 12, y: 6, patronGod: createPatronGodModifier({
//     //         description: "Zeus is the supreme Lord of the Kobolian pantheon. He is a sky and thunder god, who rules as king of the lords on Kobol. Zeus is the child of Cronus and Rhea.",
//     //         name: "Zeus",
//     //         onAdd: (entity) => {
//     //             return entity
//     //         }, onRemove: (entity) => {
//     //             return entity
//     //         }
//     //     })
//     // }],
//     // ["Libran", {
//     //     population: 2_100_000, sign: "♎︎", x: 14, y: 6, patronGod: createPatronGodModifier({
//     //         description: "Athena is the Lord of Kobol associated with wisdom, warfare, and handicraft. Her major symbols include owls, olive trees, snakes, and the gorgoneion. In art, she is generally depicted wearing a helmet and holding a spear.",
//     //         name: "Athena",
//     //         onAdd: (entity) => {
//     //             return entity
//     //         }, onRemove: (entity) => {
//     //             return entity
//     //         }
//     //     })
//     // }],
//     // ["Canceron", { population: 6_700_000_000, sign: "♋︎", x: 8, y: 0 }],
//     // ["Aquaria", { population: 25_000, sign: "♒︎", x: 9, y: 0 }],
//     // ["Virgon", { population: 4_300_000_000, sign: "♍︎", x: 35, y: 0 }],
//     // ["Leonis", { population: 2_600_000_000, sign: "︎♌︎", x: 5, y: 0 }],
//     // ["Aerilon", { population: 1_200_000_000, sign: "♈︎", x: 10, y: 0 }],
// ] as const)
//const StarNames = ["Helios Alpha", "Helios Beta", "Helios Gamma", "Helios Delta"] as const
// const Stars = new Map<string, Star>([
//     [StarNames[0], { sign: "⍺", x: 11, y: 20, z: 0, name: StarNames[0] }],
//     [StarNames[1], { sign: "β", x: 6, y: 6, z: 0, name: StarNames[1] }],
//     // ["Helios Gamma", { sign: "γ", x: 0, y: 0 }],
//     // ["Helios Delta", { sign: "δ", x: 0, y: 0 }],
// ] as const)
// const Bodies = new Map<string, { x: number, y: number, radius: number }>([
//     ["Thanatos", { x: 4, y: 6, radius: 10 }],
//     ["Ophion", { x: 20, y: 6, radius: 50 }],
//     // ["Helios Gamma", { sign: "γ", x: 0, y: 0 }],
//     // ["Helios Delta", { sign: "δ", x: 0, y: 0 }],

import { BodyBlueprint } from "./types";

// ] as const)
export const solarisBeta = {
    archetype: "sol",
    color: "#fffcc9",
    name: "Helios Beta",
    radius: 20,
    orbit: { radius: 10, angle: 0, eccentricity: 0 },
    children: [
        { name: "Virgon", archetype: "kobol", color: "red", orbit: { radius: 10 }, radius: 10, tribe: { population: 4300000000, sign: "♍︎", x: 35, name: "Virgonese" } },
        { name: "Leonis", tribe: { population: 2600000000, sign: "︎♌︎", name: "Leonid" }, archetype: "kobol", color: "red", orbit: { radius: 10, }, radius: 10, }
    ],
} as const as BodyBlueprint;
