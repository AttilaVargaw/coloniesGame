import { EntityComponent } from "@engine/entities/entityComponent"
import { Entity } from "@engine/entities/entity"
import { Engine } from "@/engine/core/engine"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { generateRandomNumber } from "@/lib/generateRandomNumber"
import { TWO_PI, UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import buildableSite from "../../components/icons/buildable.svg"
import { applyComponents, calculateSoi, createColonyClickHandler, createAttractorClickHandler, massByArchetype, soiRatios, PlanetArchetype } from "./helpers"
import { createMarker } from "./createMarker"
import { createVessel } from "./createSpaceship"
import { createBarycentre } from "./createBarycentre"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "./createStarterIndustry"
import { createStarterWarehouse } from "./createStarterWarehouse"
import { industrySectorBlueprints } from "../systems/sectorBlueprints"
import { Goods, basePrices } from "../data/Goods"
import { Population, baseSalaries } from "../data/Population"
import { createAsteroidBelt } from "./createAsteroidBelt"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { JumpNodeComponent } from "../components/jumpGraph"
import { RingComponent } from "@/engine/components/ringComponent"
import { IndustryComponent, SettlementType } from "../components/industryComponent"
import type { IndustrialSectors } from "../components/Factories"
import { BuildableComponent } from "../components/buildableComponent"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { RotationComponent } from "@/game/components/rotationComponent"
import { AtmosphereComponent } from "@/engine/components/atmosphereComponent"
import { angularSpeed } from "../utils/orbital"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@engine/components/colorComponent"
import { MassComponent } from "@engine/components/massComponent"
import { TextureComponent } from "@engine/components/textureComponent"
import { SizeComponent } from "@engine/components/sizeComponent"
import { createEntity } from "@/engine/lib/entityRegistry"
import { getTextureWorkerPool } from "./textureWorkerPool"

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
    body: Entity,
    starterIndustries?: Partial<Record<keyof IndustrialSectors, number>>,
    populationRatioOverride?: number,
    occupationStarterRatioOverride?: Partial<Record<keyof Population, number>>
): EntityComponent[] {
    if(occupationStarterRatioOverride) {
        if(Object.values(occupationStarterRatioOverride).reduce((a, b) => a + b) !== 100) {
            console.error("occupationStarterRatioOverride must sum to 100")
        }
    }

    const components: EntityComponent[] = [
        new SelectableComponent(clickSize, "red"),
    ]

    const effectiveRatio = populationRatioOverride ?? populationRatio

    if(population !== undefined) {
        const starterSectors = createStarterIndustry(population * effectiveRatio);
        if(starterIndustries) {
            for(const key of Object.keys(starterIndustries) as (keyof IndustrialSectors)[]) {
                starterSectors.add(key);
            }
        }

        const BUDGET_RUNWAY_DAYS = 500
        const starterCapitalStock: Partial<Record<keyof IndustrialSectors, Partial<Goods>>> = {}
        //@ts-ignore
        const starterStock: Partial<Record<keyof IndustrialSectors, Partial<Goods>>> = {}
        //@ts-ignore
        const starterMoney: Record<keyof IndustrialSectors, number> = {}

        for(const sector of starterSectors) {
            const config = industrySectorBlueprints.get(sector)
            if(config?.capitalGoods) {
                starterCapitalStock[sector] = {}
                starterStock[sector] = {}
                for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
                    starterCapitalStock[sector][goodKey as keyof Goods] = Math.max(1, Math.round(rate * population / 500_000))
                }
                for(const [goodKey, rate] of Object.entries(config.goodsRequirements)) {
                    starterStock[sector][goodKey as keyof Goods] = Math.max(1, Math.round(rate * population / 500_000))
                }
            }

            const goodsCost = config?.goodsRequirements
                ? Object.entries(config.goodsRequirements).reduce((sum, [g, r]) => sum + (r as number) * (basePrices[g as keyof Goods] ?? 0), 0)
                : 0
            const laborCost = config?.workerRequirement
                ? Object.entries(config.workerRequirement).reduce((sum, [w, r]) => sum + (r as number) * (baseSalaries[w as keyof Population] ?? 0), 0)
                : 0
            const operatingCost = goodsCost + laborCost
            starterMoney[sector] = Math.round(operatingCost * BUDGET_RUNWAY_DAYS)
        }

        const colonyTreasury = Math.max(50000, population * 10)

        components.push(
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, body), [{
                label: "Info",
                id: "info",
                onClick: () => console.log("info")
            },
            {
                label: "View",
                id: "view",
                onClick: () => console.log("view")
            }]),
            new IndustryComponent(
                starterSectors,
                createStarterWarehouse(population * effectiveRatio),
                createStarterPopulation(population * effectiveRatio, occupationStarterRatioOverride),
                "standard",
                "colony",
                starterMoney,
                starterCapitalStock,
                colonyTreasury,
                //@ts-ignore
                starterStock
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
    await Promise.all(systems.map(async entry => {
        if(!entry) return

        const { bodies, satellites, orbit, angle: angle2 } = entry

        if(!bodies) return

        if(bodies.length === 1) {
            const createdBody = await createBody(bodies[0], body, engine, mass)

            if(satellites?.length) {
                await Promise.all(satellites.map(sat => createBody(sat, createdBody, engine, resolveMass(bodies[0]))))
            }
        } else {
            if(!orbit) {
                throw new Error("orbit required for multi-body system")
            }

            await createBarycentre(engine, body, bodies, orbit, satellites, angle2, mass)
        }
    }))
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

async function createRings(
    rings: NonNullable<BodyBlueprint["rings"]>,
    body: Entity,
    engine: Engine
): Promise<void> {
    const pool = getTextureWorkerPool()

    for(const { innerRadius, outerRadius, color } of rings) {
        const bitmap = await pool.generate("ring", color, "saturn", body.id, undefined, innerRadius, outerRadius)

        const ringEntity = createEntity()
        ringEntity.addComponent(new PositionComponent(0, 0))
        ringEntity.addComponent(new RingComponent(ringEntity, innerRadius, outerRadius, color))
        ringEntity.addComponent(new ColorComponent("", color))
        ringEntity.addComponent(new TextureComponent({ day: bitmap, id: `${body.id}_ring` }))

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

const populationRatio = 0.01
const gasGiants = new Set<PlanetArchetype>(["jupiter", "saturn", "uranus", "neptune"])
const hasAtmosphere = new Set<PlanetArchetype>(["earth", "kobol", ...gasGiants])
const hasClouds = new Set<PlanetArchetype>(["earth", "kobol", "venus", "uranus", "neptune"])

function createBlackNightCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, 1, 1)
    return canvas
}

function atmosphereForArchetype(
    archetype: PlanetArchetype,
    color: string,
    radius: number
): { thickness: number; skyColor: string; rayleigh: number; scaleHeight: number } | undefined {
    const thickness = gasGiants.has(archetype) ? radius * 0.025 : radius * 0.012
    const scaleHeight = thickness * 0.25

    switch(archetype) {
        case "earth":
        case "kobol":
            return { thickness, skyColor: "#4a90e2", rayleigh: 1.2, scaleHeight }
        default:
            return { thickness, skyColor: color, rayleigh: 0.6, scaleHeight }
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
    starterIndustries,
    mass: explicitMass,
    buildable,
    allowedSettlementTypes,
    populationRatio: blueprintPopulationRatio,
    occupationStarterRatio: blueprintOccupationStarterRatio,
}: BodyBlueprint, parent: Entity, engine: Engine, parentMass: number): Promise<Entity> {
    const isRoot = name === "root"
    const angle = orbit.angle ?? generateRandomNumber(0, TWO_PI)
    const clickSize = marker.radius * 2
    const clickSquare = { width: clickSize, height: clickSize }
    const mass = explicitMass ?? massByArchetype[archetype]
    const markerInput = buildable
        ? { ...marker, texture: buildableSite }
        : marker

    let body: Entity

    if(isRoot) {
        body = createEntity().addComponent(new PositionComponent(0, 0))
    } else {
        body = createMarker({ name: isRoot ? undefined : name, ...markerInput })
    }

    if(buildable && markerInput.texture) {
        body.addComponent(new SizeComponent(marker.radius * 2, marker.radius * 2, 12))
        body.addComponent(new TextureComponent({ src: markerInput.texture, id: name }))
    }

    if(!buildable && typeof document !== "undefined" && !isRoot) {
        const pool = getTextureWorkerPool()

        if(archetype === "sol") {
            const dayBitmap = await pool.generate("star", marker.color, undefined, name)
            body.addComponent(new TextureComponent({ day: dayBitmap, animationSpeed: 0.5, id: name }))
        } else if(archetype !== "baricenter") {
            const [dayBitmap, roughnessBitmap, normalBitmap] = await Promise.all([
                pool.generate("planet", marker.color, archetype, name),
                pool.generate("roughness", marker.color, archetype, name),
                pool.generate("normal", marker.color, archetype, name, hasAtmosphere.has(archetype)),
            ])

            const [nightBitmap, cloudBitmap] = await Promise.all([
                population !== undefined ? await pool.generate("night", marker.color, archetype, name) : createBlackNightCanvas(),
                hasClouds.has(archetype) ? await pool.generate("cloud", marker.color, archetype, name) : undefined
            ])

            let meshIndex = 0
            if(archetype === "asteroid") {
                let h = 0
                for(let i = 0; i < name.length; i++) {
                    h = ((h << 5) - h + name.charCodeAt(i)) | 0
                }
                meshIndex = (Math.abs(h) % 8) + 1
            }

            body.addComponent(new TextureComponent({ day: dayBitmap, night: nightBitmap, roughness: roughnessBitmap, cloud: cloudBitmap, normal: normalBitmap, animationSpeed: 0.2, id: name, meshIndex }))
            body.addComponent(new RotationComponent(0, generateRandomNumber(0.05, 0.2)))

            if(hasAtmosphere.has(archetype)) {
                body.addComponent(new AtmosphereComponent(atmosphereForArchetype(archetype, marker.color, marker.radius)))
            }
        }
    }

    let components: EntityComponent[]

    if(isRoot) {
        components = [new MassComponent(mass)]
    } else {
        components = createBaseComponents(
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
    }

    applyComponents(body, ...components)

    engine.addEntity(body, parent)

    const tasks: Promise<void>[] = []

    if(systems) {
        tasks.push(createSystems(systems, body, engine, mass))
    }

    if(vessels) {
        createVessels(vessels, body, engine, mass)
    }

    const effectivePopulationRatio = blueprintPopulationRatio ?? populationRatio
    !isRoot && applyComponents(
        body,
        ...createInteractionComponents(population, clickSize, clickSquare, engine, body, starterIndustries, effectivePopulationRatio, blueprintOccupationStarterRatio))

    if(rings?.length) {
        await createRings(rings, body, engine)
    }

    if(asteroidBelts?.length) {
        tasks.push(createAsteroidBelts(asteroidBelts, body, engine, mass))
    }

    await Promise.all(tasks)

    return body
}