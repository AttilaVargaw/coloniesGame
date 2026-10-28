import { LUNAR_UNIT, SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const heliosGamma = {
    name: "Helios Gamma",
    marker: { color: "#fbf988", radius: STAR_SIZE, label: "Helios Gamma", emitLight: true },
    orbit: { radius: 300, eccentricity: 0, inclination: 0, angle: Math.PI / 2 },
    archetype: "sol",
    asteroidBelts: [
        { innerRadius: 0.4 * SOLAR_UNIT, outerRadius: 0.8 * SOLAR_UNIT, color: "#22222aaa", name: "Acheron" },
    ],
    systems: [{
        bodies: [{
            name: "Thanatos",
            archetype: "mercury",
            marker: { color: "#caa17f", radius: 8, label: "Thanatos" },
            orbit: { radius: 0.35 * SOLAR_UNIT, angle: 2, eccentricity: 0.017, inclination: 0 },
        }],
    }, {
        bodies: [{
            marker: { color: "#909ec0", radius: 8, label: "Scorpia" },
            orbit: { radius: SOLAR_UNIT * 1, eccentricity: 0.01, inclination: 0 },
            name: "Scorpia",
            archetype: "kobol",
            population: 450000000,
            starterIndustries: {
                tourism: 37_800_000,
                foodFactory: 27_000_000,
                meat: 22_500_000,
                // services: 27_000_000,
                retail: 22_500_000,
                entertainmentIndustry: 22_500_000,
                construction: 2_700_000,
                // healthcare: 18_000_000,
                // education: 4_050_000,
                mine: 2_250_000,
                spaceShips: 22_500_000,
                shipInfrastructure: 1_800_000,
            }
        }],
    }, {
        bodies: [{
            marker: { color: "#837a79", radius: 8, label: "Sagitarron" },
            name: "Sagitarron",
            archetype: "kobol",
            orbit: { radius: SOLAR_UNIT * 1.1, eccentricity: 0.1, inclination: 0 },
            population: 1700000000,
            starterIndustries: {
                farm: 14_960_000,
                foodFactory: 102_000_000,
                // services: 102_000_000,
                // healthcare: 68_000_000,
                construction: 10_200_000,
                waterTreatment: 8_500_000,
                // education: 15_300_000,
                alternativeMedicine: 13_600_000,
                // religion: 51_000_000,
                // retail: 85_000_000,
                government: 170_00_000,
            }
        }],
    }, {
        orbit: { radius: SOLAR_UNIT * 0.95, eccentricity: 0.1, inclination: 0.3 },
        bodies: [{
            orbit: { radius: 0, eccentricity: 0.1, inclination: 0.1 },
            marker: { color: "#759477", radius: 8, label: "Libran" },
            name: "Libran",
            archetype: "kobol",
            population: 2100000,
            starterIndustries: {
                government: 210_00,
                lawEnforcement: 105_000,
                // services: 126_000,
                education: 18_900,
                healthcare: 84_000,
                environmentControl: 10_500,
                construction: 12_600,
                foodFactory: 126_000,
            }
        },
        {
            archetype: "luna",
            marker: { color: "#909ec0", radius: 4, label: "Herse" },
            orbit: { radius: LUNAR_UNIT * 3.1 }, name: "Herse"
        },
        { archetype: "luna", marker: { color: "#7e816b", radius: 4, label: "Pandrossos" }, orbit: { radius: LUNAR_UNIT * 1.5 }, name: "Pandrossos" }],
    }, {
        bodies: [{
            name: "Ophion",
            archetype: "saturn",
            marker: { color: "#e9d46f", radius: 85, label: "Ophion" },
            orbit: { radius: 7 * SOLAR_UNIT, inclination: 0.45 },
            rings: [
                { color: "#e9d46f", innerRadius: 30, outerRadius: 50 }
            ]
        }],
    }],
} as Readonly<BodyBlueprint>
