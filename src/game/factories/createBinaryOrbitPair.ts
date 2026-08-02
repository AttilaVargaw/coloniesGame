import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { createBody } from "./createBody"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { OrbitComponent } from "@/engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { applyComponents } from "./helpers"
import { OrbitalBlueprint } from "../data/OrbitalBlueprint"
import { createMarker } from "./createSpaceship"

const makeOrbitArgs = (angle: number, barycentreOrbitRadius: number) => ({
    radius: barycentreOrbitRadius * UNIVERSE_SCALE,
    angle,
    eccentricity: 0,
} as const)

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    planetA: BodyBlueprint,
    planetB: BodyBlueprint,
    separation: number,
    { radius, angle, eccentricity }: OrbitalBlueprint,
    children?: BodyBlueprint[]
) {
    //const angleA = Math.random() * TWO_PI
    const barycentreOrbitRadius = radius * UNIVERSE_SCALE
    const barycentre = applyComponents(createMarker(engine, { color: "white", radius: 10, label: "barycentre", labelColor: "white" }),
        new OrbitComponent(
            parent.id,
            barycentreOrbitRadius,
            angularSpeed(barycentreOrbitRadius),
            angle ?? Math.random() * TWO_PI,
            eccentricity ?? 0
        ),
    )

    const bodyA = createBody(
        { ...planetA, orbit: makeOrbitArgs(0, separation) },
        barycentre,
        engine,
    )

    const bodyB = createBody(
        { ...planetB, orbit: makeOrbitArgs(Math.PI, separation) },
        barycentre,
        engine,
    )

    engine.addEntity(barycentre, parent)

    children?.forEach((child) => {
        createBody(child, barycentre, engine)
    })

    return { bodyA, bodyB };
}
