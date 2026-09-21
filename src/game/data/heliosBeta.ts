import { SOLAR_UNIT, STAR_SIZE } from "../constants";
import { BodyBlueprint } from "./BodyBlueprint";

export const solarisBeta = {
    name: "Helios Beta",
    marker: { color: "#fbe57d", radius: STAR_SIZE, label: "Helios Beta" },
    archetype: "sol",
    orbit: { radius: 300, eccentricity: 0 },
    children: [
        { archetype: "mars", marker: { color: "#b17d5d", radius: 8, label: "Pallas" }, orbit: { radius: 2 * SOLAR_UNIT, angle: 2, eccentricity: 0.017 }, name: "Pallas" },
        { archetype: "mercury", marker: { color: "#8f742d", radius: 8, label: "Troy" }, orbit: { radius: 0.3 * SOLAR_UNIT, angle: 2, eccentricity: 0.017 }, name: "Troy" },
        {
            population: 4300000000,
            marker: { color: "#4d5c6d", radius: 10, label: "Virgon" }, archetype: "kobol", orbit: { radius: 1.3 * SOLAR_UNIT }, name: "Virgon",
            children: [
                {
                    population: 100_000,
                    marker: { color: "#a0948d", radius: 4, label: "Hibernia" }, archetype: "kobol", orbit: { radius: 2.1 }, name: "Leonis"
                }
            ]
        },
        {
            population: 260000000,
            marker: { color: "#829873", radius: 10, label: "Leonis" }, archetype: "kobol", orbit: { radius: 0.95 * SOLAR_UNIT }, name: "Leonis"
        },
        {
            name: "Hera",
            archetype: "saturn",
            //name: "Hera",
            marker: { color: "#c67242", radius: 20, label: "Hera" },
            orbit: { radius: 7 * SOLAR_UNIT },
            children: [
                {
                    name: "Euboea",
                    archetype: "mercury",
                    marker: { color: "#888374", radius: 4, label: "Euboea" },
                    orbit: { radius: 2.4 },
                },
                {
                    name: "Iris",
                    archetype: "mercury",
                    marker: { color: "#71877d", radius: 4, label: "Iris" },
                    orbit: { radius: 1.8, eccentricity: 0.02 },
                }
            ]
        }
    ],
} as const satisfies BodyBlueprint;
