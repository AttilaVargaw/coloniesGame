import { InfoComponent } from "@engine/components/infoComponent";
import type { Entity } from "@engine/entities/entity";
import type { Star } from "./types";

export function createPatronGodModifier({ name, description, onAdd, onRemove, modifiers }: { modifiers?: Record<string, string>, description: string, name: string, onAdd: (entity: Entity) => Entity, onRemove: (entity: Entity) => Entity }) {
    const nameComponent = new InfoComponent({ patronGod: name, description, ...modifiers })

    return {
        onAdd: (entity: Entity) => onAdd(entity).addComponent(nameComponent),
        onRemove: (entity: Entity) => onRemove(entity.removeComponent(InfoComponent)),
    }
}

export const solarSystems = new Map<string, Star>([
    ["Helios Alpha", {
        name: "Helios Alpha",
        sign: "",
        color: "#fffcc9",
        x: 16, y: 18,
        soi: 2000,
        binaryPairs: new Map([["Caprica-Gemenon", 1.45]]),
        planets: new Map([
            ["Icarus", { color: "#f99838", distanceFromParent: 2, radius: 4, name: "Icarus", archetype: "mercury", eccentricity: 0.2 }],
            ["Persephone", { color: "#b1b3ba", distanceFromParent: 44, radius: 4, name: "Persephone", archetype: "mercury", eccentricity: 0.4 }],
            ["Zeus", {
                color: "#928262", distanceFromParent: 30, radius: 40, name: "Zeus", archetype: "venus", eccentricity: 0.007, moons:
                    new Map([
                        ["Nike", { color: "#c7d9d7", distanceFromParent: 2.1, radius: 5, name: "Nike", archetype: "mars", eccentricity: 0.3 }],
                        ["Hebe", { color: "#777678", distanceFromParent: 4, radius: 5, name: "Hebe", archetype: "mars", eccentricity: 0.7 }]
                    ])
            }],
            ["Caprica", {
                color: "#879cb8",
                archetype: "kobol",
                name: "Caprica",
                distanceFromParent: 24,
                radius: 8,
                population: 4_900_000_000, sign: "♑︎", eccentricity: 0.017, patronGod: createPatronGodModifier({
                    name: "Apollo",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Apollo is one of the Lords of Kobol. His numerous functions and representations include the Sun and light, prophecy, philosophy, truth, logic, inspiration, music, poetry, the arts, purification, medicine, healing, plague, archery, and masculine beauty. He is the son of Zeus and Leto, and the twin brother of Artemis, goddess of the hunt. She is considered to be the most beautiful god."
                }),
                vessels: [
                    { name: "Minerva", radius: 4, orbitRadius: 50, angle: 0 }
                ]
            }],
            ["Gemenon", {
                archetype: "kobol",
                distanceFromParent: 24,
                radius: 8,
                color: "#a08156",
                name: "Gemenon",
                population: 2_800_000_000, sign: "♊︎", eccentricity: 0.02, patronGod: createPatronGodModifier({
                    modifiers: { fertility: "+2" },
                    name: "Hera",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Hera is the goddess of marriage, women, and family, and the protector of women during childbirth. In mythology, she is queen among the twelve Lord of Kobol, sister and wife of Zeus, and daughter of the Titans Cronus and Rhea."
                })
            }],
            ["Picon", {
                archetype: "kobol",
                distanceFromParent: 20,
                radius: 8,
                color: "#56738c",
                name: "Picon",
                population: 1_400_000_000, sign: "♓︎", eccentricity: 0.015, patronGod: createPatronGodModifier({
                    name: "Poseidon",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Poseidon is one of the twelve Lords of Kobol. Presiding over the sea, storms, earthquakes and horses. He was the protector of seafarers."
                })
            }],
            ["Tauron", {
                archetype: "kobol",
                color: "#887266",
                moons: new Map([
                    ["Minos", { color: "#97958c", distanceFromParent: 0.4, radius: 5, name: "Minos", archetype: "mars", eccentricity: 0.1 }]
                ]),
                distanceFromParent: 23,
                radius: 8,
                name: "Tauron",
                population: 2_500_000_000, sign: "♉︎", eccentricity: 0.025, patronGod: createPatronGodModifier({
                    name: "Ares",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Ares is the god of war and courage. He is one of the Lords of Kobol, and the son of Zeus and Hera. He embodies the physical valor necessary for success in war but can also personify sheer brutality and bloodlust, in contrast to his sister Athena, whose martial functions include military strategy and generalship. An association with Ares endows places, objects, and other deities with a savage, dangerous, or militarized quality."
                })
            }]
        ])
    } as Star],
] as const)
