import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT, STAR_SIZE } from "@game/constants"

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: STAR_SIZE, label: "Helios Alpha", emitLight: true },
    archetype: "sol",
    orbit: { radius: 200, angle: Math.PI / 2, eccentricity: 0, inclination: 0 },
    systems: [{
        bodies: [{
            marker: { color: "#f99838", radius: 4, label: "Icarus" },
            archetype: "mercury",
            orbit: { radius: 0.4 * SOLAR_UNIT, angle: 2, inclination: 0 },
            name: "Icarus",
        }],
    }, {
        bodies: [{
            marker: { color: "#b1b3ba", radius: 4, label: "Persephone" },
            archetype: "luna",
            orbit: { radius: 44, angle: 4, eccentricity: 0.4, inclination: 0 },
            name: "Persephone",
        }],
    }, {
        bodies: [{
            marker: { color: "#928262", radius: 40, label: "Zeus" },
            name: "Zeus",
            archetype: "jupiter",
            orbit: { radius: 6.5 * SOLAR_UNIT, angle: 5, eccentricity: 0.007, inclination: 0.05 },
            systems: [{
                orbit: { radius: 0.1, angle: 0 },
                bodies: [
                    { marker: { color: "#c7d9d7", radius: 5, label: "Nike" }, orbit: { radius: 4.8, angle: 0, eccentricity: 0.3 }, name: "Nike", archetype: "luna" },
                    { marker: { color: "#777678", radius: 5, label: "Hebe" }, orbit: { radius: 5.5, angle: 0, eccentricity: 0.5 }, name: "Hebe", archetype: "luna" }
                ]
            }]
        }],
    }, {
        bodies: [{
            marker: { color: "#56738c", radius: 8, label: "Picon" },
            archetype: "kobol",
            orbit: { radius: 0.95 * SOLAR_UNIT, angle: 4.2, eccentricity: 0.015, inclination: 0.2 },
            name: "Picon",
            population: 1_400_000_000,
            starterIndustries: {
                fishery: 8_400_000,
                foodFactory: 84_000_000,
                waterTreatment: 7_000_000,
                powerPlant: 5_600_000,
                // services: 84_000_000,
                // healthcare: 56_000_000,
                // education: 12_600_000,
                // government: 140_000_00,
                // retail: 70_000_000,
                tourism: 117_600_000,
                shipInfrastructure: 5_600_000,
            }
        }],
    }, {
        bodies: [{
            marker: { color: "#887266", radius: 8, label: "Tauron" },
            archetype: "kobol",
            orbit: { radius: 1.3 * SOLAR_UNIT, angle: 2, eccentricity: 0.025, inclination: 0 },
            name: "Tauron",
            population: 1_200_000_000,
            starterIndustries: {
                farm: 2_688_000,
                foodFactory: 30_000_000,
                // services: 72_000_000,
                // retail: 60_000_000,
                // healthcare: 24_000_000,
                // education: 10_800_000,
                construction: 7_200_000,
                waterTreatment: 6_000_000,
                powerPlant: 4_800_000,
                // bank: 36_000_000,
                // lawEnforcement: 24_000_000,
                government: 36_000_00,
            }
        }],
    }, {
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: 0, eccentricity: 0 },
        bodies: [{
            marker: { color: "#879cb8", radius: 8, label: "Caprica" },
            archetype: "kobol",
            orbit: { radius: 3, angle: 0, eccentricity: 0.0, inclination: 0 },
            name: "Caprica",
            population: 4900000000,
            starterIndustries: {
                // bank: 490_000_000,
                government: 490_000,
                informationTechnology: 245_000_00,
                // services: 294_000_000,
                // education: 44_100_000,
                entertainmentIndustry: 245_000_0,
                electronics: 245_000,
                machineryFactory: 24_500_00,
                consumerFactory: 500_000,
                healthcare: 196_000_0,
                lawEnforcement: 400_000,
                construction: 29_400_00,
                retail: 245_000,
                metalFactory: 24_500_00,
                powerPlant: 19_600_0,
                religion: 400_000,
                waterTreatment: 500_000,
                postalServices: 500_000
            },
            occupationStarterRatio: {
                farmer: 1.5,
                scientist: 1.8,
                worker: 45.3,
                healtcarePersonal: 5,
                policeMen: 1,
                teacher: 2,
                serviceWorker: 8.4,
                clergy: 2.0,
                clerks: 9,
                engineer: 4,
                stayAtHome: 20
            },
            vessels: [
                { marker: { color: "white", radius: 4, label: "Battlestar\nMinerva", }, orbit: { radius: 10, angle: 2, eccentricity: 0.007 } }
            ],
        }, {
            mass: 0.9,
            marker: { color: "#a08156", radius: 8, label: "Gemenon" },
            archetype: "kobol",
            orbit: { radius: 3, angle: Math.PI, eccentricity: 0.0, inclination: 0 },
            name: "Gemenon",
            population: 2800000000,
            starterIndustries: {
                // religion: 84_000_000,
                // education: 25_200_000,
                foodFactory: 84_000_000,
                farm: 4_928_000,
                construction: 16_800_000,
                waterTreatment: 14_000_000,
                // services: 168_000_000,
                powerPlant: 11_200_000,
            }
        }],
    }],
    asteroidBelts: [
        { innerRadius: 1.4 * SOLAR_UNIT, outerRadius: 2.0 * SOLAR_UNIT, color: "#22222aaa", name: "Erebos" },
    ]
} as Readonly<BodyBlueprint>