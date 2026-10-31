export type Law = {
    "name": string,
    "desc": string,
    "effects": {
        name: string,
        desc: string,
        disable?: boolean,
        sector?: string,
        enacted?: boolean,
        type: "output" | "input" | "workforce" | "populationChange" | "happiness"
    }[],
    "cost": number,
    "type": "social" | "economic" | "military"
}

export const laws = new Map([
    ["banningSyntetics", {
        "cost": 100,
        "desc": "Banning synthetics. Every kind of synthetics is banned from the country. No technology related to metacognitive processors is allowed to be produced, possessed or used.",
        "effects": [{
            "desc": "Synthetics are banned",
            "name": "syntheticsBanned",
            "value": 1
        }],
        "name": "Banning synthetics",
        "type": "social"
    }],
    ["banHunting", {
        "cost": 100,
        "desc": "Ban hunting.",
        "effects": [{
            "desc": "Hunting is banned",
            "name": "huntingBanned",
            "value": 1
        }],
        "name": "Banning hunting",
        "type": "social"
    }],
    ["banIndustrialFishingInNaturalWaters", {
        "cost": 100,
        "desc": "Ban fishing in natural waters.",
        "effects": [{
            "desc": "Hunting is banned",
            "name": "huntingBanned",
            "value": 1
        }],
        "name": "Banning hunting",
        "type": "social"
    }],
    ["banFossilEnergyProduction", {
        "cost": 100,
        "desc": "By banning the fossil energy production, the country is forced to rely on clean or renewable energy sources.",
        "effects": [{
            "desc": "Hunting is banned",
            "name": "huntingBanned",
            "value": 1
        }],
        "name": "Banning hunting",
        "type": "social"
    }],
    ["banNuclearEnergyProduction", {
        "cost": 100,
        "desc": "By banning the nuclear energy production, the country is forced to rely on clean or renewable energy sources.",
        "effects": [{
            "desc": "Hunting is banned",
            "name": "huntingBanned",
            "value": 1
        }],
        "name": "Banning hunting",
        "type": "social"
    }],
    ["banUncleanIndustries", {
        "cost": 100,
        "desc": "By banning so called 'medicine', alcohol, we can ensure the cleanliness of our people",
        "effects": [{
            "desc": "Medicine and alcohol is banned",
            "name": "huntingBanned",
            "value": 1
        }],
        "name": "Banning hunting",
        "type": "social"
    }],
])