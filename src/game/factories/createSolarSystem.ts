import { Engine } from "@/engine/core/engine"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { SelectionSystem } from "@game/systems/selectionSystem"
import { TargetSystem } from "@game/systems/targetSystem"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { applyComponents } from "./helpers"
import { createStar } from "./createStar"
import { createColony } from "./createColony"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { Entity } from "@engine/entities/entity"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { IndustryComponent } from "../components/industryComponent"
import { Star, Colony } from "../data/types"
import { SoiComponent } from "@/engine/components/soiComponent"

export function createSolarSystem(engine: Engine, { x, y, planets, soi, binaryPairs = new Map() }: Star) {
    const star = createStar(engine, { x: x * 100, y: y * 100, soi: soi ?? 2000 })

    const binaryPairPlanetNames = new Set<string>()

    for(const [, planet] of planets) {
        for(const [key] of binaryPairs) {
            const [nameA, nameB] = key.split("-")
            if(planet.name === nameA || planet.name === nameB) {
                binaryPairPlanetNames.add(planet.name)
            }
        }
    }

    for(const [key, separation] of binaryPairs) {
        const [nameA, nameB] = key.split("-")
        const planetA = planets.get(nameA)
        const planetB = planets.get(nameB)
        if(!planetA || !planetB) continue

        const barycentreOrbitRadius = (planetA.distanceFromParent + planetB.distanceFromParent) * 50 / 2
        const barycentreAngularSpeed = 1.5 / Math.sqrt(barycentreOrbitRadius)
        const barycentre = applyComponents(engine.createEntity(),
            new PositionComponent(0, 0),
            new OrbitComponent(
                star.id,
                barycentreOrbitRadius,
                barycentreAngularSpeed,
                Math.random() * Math.PI * 2
            ),
            new RadiusComponent(4),
            new ColorComponent("rgba(255,255,255,0.4)"),
            new SoiComponent(separation)
        )
        engine.addEntity(barycentre, star)

        const { bodyA, bodyB } = createBinaryOrbitPair(
            engine,
            barycentre,
            planetA,
            planetB,
            separation
        )

        const memberA = bodyA
        const memberB = bodyB
        const dataA = planetA
        const dataB = planetB

        const styleBinaryMember = (body: Entity, data: Colony) => {
            applyComponents(body,
                new ColorComponent("green"),
                new SelectableComponent(10, "green"),
                new TargetableComponent(),
                new RadiusComponent(data.radius),
                new HoverableComponent("pointer", { width: 40, height: 40 }),
                new ClickableComponent(true, { width: 40, height: 40 }, ({ event: { shiftKey }, worldX, worldY }) => {
                    if(shiftKey) {
                        const targetSystem = engine.getSystem(TargetSystem)
                        const selectionSystem = engine.getSystem(SelectionSystem)
                        const selection = selectionSystem?.currentSelection()
                        if(selection) {
                            targetSystem?.setTarget(selection, body, worldX, worldY)
                        }
                    } else {
                        engine.dispatchEvent(new SelectionChangedEvent({ data: body, type: "colony" }))
                    }
                })
            )
            if(data.population) {
                body.addComponent(new IndustryComponent(data.population, 80, data.population, 1))
            }
            if(data.patronGod) {
                body.addModifier(data.patronGod)
            }
        }

        styleBinaryMember(memberA, dataA)
        styleBinaryMember(memberB, dataB)
    }

    for(const [, planet] of planets) {
        if(binaryPairPlanetNames.has(planet.name)) continue

        const colony = createColony(engine, planet, star)!
        const orbitRadius = planet.distanceFromParent * 50
        const angularSpeed = 1.5 / Math.sqrt(orbitRadius)
        colony.addComponent(new OrbitComponent(
            star.id,
            orbitRadius,
            angularSpeed,
            Math.random() * Math.PI * 2
        ))
    }

    return star
}
