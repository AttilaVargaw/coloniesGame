import { Entity } from "@engine/entities/entity"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { BodyBlueprint } from "../data/BodyBlueprint"
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
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "./createStarterIndustry"
import { createStarterWarehouse } from "./createStarterWarehouse"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { PositionComponent } from "@/engine/components/position"

export function createBody({
    archetype,
    orbit,
    vessels,
    children,
    binaryPairs,
    marker,
    population,
    rings
}: BodyBlueprint, parent: Entity, engine: Engine): Entity {
    const body = createMarker(engine, { shade: true, ...marker })

    const angle = orbit.angle ?? Math.random() * TWO_PI

    applyComponents(body,
        new OrbitComponent(
            parent.id,
            orbit.radius * UNIVERSE_SCALE,
            angularSpeed(orbit.radius),
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
        for(const { bodies: [first, second], separation, orbit, children } of binaryPairs) {
            createBinaryOrbitPair(engine, body, first, second, separation, orbit, children)
        }
    }

    if(population !== undefined) {
        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new HoverableComponent("pointer", clickSquare),
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body)),
            new IndustryComponent(createStarterIndustry(), createStarterWarehouse(population), createStarterPopulation(population))
        )
    }

    if(rings?.length) {
        for(const { color, innerRadius, outerRadius } of rings) {
            const ringsEntity = engine.createEntity()
            engine.addEntity(ringsEntity, body)
            applyComponents(ringsEntity, new RadiusComponent(innerRadius), new ColorComponent("", color), new PositionComponent(0, 0, 0))

            const ringsEntity2 = engine.createEntity()
            engine.addEntity(ringsEntity2, body)
            applyComponents(ringsEntity2, new RadiusComponent(outerRadius), new ColorComponent("", color), new PositionComponent(0, 0, 0))


        }
    }

    return body
}
