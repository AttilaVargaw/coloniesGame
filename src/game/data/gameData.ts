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
        x: 16, y: 18,
        soi: 2000,
        binaryPairs: new Map([["Caprica-Gemenon", 60]]),
        planets: new Map([
            ["Icarus", { distanceFromParent: 2, radius: 4, name: "Icarus", archetype: "mercury" }],
            ["Zeus", { distanceFromParent: 17, radius: 18, name: "Zeus", archetype: "venus" }],
            ["Caprica", {
                archetype: "earth",
                name: "Caprica",
                distanceFromParent: 11,
                radius: 8,
                population: 4_900_000_000, sign: "♑︎", patronGod: createPatronGodModifier({
                    name: "Apollo",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Apollo is one of the Lords of Kobol. His numerous functions and representations include the Sun and light, prophecy, philosophy, truth, logic, inspiration, music, poetry, the arts, purification, medicine, healing, plague, archery, and masculine beauty. He is the son of Zeus and Leto, and the twin brother of Artemis, goddess of the hunt. She is considered to be the most beautiful god."
                })
            }],
            ["Gemenon", {
                archetype: "earth",
                distanceFromParent: 13,
                radius: 8,
                name: "Gemenon",
                population: 2_800_000_000, sign: "♊︎", patronGod: createPatronGodModifier({
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
                archetype: "earth",
                distanceFromParent: 7,
                radius: 8,
                name: "Picon",
                population: 1_400_000_000, sign: "♓︎", patronGod: createPatronGodModifier({
                    name: "Poseidon",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Poseidon is one of the twelve Lords of Kobol. Presiding over the sea, storms, earthquakes and horses. He was the protector of seafarers."
                })
            }],
            ["Tauron", {
                archetype: "earth",
                distanceFromParent: 9,
                radius: 8,
                name: "Tauron",
                population: 2_500_000_000, sign: "♉︎", patronGod: createPatronGodModifier({
                    name: "Ares",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Ares is the god of war and courage. He is one of the Lords of Kobol, and the son of Zeus and Hera. He embodies the physical valor necessary for success in war but can also personify sheer brutality and bloodlust, in contrast to his sister Athena, whose martial functions include military strategy and generalship. An association with Ares endows places, objects, and other deities with a savage, dangerous, or militarized quality."
                })
            }]
        ] as const)
    }],
] as const)
