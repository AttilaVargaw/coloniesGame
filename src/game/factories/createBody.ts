import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { BodyBlueprint } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, calculateSoi, soiFromRadius, createColonyClickHandler, soiRatios } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createVessel } from "./createSpaceship"
import { TWO_PI, UNIVERSE_SCALE, } from "../constants"
import { LabelComponent } from "@/engine/components/label"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"

function createSoiCircle(colony: Entity, archetype: keyof typeof soiRatios, engine: Engine) {
    return applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiFromRadius(colony.getComponent(RadiusComponent)!, archetype).radius),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )
}

export function createBody({
    radius,
    archetype,
    color,
    name,
    tribe,
    orbit,
    vessels,
    children,
    binaryPairs
}: BodyBlueprint, parent: Entity, engine: Engine): Entity {
    const body = engine.createEntity(`planet-${name}`)

    applyComponents(body,
        new PositionComponent(0, 0, 0),
        new RadiusComponent(radius),
        new SoiComponent(calculateSoi(radius, archetype)),
        new PathComponent(),
        new ColorComponent(color, "", true),
        new LabelComponent(name, 18, { x: radius + 8, y: 0, z: 1 }, "white"),
        new TargetableComponent(),
    )

    const clickSize = radius * 2
    const clickSquare = { width: clickSize, height: clickSize }

    if(tribe) {
        if(tribe.patronGod) {
            body.addModifier(tribe.patronGod)
        }

        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new HoverableComponent("pointer", clickSquare),
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body)),
            new IndustryComponent(tribe.population, 80, tribe.population, 0, 0, 0, 10, 0.15, 0.5, 0.3, [], 0)
        )
    } else {
        applyComponents(body,
            new HoverableComponent("not-allowed", clickSquare))
    }

    const soiCircle = createSoiCircle(body, archetype, engine)

    engine.addEntity(body, parent)
        .addEntity(soiCircle, body)

    if(orbit) {
        const angle = orbit.angle ?? Math.random() * TWO_PI
        body.addComponent(new OrbitComponent(
            parent.id,
            orbit.radius * UNIVERSE_SCALE,
            angularSpeed(orbit.radius * UNIVERSE_SCALE),
            angle,
            orbit.eccentricity ?? 0
        ))
        const pos = body.getComponent(PositionComponent)!

        pos.x = Math.cos(angle) * orbit.radius
        pos.y = Math.sin(angle) * orbit.radius
    }

    if(children) {
        for(const blueprint of children) {
            createBody(blueprint,
                body,
                engine)
        }
    }

    if(vessels) {
        for(const vessel of vessels) {
            createVessel(engine, body, vessel)
        }
    }

    if(binaryPairs) {
        for(const { bodies: [first, second], separation, orbit: { radius, angle } } of binaryPairs) {
            createBinaryOrbitPair(engine, body, first, second, separation, radius, angle)
        }
    }

    return body
}
