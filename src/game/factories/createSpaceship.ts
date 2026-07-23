import { Engine } from "@/engine/core/engine"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { JumpDriveComponent, SensorSuiteComponent } from "../components/vessel"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { applyComponents, createLabel } from "./helpers"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SHIP_RADIUS, SHIP_CLICK_SIZE, COLONY_CLICK_SIZE } from "../constants"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { Vessel } from "../data/types"
import { Entity } from "@engine/entities/entity"

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new SelectableComponent(10, "red"),
        new TargetableComponent(),
        new ColorComponent("red"),
        new RadiusComponent(SHIP_RADIUS),
        new HoverableComponent("pointer", { width: SHIP_CLICK_SIZE, height: SHIP_CLICK_SIZE }),
    )

    engine.addEntity(ship)

    const clickArea = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0, -1),
        new ClickableComponent(true, { width: COLONY_CLICK_SIZE, height: COLONY_CLICK_SIZE }, ({ target, event: { shiftKey }, worldX, worldY }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)
            const targetSceneNode = engine.getSceneNode(target)!

            if(shiftKey) {
                const targetSystem = engine.getSystem(TargetSystem)
                targetSystem?.setTarget(ship, targetSceneNode.parentRef!.entity, worldX, worldY)
            } else {
                selectionSystem?.onSelectionChanged({ entity: targetSceneNode.parentRef!.entity, type: "ship" })
            }
        })
    )
    engine.addEntity(clickArea, ship)

    const label = createLabel(engine, name, 18, "red")
    engine.addEntity(label, ship)

    return ship
}

export function createVessel(
    engine: Engine,
    parent: Entity,
    { name, radius, orbitRadius, angle }: Vessel
) {
    const ship = createSpaceship(engine, { name })
    ship.getComponent(RadiusComponent)!.radius = radius

    const orbitAngle = angle ?? Math.random() * Math.PI * 2
    ship.addComponent(new OrbitComponent(parent.id, orbitRadius, angularSpeed(orbitRadius), orbitAngle))

    const pos = ship.getComponent(PositionComponent)!
    pos.x = Math.cos(orbitAngle) * orbitRadius
    pos.y = Math.sin(orbitAngle) * orbitRadius

    const shipNode = engine.getSceneNode(ship)
    const parentNode = engine.getSceneNode(parent)
    if(shipNode && parentNode) {
        shipNode.setParent(parentNode)
    }

    return ship
}
