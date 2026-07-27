import { Entity } from "@engine/entities/entity"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { BodyBlueprint, HomeworldBlueprint } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, calculateSoi, createColonyClickHandler } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createMarker, createVessel } from "./createSpaceship"
import { TWO_PI, UNIVERSE_SCALE, } from "../constants"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { createSoiCircle } from "./createSoiCircle"

export function createBody({
    archetype,
    orbit,
    vessels,
    children,
    binaryPairs,
    marker,
}: BodyBlueprint, parent: Entity, engine: Engine): Entity {
    const body = createMarker(engine, { shade: true, ...marker })

    const angle = orbit.angle ?? Math.random() * TWO_PI

    applyComponents(body,
        new OrbitComponent(
            parent.id,
            orbit.radius * UNIVERSE_SCALE,
            angularSpeed(orbit.radius * UNIVERSE_SCALE),
            angle,
            orbit.eccentricity ?? 0
        ),
        new SoiComponent(calculateSoi(marker.radius, archetype)),
        new PathComponent(),
        new TargetableComponent(),
    )

    const clickSize = marker.radius * 2
    const clickSquare = { width: clickSize, height: clickSize }

    applyComponents(body,
        new HoverableComponent("not-allowed", clickSquare))


    engine.addEntity(body, parent)
        .addEntity(createSoiCircle(body, archetype, engine), body)

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

export function createHomeworld(blueprint: HomeworldBlueprint, parent: Entity, engine: Engine) {
    const body = createBody(blueprint, parent, engine)

    const { tribe, marker } = blueprint
    const population = tribe?.population ?? 0

    if(tribe) {
        if(tribe?.patronGod) {
            body.addModifier(tribe.patronGod)
        }

        const clickSize = marker.radius * 2
        const clickSquare = { width: clickSize, height: clickSize }

        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new HoverableComponent("pointer", clickSquare),
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body)),
            new IndustryComponent(population, 80, population, 0, 0, 0, 10, 0.15, 0.5, 0.3, [], 0)
        )
    }

    return body
}