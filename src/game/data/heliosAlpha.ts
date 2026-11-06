import { IndustrialSectors } from "../components/Factories";
import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT, STAR_SIZE } from "@game/constants"

export const solarisAlpha = {
    name: "Helios Alpha",
    marker: { color: "#fffcc9", radius: STAR_SIZE, label: "Helios Alpha", emitLight: true },
    archetype: "sol",
    orbit: { radius: 300, angle: Math.PI / 2, eccentricity: 0, inclination: 0 },
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
            marker: { color: "#928262", radius: 90, label: "Zeus" },
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
                // fishery: 8_400_000,
                // foodFactory: 84_000_000,
                // waterTreatment: 7_000_000,
                // powerPlant: 5_600_000,
                // // services: 84_000_000,
                // // healthcare: 56_000_000,
                // // education: 12_600_000,
                // // government: 140_000_00,
                // // retail: 70_000_000,
                // tourism: 117_600_000,
                // shipInfrastructure: 5_600_000,
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
                // farm: 2_688_000,
                // foodFactory: 30_000_000,
                // // services: 72_000_000,
                // // retail: 60_000_000,
                // // healthcare: 24_000_000,
                // // education: 10_800_000,
                // construction: 7_200_000,
                // waterTreatment: 6_000_000,
                // powerPlant: 4_800_000,
                // // bank: 36_000_000,
                // // lawEnforcement: 24_000_000,
                // government: 36_000_00,
            }
        }],
    }, {
        orbit: { radius: 1.1 * SOLAR_UNIT, angle: 0, eccentricity: 0 },
        bodies: [{
            marker: { color: "#879cb8", radius: 8, label: "Caprica" },
            archetype: "kobol",
            orbit: { radius: 3, angle: 0, eccentricity: 0.0, inclination: 0 },
            name: "Caprica",
            axialTilt: 0.41,
            population: 4900000000,
            starterIndustries: {
                mine: 0.01,
                oilRig: 0.01,
                forestry: 0.01,
                farm: 0.01,
                fishery: 0.01,
                foodFactory: 0.03,
                meat: 0.03,
                waterTreatment: 0.01,
                powerPlant: 0.01,
                nuclearSector: 0.01,
                alternativeMedicine: 0.01,
                metalFactory: 0.01,
                lumberMill: 0.01,
                machineryFactory: 0.01,
                medicineFactory: 0.01,
                consumerFactory: 0.01,
                furnitureFactory: 0.015,
                ammunitionFactory: 0.01,
                weaponFactory: 0.01,
                construction: 0.01,
                services: 0.05,
                tourism: 0.01,
                education: 0.01,
                healthcare: 0.05,
                environmentControl: 0.006,
                bank: 0.01,
                religion: 0.01,
                lawEnforcement: 0.05,
                chemical: 0.01,
                recycling: 0.01,
                government: 0.05,
                automotive: 0.01,
                electronics: 0.01,
                railroadVehicles: 0.01,
                aircraft: 0.01,
                clothing: 0.01,
                ships: 0.01,
                postalServices: 0.01,
                paperFactory: 0.001,
                entertainmentIndustry: 0.01,
                informationTechnology: 0.01,
                drinkIndustry: 0.01,
                retail: 0.01,
                aircraftInfrastructure: 0.01,
                automotiveInfrastructure: 0.01,
                railroadInfrastructure: 0.01,
                shipInfrastructure: 0.01,
                spaceInfrastructure: 0.01,
                spaceShips: 0.01,
                defense: 0.05,
                militaryVehicles: 0.01,
                spaceGoodsTransport: 0.01,
                greenEnergy: 0.06
            } satisfies IndustrialSectors,
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
                // foodFactory: 84_000_000,
                // farm: 4_928_000,
                // construction: 16_800_000,
                // waterTreatment: 14_000_000,
                // services: 168_000_000,
                // powerPlant: 11_200_000,
            }
        }],
    }],
    asteroidBelts: [
        { innerRadius: 1.4 * SOLAR_UNIT, outerRadius: 2.0 * SOLAR_UNIT, color: "#22222aaa", name: "Erebos" },
    ]
} as Readonly<BodyBlueprint>