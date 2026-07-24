import { Engine } from "@/engine/core/engine"
import { applyComponents } from "./helpers"
import { UNIVERSE_SCALE } from "../constants"
import { angularSpeed } from "../utils/orbital"
import { createStar } from "./createStar"
import { createBody } from "./createBody"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { PositionComponent } from "@engine/components/position"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { Star } from "../data/types"
import { createVessel } from "./createSpaceship"

export function createSolarSystem(engine: Engine, { x, y, planets, soi, binaryPairs = new Map(), color }: Star) {
    const star = createStar(engine, { x: x * 100, y: y * 100, soi: soi ?? 2000, color })

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

        if(!planetA || !planetB) {
            continue
        }

        const barycentreOrbitRadius = (planetA.distanceFromParent + planetB.distanceFromParent) * UNIVERSE_SCALE / 2
        const barycentreAngularSpeed = angularSpeed(barycentreOrbitRadius)
        const barycentre = applyComponents(engine.createEntity(),
            new PositionComponent(0, 0),
            new OrbitComponent(
                star.id,
                barycentreOrbitRadius,
                barycentreAngularSpeed,
                Math.random() * Math.PI * 2,
                planetA.eccentricity ?? 0
            ),
        )
        engine.addEntity(barycentre, star)

        const { bodyA, bodyB } = createBinaryOrbitPair(
            engine,
            barycentre,
            planetA,
            planetB,
            separation
        )

        if(planetA.vessels) {
            for(const v of planetA.vessels) {
                createVessel(engine, bodyA, v)
            }
        }

        if(planetB.vessels) {
            for(const v of planetB.vessels) {
                createVessel(engine, bodyB, v)
            }
        }
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
