import { BodyBlueprint } from "./BodyBlueprint";
import { createPatronGodModifier } from "./createPatronGodModifier";

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: 10, label: "Helios Alpha" },
    archetype: "sol",
    orbit: { radius: 300, angle: 0, eccentricity: 0 },
    children: [
        {
            marker: { color: "#f99838", radius: 4, label: "Icarus" },
            archetype: "mercury",
            orbit: { radius: 2, angle: 0 },
            name: "Icarus",
        },
        {
            marker: { color: "#b1b3ba", radius: 4, label: "Persephone" },
            archetype: "mercury",
            orbit: { radius: 44, angle: 0, eccentricity: 0.4 },
            name: "Persephone",
        },
        {
            marker: { color: "#928262", radius: 40, label: "Zeus" },
            archetype: "venus",
            orbit: { radius: 30, angle: 0, eccentricity: 0.007 },
            name: "Zeus",
            children: [
                { marker: { color: "#c7d9d7", radius: 5, label: "Nike" }, orbit: { radius: 2.1, angle: 0, eccentricity: 0.3 }, name: "Nike", archetype: "mars" },
                { marker: { color: "#777678", radius: 5, label: "Hebe" }, orbit: { radius: 4, angle: 0, eccentricity: 0.7 }, name: "Hebe", archetype: "mars" }
            ]
        },
        {
            marker: { color: "#879cb8", radius: 8, label: "Caprica" },
            archetype: "kobol",
            orbit: { radius: 24, angle: 0, eccentricity: 0.017 },
            name: "Caprica",
            population: 4900000000,
            tribe: {
                sign: "♑︎",
                patronGod: createPatronGodModifier({
                    name: "Apollo",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }, description: "Apollo is one of the Lords of Kobol. His numerous functions and representations include the Sun and light, prophecy, philosophy, truth, logic, inspiration, music, poetry, the arts, purification, medicine, healing, plague, archery, and masculine beauty. He is the son of Zeus and Leto, and the twin brother of Artemis, goddess of the hunt. She is considered to be the most beautiful god."
                }),
            },
            vessels: [
                { marker: { color: "red", radius: 4, label: "Minerva" }, orbit: { radius: 10, angle: 0, eccentricity: 0.007 } }
            ],
        },
        {
            marker: { color: "#a08156", radius: 8, label: "Gemenon" },
            archetype: "kobol",
            orbit: { radius: 24, angle: 0, eccentricity: 0.02 },
            name: "Gemenon",
            population: 2800000000,
        },
        {
            marker: { color: "#56738c", radius: 8, label: "Picon" },
            archetype: "kobol",
            orbit: { radius: 20, angle: 0, eccentricity: 0.015 },
            name: "Picon",
            population: 1_400_000_000,
        },
        {
            marker: { color: "#887266", radius: 8, label: "Tauron" },
            archetype: "kobol",
            orbit: { radius: 23, angle: 0, eccentricity: 0.025 },
            name: "Tauron",

        }
    ]
} as const as BodyBlueprint;
