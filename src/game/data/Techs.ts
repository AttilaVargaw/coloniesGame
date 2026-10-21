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
};

export const TECHS: Record<string, TechDefinition> = {
    basic_mining: {
        id: "basic_mining",
        name: "Basic Mining",
        description: "Improves ore extraction efficiency",
        cost: { researchPoints: 100, days: 1 },
        prerequisites: [],
        effects: [
            { type: "sector_efficiency", sector: "mine", multiplier: 1.1 },
            { type: "material_requirement", good: "ore", reduction: 0.05 },
        ],
        unlocks: ["advanced_metallurgy"],
        adoptionModel: "linear",
        adoptionSpeed: 3,
    },
    advanced_metallurgy: {
        id: "advanced_metallurgy",
        name: "Advanced Metallurgy",
        description: "Reduces ore consumption and boosts metal factory output",
        cost: { researchPoints: 500, days: 3 },
        prerequisites: ["basic_mining"],
        effects: [
            { type: "sector_efficiency", sector: "metalFactory", multiplier: 1.2 },
            { type: "material_requirement", good: "ore", reduction: 0.15 },
            { type: "capital_multiplier", sector: "metalFactory", multiplier: 1.1 },
        ],
        unlocks: ["steel_production"],
        adoptionModel: "logistic",
        adoptionSpeed: 7,
    },
    steel_production: {
        id: "steel_production",
        name: "Steel Production",
        description: "Unlocks advanced construction materials",
        cost: { researchPoints: 1200, days: 5 },
        prerequisites: ["advanced_metallurgy"],
        effects: [
            { type: "sector_efficiency", sector: "constructionMaterials", multiplier: 1.3 },
            { type: "material_requirement", good: "metals", reduction: 0.1 },
        ],
        unlocks: ["automation"],
        adoptionModel: "logistic",
        adoptionSpeed: 10,
    },
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
