import { EntityComponent } from "@engine/entities/entityComponent"
import { Entity } from "@engine/entities/entity"
import { Engine } from "@/engine/core/engine"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { generateRandomNumber } from "@/lib/generateRandomNumber"
import { TWO_PI, UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import buildableSite from "../../components/icons/buildable.svg"

import { applyComponents, calculateSoi, createColonyClickHandler, createAttractorClickHandler, massByArchetype, soiRatios } from "./helpers"
import { createMarker, createVessel } from "./createSpaceship"
import { createBarycentre } from "./createBarycentre"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "./createStarterIndustry"
import { createStarterWarehouse } from "./createStarterWarehouse"
import { createAsteroidBelt } from "./createAsteroidBelt"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { JumpNodeComponent } from "../components/jumpGraph"
import { IndustryComponent, SettlementType } from "../components/industryComponent"
import { BuildableComponent } from "../components/buildableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { ThicknessComponent } from "@engine/components/thicknessComponent"
import { MassComponent } from "@engine/components/massComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { createEntity } from "@/engine/lib/entityRegistry"
import { createPlanetTexture, createStarTexture, createNightTexture } from "./createCircleTextures"

export function resolveMass(blueprint: BodyBlueprint): number {
    if(blueprint.mass !== undefined) return blueprint.mass
    return massByArchetype[blueprint.archetype]
}

function createBaseComponents(
    parentId: string,
    orbit: { radius: number; angle?: number; eccentricity?: number; inclination?: number; periapsis?: number; ascendingNode?: number },
    angle: number,
    markerRadius: number,
    archetype: keyof typeof soiRatios,
    parentMass: number,
    buildable: boolean | undefined,
    allowedSettlementTypes: (SettlementType)[] | undefined,
    clickSquare: { width: number; height: number },
    mass: number
): EntityComponent[] {
    const components: EntityComponent[] = [
        new OrbitComponent(
            parentId,
            orbit.radius * UNIVERSE_SCALE,
            angularSpeed(orbit.radius * UNIVERSE_SCALE, parentMass),
            angle,
            orbit.eccentricity ?? 0,
            orbit.inclination ?? generateRandomNumber(...DEFAULT_ORBIT_INCLINATION_RANGE),
            orbit.periapsis ?? 0,
            orbit.ascendingNode ?? 0
        ),
        new SoiComponent(calculateSoi(markerRadius, archetype)),
        new PathComponent(),
        new TargetableComponent(),
        new HoverableComponent("pointer", clickSquare),
        new MassComponent(mass),
        new JumpNodeComponent(),
    ]

    if(buildable && allowedSettlementTypes) {
        components.push(new BuildableComponent(allowedSettlementTypes))
    }

    return components
}

function createInteractionComponents(
    population: number | undefined,
    clickSize: number,
    clickSquare: { width: number; height: number },
    engine: Engine,
    body: Entity
): EntityComponent[] {
    const components: EntityComponent[] = [
        new SelectableComponent(clickSize, "red"),
    ]

    if(population !== undefined) {
        components.push(
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body), [{
                label: "Info2",
                id: "info2",
                onClick: () => console.log("info2")
            },
            {
                label: "View2",
                id: "view2",
                onClick: () => console.log("view2")
            }]),
            new IndustryComponent(
                createStarterIndustry(population),
                createStarterWarehouse(population),
                createStarterPopulation(population),
                "standard"
            )
        )
    } else {
        components.push(
            new ClickableComponent(true, clickSquare, createAttractorClickHandler(engine, body))
        )
    }

    return components
}

async function createSystems(
    systems: NonNullable<BodyBlueprint["systems"]>,
    body: Entity,
    engine: Engine,
    mass: number
): Promise<void> {
    for(const entry of systems) {
        if(!entry) continue

        const { bodies, satellites, orbit, angle: angle2 } = entry

        if(!bodies) continue

        if(bodies.length === 1) {
            const createdBody = await createBody(bodies[0], body, engine, mass)

            satellites?.forEach(sat => {
                createBody(sat, createdBody, engine, resolveMass(bodies[0]))
            })
        } else {
            if(!orbit) {
                throw new Error("orbit required for multi-body system")
            }

            await createBarycentre(engine, body, bodies, orbit, satellites, angle2, mass)
        }
    }
}

function createVessels(
    vessels: NonNullable<BodyBlueprint["vessels"]>,
    body: Entity,
    engine: Engine,
    mass: number
): void {
    for(const vessel of vessels) {
        createVessel(engine, body, vessel, mass)
    }
}

function createRings(
    rings: NonNullable<BodyBlueprint["rings"]>,
    body: Entity,
    engine: Engine
): void {
    for(const { color, outerRadius } of rings) {
        const ringEntity = createEntity()
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new RadiusComponent(outerRadius))
            .addComponent(new ColorComponent("", color))
            .addComponent(new ThicknessComponent(5))
        engine.addEntity(ringEntity, body)
    }
}

async function createAsteroidBelts(
    asteroidBelts: NonNullable<BodyBlueprint["asteroidBelts"]>,
    body: Entity,
    engine: Engine,
    parentMass: number
): Promise<void> {
    for(const { innerRadius, outerRadius, name } of asteroidBelts) {
        await createAsteroidBelt({
            innerRadius,
            outerRadius,
            parent: body,
            engine,
            parentMass,
            name,
        })
    }
}

export async function createBody({
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
    buildable,
    allowedSettlementTypes,
}: BodyBlueprint & { mass?: number }, parent: Entity, engine: Engine, parentMass: number): Promise<Entity> {
    const angle = orbit.angle ?? generateRandomNumber(0, TWO_PI)
    const clickSize = marker.radius * 2
    const clickSquare = { width: clickSize, height: clickSize }
    const mass = explicitMass ?? massByArchetype[archetype]
    const markerInput = buildable
        ? { ...marker, texture: buildableSite }
        : marker

    const body = createMarker({ shade: name !== "root", ...markerInput })

    if(!buildable && typeof document !== "undefined") {
        if(archetype === "sol") {
            body.addComponent(new TextureComponent(undefined, undefined, createStarTexture(marker.color), undefined, undefined, undefined, 0.5))
        } else if(archetype !== "baricenter") {
            const dayTexture = createPlanetTexture(marker.color, archetype)
            const nightTexture = createNightTexture(marker.color, archetype)
            body.addComponent(new TextureComponent(undefined, undefined, dayTexture, undefined, undefined, undefined, 0.2, nightTexture))
        }
    }

    if(name !== "root") {
        const components = createBaseComponents(
            parent.id,
            orbit,
            angle,
            marker.radius,
            archetype,
            parentMass,
            buildable,
            allowedSettlementTypes,
            clickSquare,
            mass
        )
        applyComponents(body, ...components)
    } else {
        applyComponents(body, new MassComponent(mass))
    }

    engine.addEntity(body, parent)

    if(systems) await createSystems(systems, body, engine, mass)
    if(vessels) createVessels(vessels, body, engine, mass)

    applyComponents(body, ...createInteractionComponents(population, clickSize, clickSquare, engine, body))

    if(rings?.length) createRings(rings, body, engine)
    if(asteroidBelts?.length) await createAsteroidBelts(asteroidBelts, body, engine, mass)

    return body
}