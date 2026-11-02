export type LawEffect = {
    name: string;
    desc: string;
    type: "disable_sector" | "efficiency_penalty";
    sector?: string;
    value: number;
};

export type Law = {
    name: string;
    desc: string;
    effects: LawEffect[];
    cost: number;
    type: "social" | "economic" | "military";
};

export const laws = new Map<string, Law>([
    [
        "banFossilEnergyProduction",
        {
            name: "Ban Fossil Energy Production",
            desc: "Bans oil and coal power plants. Forces reliance on clean or nuclear energy.",
            cost: 1200,
            type: "economic",
            effects: [
                { name: "powerPlantBanned", desc: "Fossil power plants are disabled", type: "disable_sector", sector: "powerPlant", value: 0 },
                { name: "oilRigBanned", desc: "Oil rigs are disabled", type: "disable_sector", sector: "oilRig", value: 0 },
            ],
        },
    ],
    [
        "banNuclearEnergyProduction",
        {
            name: "Ban Nuclear Energy",
            desc: "Bans nuclear reactors and the nuclear sector.",
            cost: 1200,
            type: "social",
            effects: [
                { name: "nuclearBanned", desc: "Nuclear sector is disabled", type: "disable_sector", sector: "nuclearSector", value: 0 },
            ],
        },
    ],
    [
        "banUncleanIndustries",
        {
            name: "Ban Unclean Industries",
            desc: "Penalizes polluting heavy industry (chemicals, metal) unless cleaned up.",
            cost: 900,
            type: "social",
            effects: [
                { name: "chemicalPenalty", desc: "Chemical factory efficiency halved", type: "efficiency_penalty", sector: "chemical", value: 0.5 },
                { name: "metalPenalty", desc: "Metal factory efficiency halved", type: "efficiency_penalty", sector: "metalFactory", value: 0.5 },
            ],
        },
    ],
    [
        "banSyntetics",
        {
            name: "Ban Synthetics",
            desc: "Bans synthetic lifeforms and advanced automation. Slows high-tech industry.",
            cost: 1500,
            type: "social",
            effects: [
                { name: "electronicsPenalty", desc: "Electronics production penalized", type: "efficiency_penalty", sector: "electronics", value: 0.6 },
                { name: "itPenalty", desc: "IT services penalized", type: "efficiency_penalty", sector: "informationTechnology", value: 0.6 },
            ],
        },
    ],
    [
        "banHunting",
        {
            name: "Ban Hunting",
            desc: "Protects wildlife. Slightly reduces food production from fisheries.",
            cost: 300,
            type: "social",
            effects: [
                { name: "fisheryPenalty", desc: "Fishery output reduced", type: "efficiency_penalty", sector: "fishery", value: 0.8 },
            ],
        },
    ],
    [
        "banIndustrialFishingInNaturalWaters",
        {
            name: "Ban Industrial Fishing",
            desc: "Restricts large-scale fishing in natural waters.",
            cost: 500,
            type: "social",
            effects: [
                { name: "fisheryPenalty", desc: "Fishery output reduced", type: "efficiency_penalty", sector: "fishery", value: 0.6 },
            ],
        },
    ],
])
