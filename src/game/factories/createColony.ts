import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { IndustryComponent } from "../components/industryComponent"
import { Colony } from "../data/types"
import { Engine } from "@/engine/core/engine"
import { applyComponents, createLabel, calculateSoi, soiFromRadius, createColonyClickHandler } from "./helpers"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { createVessel } from "./createSpaceship"

export interface CreateColonyArgs {
    engine: Engine
    data: Pick<Colony, "name" | "population" | "patronGod" | "radius" | "archetype" | "vessels" | "moons">
    parent: Entity
    orbitArgs?: {
        radius: number
        angle?: number
        eccentricity?: number
    }
}

export function createColony({ engine, data, parent, orbitArgs }: CreateColonyArgs): Entity {
    const colony = engine.createEntity()
    applyComponents(colony,
        new PositionComponent(0, 0, 0),
        new RadiusComponent(data.radius),
        new SoiComponent(calculateSoi(data.radius, data.archetype)),
        new PathComponent()
    )

    if(data.population) {
        if(data.patronGod) {
            colony.addModifier(data.patronGod)
        }

        applyComponents(colony,
            new ColorComponent("green", "", true),
            new SelectableComponent(20, "red"),
            new TargetableComponent(),
            new HoverableComponent("pointer", { width: 40, height: 40 }),
            new ClickableComponent(true, { width: 40, height: 40 }, createColonyClickHandler(engine, colony)),
            new IndustryComponent(data.population, 80, data.population, 0, 0, 0, 10, 0.15, 0.5, 0.3, [], 0)
        )
    } else {
        colony.addComponent(new HoverableComponent("not-allowed", { width: 40, height: 40 },))
            .addComponent(new TargetableComponent(true))
            .addComponent(new ColorComponent("grey", "", true))
    }

    const label = createLabel(engine, data.name, 18, "white")

    const soiCircle = applyComponents(engine.createEntity(),
        new PositionComponent(0, 0),
        new RadiusComponent(soiFromRadius(colony.getComponent(RadiusComponent)!, data.archetype).radius),
        new ColorComponent("", "rgba(0,255,255,0.25)")
    )

    engine.addEntity(colony, parent)
        .addEntity(label, colony)
        .addEntity(soiCircle, colony)

    if(orbitArgs) {
        const angle = orbitArgs.angle ?? Math.random() * Math.PI * 2
        colony.addComponent(new OrbitComponent(
            parent.id,
            orbitArgs.radius,
            angularSpeed(orbitArgs.radius),
            angle,
            orbitArgs.eccentricity ?? 0
        ))
        const pos = colony.getComponent(PositionComponent)
        if(pos) {
            pos.x = Math.cos(angle) * orbitArgs.radius
            pos.y = Math.sin(angle) * orbitArgs.radius
        }
    }

    if(data.moons) {
        for(const [, moon] of data.moons) {
            createColony({
                engine,
                data: moon,
                parent: colony,
                orbitArgs: {
                    radius: moon.distanceFromParent * 50,
                    angle: Math.random() * Math.PI * 2,
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
