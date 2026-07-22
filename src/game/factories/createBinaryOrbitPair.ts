import { Engine } from "@/engine/core/engine"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { PathComponent } from "../components/pathComponent"
import { createBody, createLabel, applyComponents, calculateSoi } from "./helpers"
import { Entity } from "@engine/entities/entity"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { SoiComponent } from "@/engine/components/soiComponent"
import { Colony } from "../data/types"

export function createBinaryOrbitPair(
    engine: Engine,
    parent: Entity,
    {archetype: archetypeA, name: nameA}: Colony,
    {archetype: archetypeB, name: nameB}: Colony,
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
        onClick: ({ event: { shiftKey }, worldX, worldY }) => {
            if(shiftKey) {
                const selectionSystem = engine.getSystem(SelectionSystem)
                const selection = selectionSystem?.currentSelection()
                if(selection) {
                    const targetSystem = engine.getSystem(TargetSystem)
                    targetSystem?.setTarget(selection, bodyA, worldX, worldY)
                }
            } else {
                engine.dispatchEvent(
                    new SelectionChangedEvent({ data: bodyA, type: "colony" })
                );
            }
        }
    })
    const soiSizeA = calculateSoi(bodyA.getComponent(RadiusComponent)!.radius, archetypeA)
    bodyA.addComponent(
        new OrbitComponent(parent.id, separation / 2, binaryAngularSpeed, angleA)
    )
    bodyA.addComponent(new SoiComponent(soiSizeA))
    bodyA.addComponent(new PathComponent())
    bodyA.addComponent(new TargetableComponent())
    bodyA.addComponent(new SelectableComponent(10, "green"))

    const soiCircleA = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiSizeA),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    const bodyB = createBody(engine, {
        color: "magenta",
        radius: 15,
        hoverCursor: "pointer",
        clickWidth: 30,
        clickHeight: 30,
        onClick: ({ event: { shiftKey }, worldX, worldY }) => {
            if(shiftKey) {
                const selectionSystem = engine.getSystem(SelectionSystem)
                const selection = selectionSystem?.currentSelection()
                if(selection) {
                    const targetSystem = engine.getSystem(TargetSystem)
                    targetSystem?.setTarget(selection, bodyB, worldX, worldY)
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
    const soiSizeB = calculateSoi(bodyB.getComponent(RadiusComponent)!.radius, archetypeB)

    bodyB.addComponent(new SoiComponent(soiSizeB))
    bodyB.addComponent(new PathComponent())
    bodyB.addComponent(new TargetableComponent())
    bodyB.addComponent(new SelectableComponent(10, "green"))

    const soiCircleB = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiSizeB),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    const soiCircle2 = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiSizeB * 2),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    const labelA = createLabel(engine, nameA, 14, "white", 0, -25, 0)
    const labelB = createLabel(engine, nameB, 14, "white", 0, -25, 0)

    engine.addEntity(bodyA, parent).addEntity(soiCircleA, bodyA).addEntity(labelA, bodyA);
    engine.addEntity(bodyB, parent).addEntity(soiCircleB, bodyB).addEntity(labelB, bodyB);
    engine.addEntity(soiCircle2, parent);

    parent.addComponent(new SoiComponent(separation))

    return { bodyA, bodyB };
}
