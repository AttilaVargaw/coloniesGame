import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";
import { BodyBlueprint } from "./BodyBlueprint";
import { SOLAR_UNIT } from "../constants";

export const MapCreationData = {
    marker: { color: "#0000", radius: 20, label: "root" },
    archetype: "sol",
    name: "root",
    radius: 0,
    orbit: { radius: 0, angle: 0, eccentricity: 0 },
    color: "alpha",
    vessels: [],
    systems: [{
        bodies: [{
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Helicon" },
            name: "Naucratis",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 15 * SOLAR_UNIT,
                angle: Math.PI / 2,
                inclination: 0
            },
        }],
    }, {
        bodies: [{
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Cocalus" },
            name: "Naucratis",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 15 * SOLAR_UNIT,
                angle: - Math.PI / 2,
                inclination: 0
            },
        }],
    }, {
        angle: Math.PI / 2,
        bodies: [ solarisAlpha, solarisBeta ],
        satellites: [{
            archetype: "jupiter",
            marker: { color: "#48a4ad", radius: 20, label: "Ragnar" },
            name: "Ragnar",
            orbit: {
                radius: 12 * SOLAR_UNIT,
                eccentricity: 0,
                inclination: 0.1
            },
            systems: [{
                bodies: [{
                    archetype: "venus", marker: { color: "blue", radius: 2, label: "Sigurd" }, name: "Sigurd", orbit: {
                        radius: 3,
                    }
                }],
            }]
        }, {
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Delium" },
            name: "Delium",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 10 * SOLAR_UNIT,
                angle: 0,
                inclination: 0
            },
        }, {
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Knossos" },
            name: "Knossos",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 10 * SOLAR_UNIT,
                angle: Math.PI,
                inclination: 0
            },
        }],
        orbit: {
            radius: 300,
            angle: 0,
            inclination: 0
        },
    }, {
        angle: Math.PI / 2,
        bodies: [ heliosGamma, heliosDelta ],
        satellites: [{
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Gortyn" },
            name: "Gortyn",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 10 * SOLAR_UNIT,
                angle: 0,
                inclination: 0
            },
        }, {
            archetype: "mars",
            marker: { color: "#888", radius: 20, label: "Naucratis" },
            name: "Naucratis",
            color: "#888",
            radius: 20,
            orbit: {
                radius: 10 * SOLAR_UNIT,
                angle: Math.PI,
                inclination: 0
            },
        }],
        orbit: {
            angle: Math.PI,
            radius: 300,
            inclination: 0
        },
    }]
} as const satisfies BodyBlueprint
