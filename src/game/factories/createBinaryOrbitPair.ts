import { Engine } from "@/engine/core/engine"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { calculateSoi } from "./helpers"
import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { PositionComponent } from "@engine/components/position"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { Colony } from "../data/types"
import { applyComponents } from "./helpers"
import { createColony } from "./createColony"

function createBinaryBody(
    engine: Engine,
    parent: Entity,
    separation: number,
    colony: Pick<Colony, "name" | "radius" | "distanceFromParent" | "soi" | "archetype" | "patronGod" | "eccentricity">,
    angle: number
) {
    const angularSpeed = 1.5 / Math.sqrt(separation / 2)
    const body = createColony(engine, colony, parent)
    body.addComponent(new OrbitComponent(parent.id, separation / 2, angularSpeed, angle, colony.eccentricity ?? 0))
    body.removeComponent(SelectableComponent)
    body.addComponent(new SelectableComponent(10, "green"))

    const soiCircle = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(calculateSoi(colony.radius, colony.archetype)),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    return { body, soiCircle }
}

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    colonyA: Pick<Colony, "name" | "radius" | "distanceFromParent" | "soi" | "archetype" | "patronGod" | "eccentricity">,
    colonyB: Pick<Colony, "name" | "radius" | "distanceFromParent" | "soi" | "archetype" | "patronGod" | "eccentricity">,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const { body: bodyA, soiCircle: soiCircleA } = createBinaryBody(engine, parent, separation, colonyA, angleA)
    const { body: bodyB, soiCircle: soiCircleB } = createBinaryBody(engine, parent, separation, colonyB, angleA + Math.PI)

    engine.addEntity(bodyA, parent)
        .addEntity(soiCircleA, bodyA)
        .addEntity(bodyB, parent)
        .addEntity(soiCircleB, bodyB)

    return { bodyA, bodyB };
}
