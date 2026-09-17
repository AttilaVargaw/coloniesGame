import { Entity } from "@engine/entities/entity"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { Engine } from "@/engine/core/engine"
import { applyComponents, calculateSoi, createColonyClickHandler, createAttractorClickHandler } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createMarker, createVessel } from "./createSpaceship"
import { TWO_PI, UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "./createStarterIndustry"
import { createStarterWarehouse } from "./createStarterWarehouse"
import { createAsteroid } from "./createAsteroid"
import { PositionComponent } from "@/engine/components/position"
import { RingComponent } from "@engine/components/ringComponent"
import { Radius } from "lucide-react"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { ThicknessComponent } from "@/engine/components/thicknessComponent"

export function createBody({
    archetype,
    orbit,
    vessels,
    children,
    binaryPairs,
    marker,
    population,
    rings,
    asteroidBelts
}: BodyBlueprint, parent: Entity, engine: Engine): Entity {
    const body = createMarker(engine, { shade: true, ...marker })

    const angle = orbit.angle ?? Math.random() * TWO_PI

    applyComponents(body,
        new OrbitComponent(
            parent.id,
            orbit.radius * UNIVERSE_SCALE,
            angularSpeed(orbit.radius),
            angle,
            orbit.eccentricity ?? 0,
            orbit.inclination ?? (DEFAULT_ORBIT_INCLINATION_RANGE[0] + Math.random() * (DEFAULT_ORBIT_INCLINATION_RANGE[1] - DEFAULT_ORBIT_INCLINATION_RANGE[0])),
            orbit.periapsis ?? 0,
            orbit.ascendingNode ?? 0
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
    // .addEntity(createSoiCircle(body, archetype, engine), body)

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
    } else {
        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new HoverableComponent("pointer", clickSquare),
            new ClickableComponent(true, clickSquare, createAttractorClickHandler(engine, body))
        )
    }

    if(rings?.length) {
        for(const { color, innerRadius, outerRadius } of rings) {
            const ringEntity = engine.createEntity()
                .addComponent(new PositionComponent(0, 0))
                .addComponent(new RadiusComponent(outerRadius))
                .addComponent(new ColorComponent("", color))
                .addComponent(new ThicknessComponent(5))
            engine.addEntity(ringEntity, body)
        }
    }

    if(asteroidBelts?.length) {
        for(const { innerRadius, } of asteroidBelts) {
            const ringsEntity = createAsteroid({
                radius: innerRadius,
                angle: 0,
                eccentricity: 0,
            }, body, engine)
            ringsEntity.addComponent(new SoiComponent(calculateSoi(20, "uranus")))

            engine.addEntity(ringsEntity, body)
        }

    }

    return body
}
