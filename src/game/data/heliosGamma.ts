import { SOLAR_UNIT } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";
import { createPatronGodModifier } from "./createPatronGodModifier";

export const heliosGamma = {
    name: "Helios Gamma",
    marker: { color: "#fbf988", radius: 10, label: "Helios Gamma" },
    orbit: { radius: 300, eccentricity: 0.01 },
    archetype: "sol",
    children: [
        { archetype: "mercury", marker: { color: "#caa17f", radius: 8, label: "Thanatos" }, orbit: { radius: 0.35 * SOLAR_UNIT, angle: 2, eccentricity: 0.017 }, },
        {
            marker: { color: "#909ec0", radius: 8, label: "Scorpia" },
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
            marker: { color: "#837a79", radius: 8, label: "Sagitarron" },
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
            marker: { color: "#759477", radius: 8, label: "Libran" },
            name: "Libran",
            archetype: "kobol",
            orbit: { radius: 8, eccentricity: 0.1 },
            population: 2100000,
            children: [
                { archetype: "mercury", marker: { color: "#909ec0", radius: 4, label: "Herse" }, orbit: { radius: 3.1 }, name: "Herse" },
                { archetype: "mercury", marker: { color: "#7e816b", radius: 4, label: "Herse" }, orbit: { radius: 2.5 }, name: "Pandrossos" }
            ]
        },
        {
            archetype: "saturn",
            marker: { color: "#e9d46f", radius: 20, label: "Ophion" },
            orbit: { radius: 7 * SOLAR_UNIT },
            rings: [
                { color: "#847e67", innerRadius: 30, outerRadius: 40 }
            ]
        }
    ],
} as const as BodyBlueprint
