import { Engine } from "@/engine/core/engine"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent, WorldPosition } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { JumpDriveComponent, SensorSuiteComponent, FuelComponent } from "../components/vessel"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { applyComponents, descartesToPolar } from "./helpers"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SHIP_RADIUS, TWO_PI } from "../constants"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { MapMarker, VesselBlueprint } from "../data/types"
import { Entity } from "@engine/entities/entity"
import { LabelComponent } from "@/engine/components/label"

export function createMarker(engine: Engine, { offset, color, radius, label, labelColor = "red", textSize = 18, shade = false }: MapMarker) {
    const marker = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new ColorComponent(color, "", shade),
        new RadiusComponent(radius))

    if(label) {
        marker.addComponent(new LabelComponent(label, textSize, offset ?? { x: radius * 2 + 10, y: 0, z: 0 } as WorldPosition, labelColor))
    }

    return marker
}

export function createSpaceship(engine: Engine, { name }: { name: string }) {
    const ship = createMarker(engine, {
        color: "red",
        radius: SHIP_RADIUS,
        label: name,
        labelColor: "red",
        textSize: 18
    })

    applyComponents(ship,
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new FuelComponent(100, 1),
        new SelectableComponent(SHIP_RADIUS, "red"),
        new TargetableComponent(),
        new HoverableComponent("pointer", { width: SHIP_RADIUS, height: SHIP_RADIUS }),
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
    { marker: { color, label, radius, labelColor, textSize }, orbit: { radius: orbitRadius, angle } }: VesselBlueprint
) {
    const orbitAngle = angle ?? Math.random() * TWO_PI

    const ship = applyComponents(createMarker(engine, { color, radius, label, labelColor, textSize }),
        new PositionComponent(...descartesToPolar(orbitAngle, orbitRadius)),
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new FuelComponent(100, 1),
        new SelectableComponent(SHIP_RADIUS, "red"),
        new TargetableComponent(),
        new RadiusComponent(SHIP_RADIUS),
        new HoverableComponent("pointer", { width: SHIP_RADIUS, height: SHIP_RADIUS }),
        new ClickableComponent(true, { width: SHIP_RADIUS, height: SHIP_RADIUS }, ({ target, event: { shiftKey }, worldX, worldY }) => {
            const selectionSystem = engine.getSystem(SelectionSystem)

            if(shiftKey) {
                const targetSystem = engine.getSystem(TargetSystem)
                targetSystem?.setTarget(ship, target, worldX, worldY)
            } else {
                selectionSystem?.onSelectionChanged({ entity: target, type: "ship" })
            }
        }),
        new OrbitComponent(parent.id, orbitRadius, angularSpeed(orbitRadius), orbitAngle)
    )

    engine.addEntity(ship)

    const shipNode = engine.getSceneNode(ship)
    const parentNode = engine.getSceneNode(parent)
    if(shipNode && parentNode) {
        shipNode.setParent(parentNode)
    }

    return ship
}
