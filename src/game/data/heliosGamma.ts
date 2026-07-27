import { createPatronGodModifier } from "./createPatronGodModifier";
import { ObitingBodyBlueprint } from "./types";

export const heliosGamma = {
    name: "Helios Gamma",
    marker: { color: "#f5f5f5", radius: 10, label: "Helios Gamma" },
    orbit: { radius: 40, eccentricity: 0.01 },
    archetype: "sol",
    children: [
        {
            marker: { color: "", radius: 8, label: "Scorpia" },
            orbit: { radius: 10, eccentricity: 0.01 },
            name: "Scorpia",
            archetype: "kobol",
            population: 450000000,
            tribe: {
                name: "Scorpian",
                sign: "♏︎", patronGod: createPatronGodModifier({
                    name: "Dionysus",
                    description: "Dyonysus is the Lord of wine-making, orchards, fruit, vegetation, fertility, festivity, insanity, ritual madness, religious ecstasy, and theatre. His wine, music, and ecstatic dance were considered to free his followers from self-conscious fear and care, and subvert the oppressive restraints of the powerful. His thyrsus, a fennel-stem sceptre, sometimes wound with ivy and dripping with honey, is both a beneficent wand and a weapon used to destroy those who oppose his cult and the freedoms he represents. Those who partook of his mysteries were believed to become possessed and empowered by the god himself.",
                    onAdd: (entity) => {
                        return entity;
                    },
                    onRemove: (entity) => {
                        return entity;
                    },
                }),
            }
        },
        {
            marker: { color: "", radius: 8, label: "Sagitarron" },
            name: "Sagitarron",
            archetype: "kobol",
            orbit: { radius: 8, eccentricity: 0.1 },
            population: 1700000000,
            tribe: {
                sign: "♐︎", patronGod: createPatronGodModifier({
                    description: "Zeus is the supreme Lord of the Kobolian pantheon. He is a sky and thunder god, who rules as king of the lords on Kobol. Zeus is the child of Cronus and Rhea.",
                    name: "Zeus",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }
                }),
                name: "Sagitarran"
            },
        },
        {
            marker: { color: "", radius: 8, label: "Libran" },
            name: "Libran",
            archetype: "kobol",
            orbit: { radius: 8, eccentricity: 0.1 },
            population: 2100000,
        }
    ],
} as const as ObitingBodyBlueprint;
