import { Engine } from "@/engine/core/engine"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { JumpDriveComponent, SensorSuiteComponent, FuelComponent } from "../components/vessel"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { applyComponents } from "./helpers"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SHIP_RADIUS,  TWO_PI } from "../constants"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { Vessel } from "../data/types"
import { Entity } from "@engine/entities/entity"
import { LabelComponent } from "@/engine/components/label"

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new FuelComponent(100, 1),
        new SelectableComponent(SHIP_RADIUS, "red"),
        new TargetableComponent(),
        new ColorComponent("red"),
        new RadiusComponent(SHIP_RADIUS),
        new HoverableComponent("pointer", { width: SHIP_RADIUS, height: SHIP_RADIUS }),
        new LabelComponent(name, 18, { x: 0, y: 20, z: 1 }, "red"),
        new ClickableComponent(true, { width: SHIP_RADIUS, height: SHIP_RADIUS }, ({ target, event: { shiftKey }, worldX, worldY }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)

            if(shiftKey) {
                const targetSystem = engine.getSystem(TargetSystem)
                targetSystem?.setTarget(ship, target, worldX, worldY)
            } else {
                selectionSystem?.onSelectionChanged({ entity: target, type: "ship" })
            }
        })
    )

    engine.addEntity(ship)

    return ship
}

export function createVessel(
    engine: Engine,
    parent: Entity,
    { name, radius, orbitRadius, angle }: Vessel
) {
    const ship = createSpaceship(engine, { name })
    ship.getComponent(RadiusComponent)!.radius = radius

    const orbitAngle = angle ?? Math.random() * TWO_PI
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
