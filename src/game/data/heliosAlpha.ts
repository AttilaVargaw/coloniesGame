import { createPatronGodModifier } from "./createPatronGodModifier";
import { ObitingBodyBlueprint } from "./types";

export const solarisAlpha = {
    name: "Helios Alpha",
    color: "#fffcc9",
    archetype: "sol",
    radius: 10,
    orbit: { radius: 40, angle: 0, eccentricity: 0 },
    // binaryPairs: new Map([["Caprica-Gemenon", 1.45]]),
    children: [
        {
            color: "#f99838", orbit: {
                radius: 2,
            }, angle: 0, radius: 4, name: "Icarus", archetype: "mercury", eccentricity: 0.2
        },
        { color: "#b1b3ba", orbit: { radius: 44, angle: 0, eccentricity: 0.4 }, distanceFromParent: 44, radius: 4, name: "Persephone", archetype: "mercury", eccentricity: 0.4 },
        {
            color: "#928262", distanceFromParent: 30, orbit: { radius: 30, angle: 0, eccentricity: 0.007 }, radius: 40, name: "Zeus", archetype: "venus", eccentricity: 0.007, children: [
                { orbit: { radius: 2.1, angle: 0, eccentricity: 0.3 }, color: "#c7d9d7", distanceFromParent: 2.1, radius: 5, name: "Nike", archetype: "mars", eccentricity: 0.3 },
                { orbit: { radius: 4, angle: 0, eccentricity: 0.7 }, color: "#777678", distanceFromParent: 4, radius: 5, name: "Hebe", archetype: "mars", eccentricity: 0.7 }
            ]
        },
        {
            color: "#879cb8",
            archetype: "kobol",
            name: "Caprica",
            radius: 8,
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
                { name: "Minerva", radius: 4, orbit: { radius: 50, angle: 0, eccentricity: 0.007 } }
            ],
            angle: 0,
            orbit: {
                eccentricity: 0.017,
                radius: 24,
            }
        },
        {
            archetype: "kobol",
            distanceFromParent: 24,
            radius: 8,
            color: "#a08156",
            name: "Gemenon",
            angle: 0,
            orbit: {
                eccentricity: 0.02,
                radius: 24,
            },
            tribe: {
                population: 2800000000, sign: "♊︎",
                eccentricity: 0.02,
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
            archetype: "kobol",
            distanceFromParent: 20,
            radius: 8,
            color: "#56738c",
            name: "Picon",
            orbit: {
                eccentricity: 0.015,
                radius: 20,
            },
            tribe: {
                "name": "Piconese",
                population: 1400000000, sign: "♓︎", eccentricity: 0.015, patronGod: createPatronGodModifier({
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
            orbit: {
                eccentricity: 0.025,
                radius: 23,
            },
            archetype: "kobol",
            color: "#887266",
            children: [
                { orbit: { radius: 5, eccentricity: 0.1, angle: 0 }, color: "#97958c", radius: 5, name: "Minos", archetype: "mars" }
            ],
            radius: 8,
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
