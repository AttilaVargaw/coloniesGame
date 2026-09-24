import { solarisAlpha } from "./heliosAlpha";
import { solarisBeta } from "./heliosBeta";
import { heliosGamma } from "./heliosGamma";
import { heliosDelta } from "./heliosDelta";
import { BodyBlueprint } from "./BodyBlueprint";
import { LUNAR_UNIT, SOLAR_UNIT } from "../constants";
import asteroid1 from "../../components/icons/asteroid1.png"
import asteroid2 from "../../components/icons/asteroid2.png"
import asteroid3 from "../../components/icons/asteroid3.png"
import asteroid4 from "../../components/icons/asteroid4.png"
import asteroid5 from "../../components/icons/asteroid5.png"
import asteroid6 from "../../components/icons/asteroid6.png"

const navigationalBodySize = 40

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
            navigationalPoint: true,
            archetype: "mars",
            marker: { color: "#888", radius: navigationalBodySize, label: "Helicon", texture: asteroid1 },
            name: "Helicon",
            orbit: {
                radius: 300,
                angle: Math.PI / 2,
                inclination: 0,
            },

        }],
    }, {
        bodies: [{
            navigationalPoint: true,
            archetype: "mars",
            marker: { color: "#888", radius: navigationalBodySize, label: "Cocalus", texture: asteroid2 },
            name: "Cocalus",
            color: "#888",
            orbit: {
                radius: 300,
                angle: -Math.PI / 2,
                inclination: 0
            },
        }],
    }, {
        angle: -Math.PI / 2,
        bodies: [solarisAlpha, solarisBeta, {
            navigationalPoint: true,
            archetype: "mars",
            marker: { color: "#888", radius: navigationalBodySize, label: "Delium", texture: asteroid3 },
            name: "Delium",
            color: "#888",
            orbit: {
                radius: 10 * SOLAR_UNIT,
                angle: Math.PI,
                inclination: 0
            },
        }, {
                navigationalPoint: true,
                archetype: "mars",
                marker: { color: "#888", radius: navigationalBodySize, label: "Knossos", texture: asteroid4 },
                name: "Knossos",
                color: "#888",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: 0,
                    inclination: 0
                },
            }],
        satellites: [{
            archetype: "uranus",
            navigationalPoint: true,
            marker: { color: "#48a4ad", radius: 20, label: "Ragnar" },
            name: "Ragnar",
            orbit: {
                radius: 12 * SOLAR_UNIT,
                eccentricity: 0,
                inclination: 0.1
            },
            systems: [{
                bodies: [{
                    archetype: "luna", marker: { color: "blue", radius: 2, label: "Sigurd" }, name: "Sigurd", orbit: {
                        radius: 3 * LUNAR_UNIT,
                    }
                }],
            }]
        }],
        orbit: {
            radius: 300,
            angle: Math.PI,
            inclination: 0
        },
    }, {
        angle: -Math.PI / 2,
        bodies: [heliosGamma,
            heliosDelta, {
                archetype: "mars",
                navigationalPoint: true,
                marker: { color: "#888", radius: navigationalBodySize, label: "Gortyn", texture: asteroid5 },
                name: "Gortyn",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: Math.PI,
                    inclination: 0
                },
            }, {
                archetype: "mars",
                navigationalPoint: true,
                marker: { color: "#888", radius: navigationalBodySize, label: "Naucratis", texture: asteroid6 },
                name: "Naucratis",
                radius: 20,
                orbit: {
                    radius: 10 * SOLAR_UNIT,
                    angle: 0,
                    inclination: 0
                },
            }],
        orbit: {
            angle: 0,
            radius: 300,
            inclination: 0
        },
    }]
} as const satisfies BodyBlueprint
