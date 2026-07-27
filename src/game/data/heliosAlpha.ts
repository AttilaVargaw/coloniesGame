import { createPatronGodModifier } from "./createPatronGodModifier";
import { ObitingBodyBlueprint } from "./types";

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: 10, label: "Helios Alpha" },
    archetype: "sol",
    orbit: { radius: 40, angle: 0, eccentricity: 0 },
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
            tribe: {
                population: 4900000000,
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
                { marker: { color: "red", radius: 4, label: "Minerva" }, orbit: { radius: 50, angle: 0, eccentricity: 0.007 } }
            ],
        },
        {
            marker: { color: "#a08156", radius: 8, label: "Gemenon" },
            archetype: "kobol",
            orbit: { radius: 24, angle: 0, eccentricity: 0.02 },
            name: "Gemenon",
            tribe: {
                population: 2800000000, sign: "♊︎",
                name: "Gemenese",
                patronGod: createPatronGodModifier({
                    modifiers: { fertility: "+2" },
                    name: "Hera",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }, description: "Hera is the goddess of marriage, women, and family, and the protector of women during childbirth. In mythology, she is queen among the twelve Lord of Kobol, sister and wife of Zeus, and daughter of the Titans Cronus and Rhea."
                }),
            }
        },
        {
            marker: { color: "#56738c", radius: 8, label: "Picon" },
            archetype: "kobol",
            orbit: { radius: 20, angle: 0, eccentricity: 0.015 },
            name: "Picon",
            tribe: {
                "name": "Piconese",
                population: 1400000000, sign: "♓︎", patronGod: createPatronGodModifier({
                    name: "Poseidon",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }, description: "Poseidon is one of the twelve Lords of Kobol. Presiding over the sea, storms, earthquakes and horses. He was the protector of seafarers."
                }),
            }
        },
        {
            marker: { color: "#887266", radius: 8, label: "Tauron" },
            archetype: "kobol",
            orbit: { radius: 23, angle: 0, eccentricity: 0.025 },
            name: "Tauron",
            tribe: {
                name: "Minos",
                population: 2500000000, sign: "♉︎",
                patronGod: createPatronGodModifier({
                    name: "Ares",
                    onAdd: (entity) => {
                        return entity;
                    }, onRemove: (entity) => {
                        return entity;
                    }, description: "Ares is the god of war and courage. He is one of the Lords of Kobol, and the son of Zeus and Hera. He embodies the physical valor necessary for success in war but can also personify sheer brutality and bloodlust, in contrast to his sister Athena, whose martial functions include military strategy and generalship. An association with Ares endows places, objects, and other deities with a savage, dangerous, or militarized quality."
                }),
            }
        }
    ]
} as const as ObitingBodyBlueprint;
