import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { Colony as BodyCreationData } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, calculateSoi, soiFromRadius, createColonyClickHandler, soiRatios } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createVessel } from "./createSpaceship"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { LabelComponent } from "@/engine/components/label"

export interface CreateColonyArgs {
    engine: Engine
    data: BodyCreationData
    parent: Entity
    orbitArgs?: {
        radius: number
        angle?: number
        eccentricity?: number
    }
}

function createSoiCircle(colony: Entity, archetype: keyof typeof soiRatios, engine: Engine) {
    return applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiFromRadius(colony.getComponent(RadiusComponent)!, archetype).radius),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )
}

export function createBody({ engine, data, parent, orbitArgs }: CreateColonyArgs): Entity {
    const colony = engine.createEntity()
    applyComponents(colony,
        new PositionComponent(0, 0, 0),
        new RadiusComponent(data.radius),
        new SoiComponent(calculateSoi(data.radius, data.archetype)),
        new PathComponent(),
        new ColorComponent(data.color, "", true),
        new LabelComponent(data.name, 18, { x: data.radius + 8, y: 0, z: 1 }, "white"),
        new TargetableComponent(),
    )

    const clickSize = data.radius * 2
    const clickSquare = { width: clickSize, height: clickSize }

    if(data.population) {
        if(data.patronGod) {
            colony.addModifier(data.patronGod)
        }

        applyComponents(colony,
            new SelectableComponent(clickSize, "red"),
            new HoverableComponent("pointer", clickSquare),
            new ClickableComponent(true, clickSquare, createColonyClickHandler(engine, colony)),
            new IndustryComponent(data.population, 80, data.population, 0, 0, 0, 10, 0.15, 0.5, 0.3, [], 0)
        )
    } else {
        applyComponents(colony,
            new HoverableComponent("not-allowed", clickSquare))
    }

    const soiCircle = createSoiCircle(colony, data.archetype, engine)

    engine.addEntity(colony, parent)
        .addEntity(soiCircle, colony)

    if(orbitArgs) {
        const angle = orbitArgs.angle ?? Math.random() * TWO_PI
        colony.addComponent(new OrbitComponent(
            parent.id,
            orbitArgs.radius,
            angularSpeed(orbitArgs.radius),
            angle,
            orbitArgs.eccentricity ?? 0
        ))
        const pos = colony.getComponent(PositionComponent)!

        pos.x = Math.cos(angle) * orbitArgs.radius
        pos.y = Math.sin(angle) * orbitArgs.radius
    }

    if(data.moons) {
        for(const [, moon] of data.moons) {
            createBody({
                engine,
                data: moon,
                parent: colony,
                orbitArgs: {
                    radius: moon.distanceFromParent * UNIVERSE_SCALE,
                    angle: Math.random() * TWO_PI,
                    eccentricity: moon.eccentricity ?? 0,
                }
            })
        }
    }

    if(data.vessels) {
        for(const vessel of data.vessels) {
            createVessel(engine, colony, vessel)
        }
    }

    return colony
}
