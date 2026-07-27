import { createPatronGodModifier } from "./createPatronGodModifier";
import { TribalData } from "./types";

export const tribes = new Map<string, TribalData>([
    ["Gemenese", {
        name: "Gemenese",
        sign: "♊︎",
        patronGod: createPatronGodModifier({
            modifiers: { fertility: "+2" },
            name: "Hera",
            onAdd: (entity) => {
                return entity;
            }, onRemove: (entity) => {
                return entity;
            }, description: "Hera is the goddess of marriage, women, and family, and the protector of women during childbirth. In mythology, she is queen among the twelve Lord of Kobol, sister and wife of Zeus, and daughter of the Titans Cronus and Rhea."
        }),
    }],
    ["Piconese", {
        "name": "Piconese",
        sign: "♓︎", patronGod: createPatronGodModifier({
            name: "Poseidon",
            onAdd: (entity) => {
                return entity;
            }, onRemove: (entity) => {
                return entity;
            }, description: "Poseidon is one of the twelve Lords of Kobol. Presiding over the sea, storms, earthquakes and horses. He was the protector of seafarers."
        }),

    }],
    ["Tauron", {
        name: "Tauronian",
        sign: "♉︎",
        patronGod: createPatronGodModifier({
            name: "Ares",
            onAdd: (entity) => {
                return entity;
            }, onRemove: (entity) => {
                return entity;
            }, description: "Ares is the god of war and courage. He is one of the Lords of Kobol, and the son of Zeus and Hera. He embodies the physical valor necessary for success in war but can also personify sheer brutality and bloodlust, in contrast to his sister Athena, whose martial functions include military strategy and generalship. An association with Ares endows places, objects, and other deities with a savage, dangerous, or militarized quality."
        }),
    }],
    ["Leonis", { sign: "︎♌︎", name: "Leonid" }],
    ["Virgon", { sign: "♍︎", name: "Virgonese" }],
    ["Libran", { sign: "♎︎", name: "Libran" }],
    ["Sagitarran", { sign: "♐︎", name: "Sagitarran" }],
    ["Scorpia", { sign: "♏︎", name: "Scorpian" }],
    ["Caprica", { sign: "♑︎", name: "Caprican" }],
    ["Aquaria", { sign: "♒︎", name: "Aquarian" }],
    ["Picon", { sign: "♓︎", name: "Piconese" }],
    ["Aerilon", { sign: "♈︎", name: "Aerilonian" }],
])
