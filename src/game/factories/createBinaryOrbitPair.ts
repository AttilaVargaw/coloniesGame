import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { Colony } from "../data/types"
import { createColony } from "./createColony"

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    colonyA: Pick<Colony, "name" | "radius" | "distanceFromParent" | "archetype" | "patronGod" | "moons">,
    colonyB: Pick<Colony, "name" | "radius" | "distanceFromParent" | "archetype" | "patronGod" | "moons">,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const barycentreOrbitRadius = separation / 2

    const bodyA = createColony({
        engine,
        data: { ...colonyA, population: 0 },
        parent,
        orbitArgs: {
            radius: barycentreOrbitRadius,
            angle: angleA,
            eccentricity: 0,
        }
    })

    const bodyB = createColony({
        engine,
        data: { ...colonyB, population: 0 },
        parent,
        orbitArgs: {
            radius: barycentreOrbitRadius,
            angle: angleA + Math.PI,
            eccentricity: 0,
        }
    })

    bodyA.removeComponent(SelectableComponent)
    bodyA.addComponent(new SelectableComponent(10, "green"))
    bodyB.removeComponent(SelectableComponent)
    bodyB.addComponent(new SelectableComponent(10, "green"))

    return { bodyA, bodyB };
}
