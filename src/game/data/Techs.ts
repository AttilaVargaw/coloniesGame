export type TechEffect =
    | { type: "sector_efficiency"; sector: string; multiplier: number }
    | { type: "material_requirement"; good: string; reduction: number }
    | { type: "worker_efficiency"; worker: string; multiplier: number }
    | { type: "capital_multiplier"; sector: string; multiplier: number }
    | { type: "unlock_sector"; sector: string }
    | { type: "unlock_good"; good: string };

export type TechType = "archeological" | "technological" | "military" | "diplomatic";
export type Age = "rediscovery" | "imperial" | "techRevolution" | "unification"

export type TechDefinition = {
    id: string;
    name: string;
    description?: string;
    cost: { researchPoints: number; days: number };
    prerequisites?: Set<string>;
    effects: TechEffect[];
    unlocks?: Set<keyof typeof techs>;
    adoptionModel: "logistic" | "linear" | "instant";
    adoptionSpeed: number; // days to full adoption
    researchedText?: string
    type: TechType,
    age: Age
};

export const techs: Record<string, TechDefinition> = {
    "automation": {
        id: "automation",
        name: "Automation",
        description: "Reduces worker requirements across manufacturing sectors",
        cost: { researchPoints: 2000, days: 7 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 1.25 },
            { type: "worker_efficiency", worker: "engineer", multiplier: 1.15 },
            { type: "capital_multiplier", sector: "machineryFactory", multiplier: 1.2 },
        ],
        unlocks: new Set(),
        adoptionModel: "logistic",
        adoptionSpeed: 14,
        type: "technological",
        prerequisites: new Set(["microComputers"]),
        age: "imperial"
    },
    "robotics": {
        id: "robotics",
        name: "Robotics",
        description: "Further reduces labor requirements and boosts factory efficiency",
        cost: { researchPoints: 5000, days: 14 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 1.4 },
            { type: "sector_efficiency", sector: "consumerFactory", multiplier: 1.5 },
            { type: "sector_efficiency", sector: "electronics", multiplier: 1.5 },
        ],
        //unlocks: new Set(["automation"]),
        adoptionModel: "logistic",
        adoptionSpeed: 21,
        type: "technological",
        prerequisites: new Set(["automation"]),
        age: "techRevolution"
    },
    "synteticLifeformUnit": {
        id: "synteticLifeformUnit",
        name: "Synthetic Lifeform Units",
        description: "Unlocks the most advanced universal automated production systems ever known to man",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        type: "technological",
        prerequisites: new Set(["robotics", "metacognitiveProcessorUnit"]),
        age: "techRevolution",
    },
    "virtualReality": {
        id: "virtualReality",
        name: "Virtual Reality",
        description: "The most immersive experience ever created",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        unlocks: new Set([]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        type: "technological",
        prerequisites: new Set(["microComputers"]),
        age: "techRevolution"
    },

    "jupiterClassBattlestar": {
        id: "jupiterClassBattlestar",
        name: "Jupiter class Battle Star",
        description: "The most powerful flagship ever created",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["projectDaedalus"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "unification"
    },
    "battleStar": {
        id: "battleStar",
        name: "Battle Star",
        description: "The most powerful flagship ever created",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["cruiser", "carrier"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "techRevolution"
    },
    "cruiser": {
        id: "cruiser",
        name: "Cruiser",
        description: "A balanced warship",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["frigate"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "imperial"
    },
    "destroyer": {
        id: "destroyer",
        name: "Destroyer",
        description: "An escort",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["superAlloy", "jumpDrive", "ftlCom", "practicalPropulsion"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "imperial"
    },
    "frigate": {
        id: "frigate",
        name: "frigate",
        description: "A medium sized warship",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["corvette"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "imperial"
    },
    "corvette": {
        id: "corvette",
        name: "Corvette",
        description: "A small warship",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["destroyer"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "imperial"
    },
    "carrier": {
        id: "carrier",
        name: "Carrier",
        description: "A large warship",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["cruiser"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "military",
        age: "imperial"
    },

    "jumpDrive": {
        id: "jumpDrive",
        name: "Jump Drive",
        description: "According to the Scroll of the Technology, the ancients used this device to travel between the stars. There is no scientific theory to support the theoretical physics it mentions, but the scrolls were right many times before.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["tyliumReactor", "microComputers"]),
        type: "technological",
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        age: "rediscovery",
        researchedText: "Scientists never believed that we would be able to move information, let alone matter faster than the speed of light. Yet here we are. The principle behind this device is simple. Yet, it took an ancient diagram to rediscover it. They feel bad that they didn't discover it sooner. This will make space travel trivial."
    },
    "practicalPropulsion": {
        id: "practicalPropulsion",
        name: "Practical Propulsion",
        description: "According to the Scrolls of the Technology, the ancients used this device to travel between planets. If this works, it will make affordable space travel a reality.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["nuclearMotors"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        type: "technological",
        age: "rediscovery",
    },
    "nuclearMotors": {
        id: "nuclearMotors",
        name: "Nuclear Motors",
        description: "According to the Scrolls of the Exodus, they used this device as a backup energy source on the legendary Galleon. According to the scientist community, we can try to build one.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["originalScrolls"]),
        adoptionModel: "logistic",
        type: "technological",
        age: "rediscovery",
        adoptionSpeed: 28,
        researchedText: "We built the device, and it works. It's much safer and more efficient than any other nuclear reactor we have ever seen. The amount of radioactive waste created by the device is negligible because, according to the project's lead scientist, it basically 'sucks out the last joules of energy from the fission material.' Its design is radically different from any other, so it's no wonder we didn't invent it sooner."
    },

    "biodiversity": {
        id: "biodiversity",
        name: "Biodiversity",
        description: `There are barely any species in our words. According to our scientists, even if there was a big extinction event, there should be at least some fossils out there. We need to check every corners of our worlds to find the missing link between men and monkey, because if we can't prove that we evolved here, maybe we have to admit that the Scrolls of the Exodus are right and not just religious gobbledygook`,
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        adoptionModel: "instant",
        type: "archeological",
        age: "rediscovery",
        adoptionSpeed: 28,
        researchedText: "Unfortunately, we didn't found any proof of other subspecies of ours. The more interesting thing is that we found many traces of advanced technology, where they don't belong, such as hip prothesis in a 2000 years old skeleton. But this still doesn't answer the question of our origins, because it's still possible that there was a previous civilization which collapsed."
    },
    "originalScrolls": {
        age: "rediscovery",
        id: "originalScrolls",
        adoptionModel: "instant",
        adoptionSpeed: 28,
        type: "archeological",
        name: "originalScrolls",
        description: "Have you heard about the scandal at the Intercolonial Archeological Conference? A man began speaking about the authenticity of the Sacred Scrolls and our descent from the twelve tribes of Kobol. At first, it seemed absurd, but there was nothing wrong with him. He's not a religious weirdo; he's a well-respected scientist with serious experience. However, what he proposed was so unbelievable that everyone laughed at him. He claims that the illustrations in the scrolls are real blueprints of technology that became corrupted after being copied so many times. Many of the poems were originally scientific texts that were mistranslated. Later, priests decided to rewrite them as poems. He believes that if we could find the original scrolls, we could learn a lot from them.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        researchedText: "We found a set of scrolls in a private collection that, according to carbon dating, are more than 2,000 years old. The owner didn't want to sell them, but we convinced him with an extremely generous offer. The scrolls are written in an unknown Old Gemenese dialect, but we believe we can translate them. The diagrams resemble technical drawings more than religious symbols and appear to have been made with protractors, rulers, and compasses. They depict many things that were invented long ago, such as light bulbs, steam engines, airplanes, and rocket engines. However, there are many mysterious things in them that we don't understand. The strangest scroll contains more than 15,000 digits of pi. We are currently scanning the scrolls and plan to release them as the Lost and Found Scrolls of Technology. Many people will rejoice at this discovery, but many will also be furious.",
        prerequisites: new Set(["biodiversity"]),
    },
    "kobol": {
        age: "rediscovery",
        id: "kobol",
        name: "Kobol",
        type: "archeological",
        description: "'Everything started out there when the twelve tribes left Kobol and settled here in the Cyrannus star system.' The scrolls were right too many times, weren't they? If we could find it, it would be the greatest archeological achievement.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 },
        ],
        prerequisites: new Set(["originalScrolls"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
        researchedText: "We found the ruins of the oldest city on Gemenon, which is exactly where the Scrolls of Exodus said the twelve tribes of Kobol landed. We found many interesting things, including what appears to be the remains of a spacecraft that match a diagram in the scrolls. Unfortunately, we found no more clues in the ruins or the Sacred Scrolls. The spacecraft proves that the scrolls were true all along, even if we still don't know where Kobol is. Maybe one day, we will find it and take a look on the Great Opera House in the city of the Gods."
    },
    "tyliumReactor": {
        age: "rediscovery",
        description: "According to the Scrolls of the Technology, they used this device to power the legendary Galleon. According to the scientist community, we can try to build one.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        type: "technological",
        prerequisites: new Set(["nuclearMotors"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "tyliumReactor",
        name: "Tylium Reactor",
        researchedText: "We have successfully built a new type of reactor powered by a substance scientists have dubbed 'tylium'. This new energy source is much more efficient than other ones. Tylium can only be found in outer space because it is only stable in microgravity. However, we can still use it on our planet because its half-life in strong gravitational fields is about 500,000,000 years."
    },
    "ftlCom": {
        age: "rediscovery",
        description: "According to the Scrolls of the Technology, they used this device for faster than light communication and scanning. We can't prove if it will work, because we don't understand the mentioned physics behind it, but according to the scientist community, we can try to build one.",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["originalScrolls"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "ftlCom",
        name: "Ftl communication",
        researchedText: "We have successfully built a prototype which is stronger and more capable than any other communication device we have ever built. We can use it to communicate real time with other colonies and it will revolutionize space faring"
    },
    "microComputers": {
        age: "rediscovery",
        description: "The old way of electronic is a dead end, we have to move towards micro electronics",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set([]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "microComputers",
        name: "Micro Computers",
    },
    "neuralNetworks": {
        age: "techRevolution",
        description: "A revolutionary new type of processor, based on the human brain",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["microComputers"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "neuralNetworks",
        name: "Neural Networks",
    },
    "largeLanguageModel": {
        description: "This is a revolutionary new type of processor that can be trained to perform specific tasks using large enough datasets. Since they are just glorified state machines, they cannot invent anything new. However, they can be used to assist with specific repetitive tasks.",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["neuralNetworks"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "largeLanguageModel",
        name: "Large Language Model",
        age: "techRevolution",
    },
    "neuralCloneProcessor": {
        description: "This is a revolutionary new type of processor based on the neural map of a specific human brain. Since the mapping process destroys the brain, it can only be used on recently deceased individuals. This allows us to copy the thinking processes of a human brain. While these 'clones' cannot adapt to new situations, they can be used for specific tasks. Attention, after the cloning process, we strongly advice to get rid of all personal memories, as they can cause severe malfunctions in the future, including, but not limited to the ai taking up the personality of the deceased individual",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["neuralNetworks"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "neuralCloneProcessor",
        name: "Neural Clone Processor",
        age: "techRevolution",
    },
    "digitalPersonalityClone": {
        description: "This controversial process uses the same mapping method as creating a neural clone processor. However, instead of deleting personal memories, we preserve them. This enables us to create a digital copy of a human personality. This way, we can continue an interrogation that went awry or continue to use a deceased adviser as digital program.",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["neuralCloneProcessor"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "neuralCloneProcessor",
        name: "Neural Clone Processor",
        age: "techRevolution",
    },
    "metacognitiveProcessorUnit": {
        description: "This is a revolutionary new type of processor that can learn and adapt to new situations. These units must be used carefully as they remain in a permanent read and write mode and they can learn 'wrong' things, which can cause them to malfunction in the future. They should be discarded after a certain amount of time, doesn't matter how useful or irreplaceable they become",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["neuralNetworks"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        id: "metacognitiveProcessorUnit",
        name: "Metacognitive Processor Unit",
        age: "techRevolution",
    },
    "superAlloy": {
        id: "superAlloy",
        name: "Super Materials",
        description: "Inside the Scroll of Technology, we found a chemical receipt, which can be used to make an alloy, which can withstand the extreme conditions of space",
        cost: { researchPoints: 10000, days: 28 },
        type: "technological",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["originalScrolls"]),
        adoptionModel: "logistic",
        adoptionSpeed: 28,
        age: "rediscovery",
    },
    "projectJupiter": {
        id: "projectJupiter",
        name: "Project Jupiter",
        description: "In order to win the war, we must build the most powerful warships ever. However, this could cause political turmoil, so we must ensure that all colonies agree before starting the project",
        cost: { researchPoints: 10000, days: 28 },
        type: "diplomatic",
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["battleStar"]),
        adoptionModel: "instant",
        age: "unification",
        adoptionSpeed: 28,
        researchedText: "After much diplomatic maneuvering, we came to the conclusion that a simple treaty would not suffice. The weaker colonies want a guarantee that they will not be suppressed by the stronger ones after we win the war. As a symbolic gesture, we promised to gift each colony a warship of this new class. It's a good start, but there's still a long way to go."
    },
    "articlesOfColonization": {
        type: "diplomatic",
        id: "articlesOfColonization",
        name: "Articles of Colonization and Charter of Unification",
        description: "We need to design a new constitutional framework for the colonies that guarantees the rights and freedoms of every person, regardless of which colony they are from. This is an extremely daunting task because no one has ever considered it before.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["projectJupiter"]),
        age: "unification",
        adoptionModel: "instant",
        adoptionSpeed: 28,
        researchedText: "The Articles of Colonization, §1: 'We, the representatives of the Twelve Worlds of Man, hereby agree that no colony shall be allowed to suppress another colony, as we are all equal colonies founded by the people of Kobol.' The Charter of Unification, §1: 'We, the representatives of the Twelve Worlds of Man, agree to build and maintain a unified government and fleet to protect and serve the interests of the people of Kobol. We hereby name the new government the United Colonies of Kobol and the new fleet the Colonial Fleet.' Both documents are signed. We are one people now. We are ready."
    },
    "projectDaedalus": {
        type: "technological",
        age: "unification",
        id: "projectDaedalus",
        name: "Project Daedalus",
        description: "We need to build the biggest mobile shipyard ever built, as building the ships in one place is too risky in the middle of the war.",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set(["articlesOfColonization"]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
    },
    "banningNukes": {
        type: "diplomatic",
        age: "techRevolution",
        id: "banningNukes",
        name: "Banning Nuclear Weapons",
        description: "We need to ban nuclear weapons to prevent any war from escalating, so peace can be achieved in our and our children lifetime",
        cost: { researchPoints: 10000, days: 28 },
        effects: [
            { type: "worker_efficiency", worker: "worker", multiplier: 2.0 },
            { type: "sector_efficiency", sector: "all", multiplier: 1.75 }
        ],
        prerequisites: new Set([]),
        adoptionModel: "instant",
        adoptionSpeed: 28,
    }
} as const

//@ts-ignore
export const TECHS = new Map<string, TechDefinition>((Object.entries(techs)).map(([key, value]) => {
    return [key, value]
}))

export const techTypes = new Map<TechType, Set<string>>()

TECHS.forEach((tech, key) => {
    if(!techTypes.has(tech.type)) {
        techTypes.set(tech.type, new Set<string>());
    }
    techTypes.get(tech.type)?.add(key);
});

export function getTech(id: string): TechDefinition | undefined {
    return TECHS.get(id);
}

export function getAllTechs(): TechDefinition[] {
    return Object.values(TECHS);
}

// export function getPrerequisiteIds(techId: string): string[] {
//     const tech = TECHS.get(techId);
//     return tech ? tech.prerequisites : [];
// }
