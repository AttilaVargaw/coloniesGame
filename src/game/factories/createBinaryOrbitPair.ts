import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { createBody } from "./createBody"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { ColorComponent } from "@/engine/components/colorComponent"
import { LabelComponent } from "@/engine/components/label"
import { OrbitComponent } from "@/engine/components/orbitComponent"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { angularSpeed } from "../utils/orbital"
import { applyComponents } from "./helpers"
import { OrbitalBlueprint } from "../data/OrbitalBlueprint"

const makeOrbitArgs = (angle: number, barycentreOrbitRadius: number) => ({
    radius: barycentreOrbitRadius * UNIVERSE_SCALE,
    angle,
    eccentricity: 0,
})

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
    const barycentre = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(10),
        new LabelComponent("barycentre", 18, { x: 25, y: 0, z: 1 }, "white"),
        new OrbitComponent(
            parent.id,
            barycentreOrbitRadius,
            angularSpeed(barycentreOrbitRadius),
            angle ?? Math.random() * TWO_PI,
            eccentricity ?? 0
        ),
        new ColorComponent("white")
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

    bodyA.addComponent(new SelectableComponent(10, "green"))
    bodyB.addComponent(new SelectableComponent(10, "green"))

    children?.forEach((child) => {
        createBody(child, barycentre, engine)
    })

    return { bodyA, bodyB };
}
