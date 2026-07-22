import { Engine } from "@/engine/core/engine"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { createBody, createLabel } from "./helpers"
import { Entity } from "@engine/entities/entity"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    nameA: string,
    nameB: string,
    separation: number
) {
    const angleA = Math.random() * Math.PI * 2
    const binaryAngularSpeed = 1.5 / Math.sqrt(separation / 2)

    const bodyA = createBody(engine, {
        color: "cyan",
        radius: 15,
        hoverCursor: "pointer",
        clickWidth: 30,
        clickHeight: 30,
        onClick: ({ event: { shiftKey } }) => {
            if(shiftKey) {
                const selectionSystem = engine.getSystem(SelectionSystem)
                const selection = selectionSystem?.currentSelection()
                if(selection) {
                    const targetSystem = engine.getSystem(TargetSystem)
                    targetSystem?.setTarget(selection, bodyA)
                }
            } else {
                engine.dispatchEvent(
                    new SelectionChangedEvent({ data: bodyA, type: "colony" })
                );
            }
        }
    })
    bodyA.addComponent(
        new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA)
    )
    bodyA.addComponent(new SoiComponent(100))
    bodyA.addComponent(new PathComponent())
    bodyA.addComponent(new TargetableComponent())
    bodyA.addComponent(new SelectableComponent())

    const bodyB = createBody(engine, {
        color: "magenta",
        radius: 15,
        hoverCursor: "pointer",
        clickWidth: 30,
        clickHeight: 30,
        onClick: ({ event: { shiftKey } }) => {
            if(shiftKey) {
                const selectionSystem = engine.getSystem(SelectionSystem)
                const selection = selectionSystem?.currentSelection()
                if(selection) {
                    const targetSystem = engine.getSystem(TargetSystem)
                    targetSystem?.setTarget(selection, bodyB)
                }
            } else {
                engine.dispatchEvent(
                    new SelectionChangedEvent({ data: bodyB, type: "colony" })
                );
            }
        }
    })
    bodyB.addComponent(
        new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA + Math.PI)
    )
    bodyB.addComponent(new SoiComponent(100))
    bodyB.addComponent(new PathComponent())
    bodyB.addComponent(new TargetableComponent())
    bodyB.addComponent(new SelectableComponent())

    const labelA = createLabel(engine, nameA, 14, "white", 0, -25, 0)
    const labelB = createLabel(engine, nameB, 14, "white", 0, -25, 0)

    engine.addEntity(bodyA, parent).addEntity(labelA, bodyA);
    engine.addEntity(bodyB, parent).addEntity(labelB, bodyB);

    return { bodyA, bodyB };
}
