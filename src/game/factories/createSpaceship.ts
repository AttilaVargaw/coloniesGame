import { Engine } from "@/engine/core/engine"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent, WorldPosition } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { JumpDriveComponent, SensorSuiteComponent, FuelComponent } from "../components/vessel"
import { applyComponents, descartesToPolar, createShipClickHandler } from "./helpers"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SHIP_RADIUS, TWO_PI, UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { VesselBlueprint } from "../data/VesselBlueprint"
import { MapMarker } from "../data/MapMarker"
import { Entity } from "@engine/entities/entity"
import { LabelComponent } from "@/engine/components/label"
import { ThicknessComponent } from "@/engine/components/thicknessComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import battlestarDradisUrl from "@/components/icons/battlestarDradis.svg"
import { SizeComponent } from "@/engine/components/sizeComponent"

export function createMarker(engine: Engine, { offset, color, radius, label, labelColor = "red", textSize = 18, shade = false, name, texture }: MapMarker) {
    const marker = applyComponents(engine.createEntity(name),
        new PositionComponent(0, 0),
        new ThicknessComponent(1),
        (new ColorComponent(color, "", shade)))

    if(texture) {
        marker.addComponent(new SizeComponent(radius * 2, radius * 2))
        marker.addComponent(new TextureComponent(texture))
    } else {
        marker.addComponent(new RadiusComponent(radius))
    }

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
        new ClickableComponent(true, { width: SHIP_RADIUS, height: SHIP_RADIUS }, createShipClickHandler(engine, ship))
    )

    engine.addEntity(ship)

    return ship
}

export function createVessel(
    engine: Engine,
    parent: Entity,
    { marker: { color, label, radius, labelColor, textSize }, orbit: { radius: orbitRadius, angle, inclination, periapsis, ascendingNode } }: VesselBlueprint,
    parentMass: number
) {
    const orbitAngle = angle ?? Math.random() * TWO_PI
    const orbitInclination = inclination ?? (DEFAULT_ORBIT_INCLINATION_RANGE[0] + Math.random() * (DEFAULT_ORBIT_INCLINATION_RANGE[1] - DEFAULT_ORBIT_INCLINATION_RANGE[0]))

    const ship = applyComponents(engine.createEntity(),
        new ColorComponent(color, "", false),
        new RadiusComponent(radius),
        new PositionComponent(...descartesToPolar(orbitAngle, orbitRadius)),
        new JumpDriveComponent(),
        new SensorSuiteComponent(3),
        new FuelComponent(100, 1),
        new SelectableComponent(80, "red"),
        new TargetableComponent(),
        new SizeComponent(20, 20),
        new TextureComponent(battlestarDradisUrl),
        new HoverableComponent("pointer", { width: 80, height: 80 }),
        new OrbitComponent(parent.id, orbitRadius * UNIVERSE_SCALE, angularSpeed(orbitRadius * UNIVERSE_SCALE, parentMass), orbitAngle, 0, orbitInclination, periapsis ?? 0, ascendingNode ?? 0)
    )

    if(label) {
        ship.addComponent(new LabelComponent(label, textSize ?? 18, { x: radius * 2 + 10, y: 0, z: 0 } as WorldPosition, labelColor ?? "yellow"))
    }

    ship.addComponent(new HoverableComponent("pointer", { width: SHIP_RADIUS, height: SHIP_RADIUS }))

    ship.addComponent(new ClickableComponent(true, { width: SHIP_RADIUS, height: SHIP_RADIUS }, createShipClickHandler(engine, ship)))

    engine.addEntity(ship)

    const shipNode = engine.getSceneNode(ship)
    const parentNode = engine.getSceneNode(parent)
    if(shipNode && parentNode) {
        shipNode.parent = parentNode
    }

    return ship
}
