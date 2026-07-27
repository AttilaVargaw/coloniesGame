import { createPatronGodModifier } from "./createPatronGodModifier";
import { ObitingBodyBlueprint } from "./types";

export const heliosGamma = {
    orbit: {
        radius: 40,
        eccentricity: 0.01
    },
    archetype: "sol",
    radius: 10,
    color: "#f5f5f5",
    // distanceFromParent: 100,
    name: "Helios Gamma",
    // sign: "γ︎",
    children: [
        {
            orbit: { radius: 10, eccentricity: 0.01 },
            name: "Scorpia",
            color: "",
            archetype: "kobol",
            radius: 8,
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
            name: "Sagitarron",
            radius: 8,
            color: "",
            archetype: "kobol",
            tribe: {
                population: 1700000000, sign: "♐︎", patronGod: createPatronGodModifier({
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
            orbit: {
                radius: 8,
                eccentricity: 0.1,
            }
        },
        {
            name: "Libran",
            radius: 8,
            color: "",
            archetype: "kobol",
            orbit: {
                radius: 8,
                eccentricity: 0.1
            },
            tribe: {
                population: 2100000, sign: "♎︎", patronGod: createPatronGodModifier({
                    description: "Athena is the Lord of Kobol associated with wisdom, warfare, and handicraft. Her major symbols include owls, olive trees, snakes, and the gorgoneion. In art, she is generally depicted wearing a helmet and holding a spear.",
                    name: "Athena",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }
                }),
                name: "Libran"
            }
        }
    ],
} as const as ObitingBodyBlueprint;
