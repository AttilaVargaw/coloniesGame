import { Engine } from "@/engine/core/engine"
import { STARMAP_COORD_SCALE, UNIVERSE_SCALE } from "../constants"
import { createStar } from "./createStar"
import { createBody } from "./createBody"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { Star } from "../data/types"

export function createSolarSystem(engine: Engine, { x, y, planets, soi, binaryPairs = new Map(), color }: Star) {
    const star = createStar(engine, { x: x * STARMAP_COORD_SCALE, y: y * STARMAP_COORD_SCALE, soi: soi ?? 2000, color })

    const binaryPairPlanetNames = new Set<string>()

    for(const [, planet] of planets) {
        for(const [key] of binaryPairs) {
            const [nameA, nameB] = key.split("-")
            if(planet.name === nameA || planet.name === nameB) {
                binaryPairPlanetNames.add(planet.name)
            }
        }
    }

    for(const [key, separation] of binaryPairs) {
        const [nameA, nameB] = key.split("-")
        const planetA = planets.get(nameA)!
        const planetB = planets.get(nameB)!

        createBinaryOrbitPair(
            engine,
            star,
            planetA,
            planetB,
            separation
        )
    }

    for(const [, planet] of planets) {
        if(binaryPairPlanetNames.has(planet.name)) continue

        createBody({
            engine,
            data: planet,
            parent: star,
            orbitArgs: {
                radius: planet.distanceFromParent * UNIVERSE_SCALE,
                angle: Math.random() * Math.PI * 2,
                eccentricity: planet.eccentricity ?? 0,
            }
        })
    }

    return star
}
