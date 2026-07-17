import { Entity } from "./ems/entities/entity";
import { createPatronGodModifier, Modifier } from "./ems/modifiers/patronGod";

export type Colony = {
    readonly population?: number;
    readonly sign?: string;
    readonly patronGod?: Modifier;
    readonly name: string
    readonly radius: number
}

export type Star = {
    sign: string
    x: number
    y: number
    name: string,
    planets: Map<string, Colony>
}

export const StartState = {
    //map: { sectors: [] as Entity[] },
    map: { sectors: new Map<string, Entity>() },
} as const

// const twelveColonies = new Map<string, Colony>([
//     // ["Earth", { population: 8_300_000_000, sign: "Å", x: 0, y: 0 }],
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
// ] as const)


export const solarSystems = new Map<string, Star>([
    ["Helios Alpha", {
        name: "Helios Alpha",
        sign: "",
        x: 16, y: 10,
        planets: new Map([
            ["Icarus", { radius: 2, name: "Icarus" }],
            ["Zeus", { radius: 18, name: "Zeus" }],
            ["Caprica", {
                name: "Caprica",
                //name: colonyNames[0],
                radius: 12,
                population: 4_900_000_000, sign: "♑︎", patronGod: createPatronGodModifier({
                    name: "Apollo",
                    onAdd: (entity) => {
                        return entity
                    }, onRemove: (entity) => {
                        return entity
                    }, description: "Apollo is one of the Lords of Kobol. His numerous functions and representations include the Sun and light, prophecy, philosophy, truth, logic, inspiration, music, poetry, the arts, purification, medicine, healing, plague, archery, and masculine beauty. He is the son of Zeus and Leto, and the twin brother of Artemis, goddess of the hunt. He is considered to be the most beautiful god."
                })
            }],
            ["Gemenon", {
                radius: 14,
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
                name: "Picon",
                radius: 6,
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
                radius: 7,
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
