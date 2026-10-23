import { LUNAR_UNIT, SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosDelta = {
    name: "Helios Delta",
    marker: { color: "#f7a75c", radius: STAR_SIZE, label: "Helios Delta", emitLight: true },
    archetype: "sol",
    orbit: { radius: 200, angle: -Math.PI / 2, eccentricity: 0, inclination: 0 },
    asteroidBelts: [
        { innerRadius: 0.7 * SOLAR_UNIT, outerRadius: 1.0 * SOLAR_UNIT, color: "#22222aaa", name: "Aelous" },
    ],
    systems: [{
        bodies: [{
            marker: { color: "#6a7a82", radius: 10, label: "Canceron" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.1, angle: Math.PI / 3, eccentricity: 0.007, inclination: 0 },
            name: "Canceron",
            population: 6_700_000_000,
            starterIndustries: {
                farm: 29_480_000,
                foodFactory: 402_000_000,
                luxuryFood: 335_000_000,
                mine: 67_000_000,
                metalFactory: 70_500_000,
                oilRig: 37_520_000,
                powerPlant: 53_600_000,
                consumerFactory: 536_000_000,
                furnitureFactory: 335_000_000,
                clothing: 670_000_000,
                // services: 402_000_000,
                // retail: 335_000_000,
                bank: 670_000_000,
                government: 670_00_000,
                construction: 80_400_000,
                // lawEnforcement: 335_000_000,
                // healthcare: 268_000_000,
                // education: 60_300_000,
                machineryFactory: 26_800_000,
            }
        }],
    }, {
        bodies: [{
            marker: { color: "#849cbe", radius: 10, label: "Aquaria" },
            archetype: "kobol", orbit: { radius: SOLAR_UNIT * 1.35, inclination: 0.4 }, name: "Aquaria", population: 25_000,
            starterIndustries: {
                fishery: 150,
                foodFactory: 1500,
                waterTreatment: 125,
                powerPlant: 100,
                // services: 1500,
                // healthcare: 1000,
                // education: 225,
                retail: 1250,
                tourism: 2100,
                government: 2500,
                construction: 150,
            }
        }],
    }, {
        bodies: [{
            marker: { color: "#ced0dd", radius: 10, label: "Aerilon" },
            archetype: "kobol", orbit: {
                radius: SOLAR_UNIT * 1.1,
                angle: 0,
                eccentricity: 0.007,
                inclination: 0
            }, name: "Aerilon", population: 1_200_000_000,
            starterIndustries: {
                farm: 10_560_000,
                foodFactory: 36_000_000,
                luxuryFood: 24_000_000,
                forestry: 15_600_000,
                lumberMill: 3_840_000,
                mine: 3_000_000,
                metalFactory: 2_526_000,
                machineryFactory: 2_400_000,
                waterTreatment: 6_000_000,
                powerPlant: 4_800_000,
                // services: 36_000_000,
                // retail: 30_000_000,
                // education: 10_800_000,
                // healthcare: 24_000_000,
            }
        }],
    }, {
        bodies: [{
            marker: { color: "#ecd591", radius: 10, label: "Styx" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.4, inclination: 0.8 }, name: "Styx"
        }],
    }, {
        bodies: [{
            marker: { color: "#a68b69", radius: 10, label: "Phoebe" },
            archetype: "mercury", orbit: { radius: SOLAR_UNIT * 0.6, angle: 0, inclination: 0 }, name: "Phoebe"
        }],
    }, {
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: Math.PI / 6, eccentricity: 0.007, inclination: 0 },
        bodies: [
            {
                orbit: { radius: 0.01, inclination: 0 },
                marker: { color: "#ae4937", radius: 10, label: "Hestia" },
                archetype: "saturn",
                name: "Hestia",
                systems: [{
                    orbit: { radius: 0.01, inclination: 0 },
                    bodies: [
                    ]
                },
                ]
            },
            { marker: { color: "#695a55", radius: 5, label: "Rhea" }, orbit: { radius: 2.1 * LUNAR_UNIT, angle: 0, eccentricity: 0.3, periapsis: 0.1, inclination: 1 }, name: "Rhea", archetype: "luna" },
            { marker: { color: "#7f9894", radius: 5, label: "Kronos" }, orbit: { radius: 3.1 * LUNAR_UNIT, angle: 0, eccentricity: 0.4 }, name: "Kronos", archetype: "luna" }
        ],
    }],
} as Readonly<BodyBlueprint> 
