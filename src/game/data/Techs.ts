export type TechEffect =
    | { type: "sector_efficiency"; sector: string; multiplier: number }
    | { type: "material_requirement"; good: string; reduction: number }
    | { type: "worker_efficiency"; worker: string; multiplier: number }
    | { type: "capital_multiplier"; sector: string; multiplier: number }
    | { type: "unlock_sector"; sector: string }
    | { type: "unlock_good"; good: string };

export type TechDefinition = {
    id: string;
    name: string;
    description?: string;
    cost: { researchPoints: number; days: number };
    prerequisites: string[];
    effects: TechEffect[];
    unlocks: string[];
    adoptionModel: "logistic" | "linear";
    adoptionSpeed: number; // days to full adoption
    researchedText?: string
};

export const TECHS: Record<string, TechDefinition> = {
    automation: {
        id: "automation",
        name: "Automation",
        description: "Reduces worker requirements across manufacturing sectors",
        cost: { researchPoints: 2000, days: 7 },
        prerequisites: ["steel_production"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 1.25 },
            { type: "worker_efficiency", worker: "engineer", multiplier: 1.15 },
            { type: "capital_multiplier", sector: "machineryFactory", multiplier: 1.2 },
        ],
        unlocks: ["robotics"],
        adoptionModel: "logistic",
        adoptionSpeed: 14,
    },
    robotics: {
        id: "robotics",
        name: "Robotics",
        description: "Further reduces labor requirements and boosts factory efficiency",
        cost: { researchPoints: 5000, days: 14 },
        prerequisites: ["automation"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 1.4 },
            { type: "sector_efficiency", sector: "consumerFactory", multiplier: 1.5 },
            { type: "sector_efficiency", sector: "electronics", multiplier: 1.5 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 21,
    },
    synteticLifeformUnit: {
        id: "synteticLifeformUnit",
        name: "Synthetic Lifeform Units",
        description: "Unlocks the most advanced universal automated production systems ever known to man",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    virtualReality: {
        id: "virtualReality",
        name: "Virtual Reality",
        description: "The most immersive experience ever created",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    battleStar: {
        id: "battleStar",
        name: "Battle Star",
        description: "The most powerful flagship ever created",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    cruiser: {
        id: "cruiser",
        name: "Cruiser",
        description: "A balanced warship",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    destroyer: {
        id: "destroyer",
        name: "Destroyer",
        description: "An escort",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    frigate: {
        id: "frigate",
        name: "frigate",
        description: "A medium sized warship",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    corvette: {
        id: "corvette",
        name: "Corvette",
        description: "A small warship",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    carrier: {
        id: "carrier",
        name: "Carrier",
        description: "A large warship",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    jumpDrive: {
        id: "jumpDrive",
        name: "Jump Drive",
        description: "According to the Scroll of the Exodus, the ancients used this device to travel between the stars. There is no scientific theory to support the theoretical physics it mentions, but the scrolls were right many times before.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    practicalPropulsion: {
        id: "practicalPropulsion",
        name: "Practical Propulsion",
        description: "According to the Scrolls of the Exodus, the ancients used this device to travel between planets. If this works, it will make affordable space travel a reality.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    nuclearMotors: {
        id: "nuclearMotors",
        name: "Nuclear Motors",
        description: "According to the Scrolls of the Exodus, they used this device as a backup energy source on the legendary Galleon. According to the scientist community, we can try to build one.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    artificalIntelligence: {
        id: "artificalIntelligence",
        name: "Artifical Intelligence",
        description: "The Scrolls of Kobol curse this invention. Fortunately for us, they explained how to build it, so we don't repeat their mistake.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    biodiversity: {
        id: "biodiversity",
        name: "Biodiversity",
        description: `There are barely any species in our words. According to our scientists, even if there was a big extinction event, there should be at least some fossils out there. We need to check every corners of our worlds to find the missing link between men and monkey, because if we can' prove that we evolved here, maybe we have to admit that the Scrolls of the Exodus are right and not just religious gobbledygook`,
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        researchedText: "Unfortunately, we didn't found any proof of other subspecies of ours. The more interesting thing is that we found many traces of advanced technology, where they don't belong, such as hip prothesis in a 2000 years old skeleton"
    },
    kobol: {
        id: "kobol",
        name: "Kobol",
        description: "'Everything started out there when the 12 tribes left Kobol and settled here, in the four system of Cyrannus' The scrolls were right too many times, aren't they? If we could find it, that would be a greatest scientific achievement in archeology",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        researchedText: "We found the oldest city on Gemenon, exactly where the scrolls of the exodus said the 12 tribes of Kobol landed. We found many interesting things, among them what seems to be the remains of a spacecraft, that match one of the diagrams in the scrolls. Unfortunately, we have no more clues in the ruins or in the scrolls, where could we continue tracing back our origins, but the spacecraft is the proof that the scrolls were true all along"
    },
    tyliumReactor: {
        description: "According to the Scrolls of the Exodus, they used this device to power the legendary Galleon. According to the scientist community, we can try to build one.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "tyliumReactor",
        name: "Tylium Reactor",
    },
    microComputers: {
        description: "The old way of electronic is a dead end, we have to move towards micro electronics",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "microComputers",
        name: "Micro Computers",
    },
    superAlloy: {
        id: "superAlloy",
        name: "Super Alloy",
        description: "Inside the Sacred Scrolls, we found a chemical receipt, which can be used to make an alloy, which can withstand the extreme conditions of space",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    }
};

export function getTech(id: string): TechDefinition | undefined {
    return TECHS[id];
}

export function getAllTechs(): TechDefinition[] {
    return Object.values(TECHS);
}

export function getPrerequisiteIds(techId: string): string[] {
    const tech = TECHS[techId];
    return tech ? tech.prerequisites : [];
}
