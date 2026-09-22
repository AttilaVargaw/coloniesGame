import { Entity } from "@engine/entities/entity"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { Engine } from "@/engine/core/engine"
import { applyComponents, calculateSoi, createColonyClickHandler, createAttractorClickHandler, massByArchetype } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createMarker, createVessel } from "./createSpaceship"
import { TWO_PI, UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import { createBarycentre } from "./createBarycentre"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "./createStarterIndustry"
import { createStarterWarehouse } from "./createStarterWarehouse"
import { createAsteroid } from "./createAsteroid"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { ThicknessComponent } from "@/engine/components/thicknessComponent"
import { MassComponent } from "@engine/components/massComponent"

export function resolveMass(blueprint: BodyBlueprint): number {
    if(blueprint.mass !== undefined) return blueprint.mass
    return massByArchetype[blueprint.archetype]
}

export function createBody({
    archetype,
    orbit,
    vessels,
    systems,
    marker,
    population,
    rings,
    asteroidBelts,
    name,
    mass: explicitMass,
}: BodyBlueprint & { mass?: number }, parent: Entity, engine: Engine, parentMass: number): Entity {
    const angle = orbit.angle ?? Math.random() * TWO_PI
    const clickSize = marker.radius * 2
    const clickSquare = { width: clickSize, height: clickSize }
    const mass = explicitMass ?? massByArchetype[archetype]

    const body = createMarker(engine, { shade: name === "root" ? false : true, ...marker })

    if(name !== "root") {
        applyComponents(body,
            new OrbitComponent(
                parent.id,
                orbit.radius * UNIVERSE_SCALE,
                angularSpeed(orbit.radius * UNIVERSE_SCALE, parentMass),
                angle,
                orbit.eccentricity ?? 0,
                orbit.inclination ?? (DEFAULT_ORBIT_INCLINATION_RANGE[0] + Math.random() * (DEFAULT_ORBIT_INCLINATION_RANGE[1] - DEFAULT_ORBIT_INCLINATION_RANGE[0])),
                orbit.periapsis ?? 0,
                orbit.ascendingNode ?? 0
            ),
            new SoiComponent(calculateSoi(marker.radius, archetype)),
            new PathComponent(),
            new TargetableComponent(),
            new HoverableComponent("pointer", clickSquare),
            new MassComponent(mass),
        )

    } else {
        applyComponents(body,
            new MassComponent(mass),
        )
    }

    engine.addEntity(body, parent)

    if(systems) {
        for(const entry of systems) {
            if(!entry) {
                continue
            }
            const { bodies, satellites, orbit, angle: angle2 } = entry

            if(!bodies) {
                continue
            }

            if(bodies.length === 1) {
                const createdBody = createBody(bodies[0], body, engine, mass)

                satellites?.forEach(sat => {
                    createBody(sat, createdBody, engine, resolveMass(bodies[0]))
                })
            } else {
                if(!orbit) {
                    throw new Error("orbit required for multi-body system")
                }

                createBarycentre(engine, body, bodies, orbit, satellites, angle2, mass)
            }
        }
    }

    if(vessels) {
        for(const vessel of vessels) {
            createVessel(engine, body, vessel, mass)
        }
    }

    if(population !== undefined) {
        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body)),
            new IndustryComponent(createStarterIndustry(population), createStarterWarehouse(population), createStarterPopulation(population))
        )
    } else {
        applyComponents(body,
            new SelectableComponent(clickSize, "red"),
            new ClickableComponent(true, clickSquare, createAttractorClickHandler(engine, body))
        )
    }

    if(rings?.length) {
        for(const { color, outerRadius } of rings) {
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
            }, body, engine, mass)
            ringsEntity.addComponent(new SoiComponent(calculateSoi(20, "uranus")))

            engine.addEntity(ringsEntity, body)
        }

    }

    return body
}