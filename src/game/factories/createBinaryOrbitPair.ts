import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { Colony } from "../data/types"
import { createBody } from "./createBody"

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    colonyA: Colony,
    colonyB: Colony,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const barycentreOrbitRadius = separation / 2

    const makeOrbitArgs = (angle: number) => ({
        radius: barycentreOrbitRadius,
        angle,
        eccentricity: 0,
    })

    const bodyA = createBody({
        engine,
        data: colonyA,
        parent,
        orbitArgs: makeOrbitArgs(angleA)
    })

    const bodyB = createBody({
        engine,
        data: colonyB,
        parent,
        orbitArgs: makeOrbitArgs(angleA + Math.PI)
    })

    bodyA.removeComponent(SelectableComponent)
    bodyA.addComponent(new SelectableComponent(10, "green"))
    bodyB.removeComponent(SelectableComponent)
    bodyB.addComponent(new SelectableComponent(10, "green"))

    return { bodyA, bodyB };
}
