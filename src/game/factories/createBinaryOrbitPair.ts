import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { Colony } from "../data/types"
import { createBody } from "./createBody"
import { OrbitComponent } from "@/engine/components/orbitComponent"
import { PositionComponent } from "@/engine/components/position"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { angularSpeed } from "../utils/orbital"
import { applyComponents } from "./helpers"

const makeOrbitArgs = (angle: number, barycentreOrbitRadius: number) => ({
    radius: barycentreOrbitRadius,
    angle,
    eccentricity: 0,
})

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    planetA: Colony,
    planetB: Colony,
    separation: number,
) {
    const angleA = Math.random() * TWO_PI
    const barycentreOrbitRadius = (planetA.radius + planetB.radius) / 2 * UNIVERSE_SCALE
    const barycentre = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new OrbitComponent(
            parent.id,
            (planetA.radius + planetB.radius) / 2 * UNIVERSE_SCALE,
            angularSpeed(barycentreOrbitRadius),
            Math.random() * TWO_PI,
            planetA.eccentricity ?? 0
        ),
    )

    const bodyA = createBody({
        engine,
        data: planetA,
        parent: barycentre,
        orbitArgs: makeOrbitArgs(angleA, separation * UNIVERSE_SCALE)
    })

    const bodyB = createBody({
        engine,
        data: planetB,
        parent: barycentre,
        orbitArgs: makeOrbitArgs(angleA + Math.PI, separation * UNIVERSE_SCALE)
    })

    engine.addEntity(barycentre, parent)

    bodyA.addComponent(new SelectableComponent(10, "green"))
    bodyB.addComponent(new SelectableComponent(10, "green"))

    return { bodyA, bodyB };
}
