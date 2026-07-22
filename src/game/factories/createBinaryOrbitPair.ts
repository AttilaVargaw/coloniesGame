import { Engine } from "@/engine/core/engine"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { calculateSoi, createLabel } from "./helpers"
import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { PositionComponent } from "@engine/components/position"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { SoiComponent } from "@/engine/components/soiComponent"
import { Colony } from "../data/types"
import { applyComponents } from "./helpers"
import { createColony } from "./createColony"

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    colonyA: Pick<Colony, "name" | "radius" | "distanceFromParent" | "soi" | "archetype" | "patronGod">,
    colonyB: Pick<Colony, "name" | "radius" | "distanceFromParent" | "soi" | "archetype" | "patronGod">,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const binaryAngularSpeed = 1.5 / Math.sqrt(separation / 2)

    const bodyA = createColony(engine, colonyA, parent)
    bodyA.addComponent(
        new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA)
    )
    bodyA.removeComponent(SelectableComponent)
    bodyA.addComponent(new SelectableComponent(10, "green"))

    const soiCircleA = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(calculateSoi(colonyA.radius, colonyA.archetype)),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    const bodyB = createColony(engine, colonyB, parent)
    bodyB.addComponent(
        new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA + Math.PI)
    )
    bodyB.removeComponent(SelectableComponent)
    bodyB.addComponent(new SelectableComponent(10, "green"))

    const soiSizeB = bodyB.getComponent(SoiComponent)!.radius
    const soiCircleB = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiSizeB),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    const soiCircle2 = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(calculateSoi(colonyB.radius, colonyB.archetype)),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    engine.addEntity(bodyA, parent).addEntity(soiCircleA, bodyA)
    engine.addEntity(bodyB, parent).addEntity(soiCircleB, bodyB)
    engine.addEntity(soiCircle2, parent);

    return { bodyA, bodyB };
}
