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
        description: "According to the Scroll of the Technology, the ancients used this device to travel between the stars. There is no scientific theory to support the theoretical physics it mentions, but the scrolls were right many times before.",
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
        description: "According to the Scrolls of the Technology, the ancients used this device to travel between planets. If this works, it will make affordable space travel a reality.",
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
        description: "The Scrolls of Technology curse this invention. Fortunately for us, they explained how to build it, so we don't repeat their mistake.",
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
        description: `There are barely any species in our words. According to our scientists, even if there was a big extinction event, there should be at least some fossils out there. We need to check every corners of our worlds to find the missing link between men and monkey, because if we can't prove that we evolved here, maybe we have to admit that the Scrolls of the Exodus are right and not just religious gobbledygook`,
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        researchedText: "Unfortunately, we didn't found any proof of other subspecies of ours. The more interesting thing is that we found many traces of advanced technology, where they don't belong, such as hip prothesis in a 2000 years old skeleton. But this still doesn't answer the question of our origins, because it's still possible that there was a previous civilization which collapsed."
    },
    originalScrolls: {
        id: "originalScrolls",
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        name: "originalScrolls",
        description: "Had you heard about the scandal on the inter colonial archeological conference? There was a guy who started talking about that the Sacred Scrolls are true and that we are the descendants of the 12 tribes of Kobol, sounds like a complete nonsense. But what's wrong with the guy that there is nothing wrong with him. He is not a religious weirdo, he's a well respected scientist with serious experience, but what he proposed was so unbelievable that everyone laughed at him. According to him, the diagrams in the scroll are real blueprints of real technology, but they become corrupted after they were copied so many times. Many of the poems are not poems, but real scientific texts that were mistranslated, then later priest decided to rewrite them as poems. According to him, if we could find the original scrolls, we could learn a lot of from them.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        researchedText: "We have found a set of scrolls in a private collection, that according to carbon dating, are more than 2000 years old. The owner didn't want to sell them, but we managed to convince him by giving him an extremely generous offer. They were written in an unknown old gemenese dialect, but we think we can translate them. The diagrams look more like technical drawings than religious symbols, made by protractors, rulers and compasses. There are many already invented things in it, such as light bulbs, steam engines, airplanes, rocket engines. But there are many mysterius things in it, about that we have no clue. The strangest scroll contains more than 15000 digits of PI. We are currently scanning them and we are planning to release them as the new lost and found Scrolls of Technology. Many churches will rejoice this discovery, but many will be furious",
        unlocks: [],
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
        researchedText: "We found the oldest city on Gemenon, exactly where the scrolls of the exodus said the 12 tribes of Kobol landed. We found many interesting things, among them what seems to be the remains of a spacecraft, that match one of the diagrams in the scrolls. Unfortunately, we have no more clues in the ruins or in the Sacred Scrolls, where could we continue tracing back our origins, but the spacecraft is the proof that the scrolls were true all along"
    },
    tyliumReactor: {
        description: "According to the Scrolls of the Technology, they used this device to power the legendary Galleon. According to the scientist community, we can try to build one.",
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
        description: "Inside the Scroll of Technology, we found a chemical receipt, which can be used to make an alloy, which can withstand the extreme conditions of space",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    projectJupiter: {
        id: "projectJupiter",
        name: "Project Jupiter",
        description: "To win the war, we need to build the most powerful warships ever made. As this can cause a lot of political turmoil, we have to make it sure all colonies agree before we can start the project",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        researchedText: "After a lot diplomatic play, we've came to conclusion that a simple treaty wouldn't do. The weaker colonies want a guarantee that after we won the war, they will not be suppressed by the stronger ones anymore. As a symbolic gesture, we have promised to gift every colony a warship of this new class. It's a good start, but there is still a long way to go"
    },
    articlesOfColinization: {
        id: "projectJupiter",
        name: "Articles of Colonization and Charter of Unification",
        description: "We need to design a new constitutional framework for the colonies, which can guarantee the rights and freedoms of every man, regardless of colony. This is an extremely daunting task, as no one has ever even considered it before.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        researchedText: "Articles of Colonization, §1, 'We, the representatives of the Twelve Worlds of Man, hereby we agree that no Colony shall be allowed to be suppressed by another Colony, as we are all equal colonies of founded by the people of Kobol. Charter of Unification, §1, 'We, the representatives the Twelve Worlds of Man, hereby we agree that we build and maintain a unified government and fleet to protect and serve the interest of the people of Kobol. Thereby, we name the new government the United Colonies of Kobol and the new fleet the Colonial Fleet.' Both of them are signed. We are one people now. We are ready"
    },
    projectDaedalus: {
        id: "projectDaedalus",
        name: "Project Daedalus",
        description: "We need to build the biggest mobile shipyard ever built, as building the ships in one place is too risky in the middle of the war.",
        cost: { researchPoints: 10000, days: 28 },
        prerequisites: ["robotics"],
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        unlocks: [],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
    },
    banningNukes: {
        id: "banningNukes",
        name: "Banning Nuclear Weapons",
        description: "We need to ban nuclear weapons to prevent any war from escalating, so peace can be achieved in our and our children lifetime.",
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
