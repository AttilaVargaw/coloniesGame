import { Engine } from "@/engine/core/engine"
import { SelectionChangedEvent } from "@/engine/lib/events"
import { applyComponents } from "./helpers"
import { createStar } from "./createStar"
import { createColony } from "./createColony"
import { createBinaryOrbitPair } from "./createBinaryOrbitPair"
import { Entity } from "@engine/entities/entity"
import { ClickableComponent } from "@engine/components/clickableComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { PositionComponent } from "@engine/components/position"
import { RadiusComponent } from "@engine/components/radiusComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { IndustryComponent } from "../components/industryComponent"
import { Star, Colony } from "../data/types"

export function createSolarSystem(engine: Engine, { x, y, planets, soi, binaryPairs = new Map() }: Star) {
    const star = createStar(engine, { x: x * 100, y: y * 100, soi: soi ?? 2000 })

    const createdBinaryPairNames = new Set<string>()

    for(const [, planet] of planets) {
        let pairEntry: { key: string, separation: number } | undefined

        for(const [key, separation] of binaryPairs) {
            const [nameA, nameB] = key.split("-")
            if((planet.name === nameA || planet.name === nameB) && !createdBinaryPairNames.has(key)) {
                pairEntry = { key, separation }
                break
            }
        }

        if(pairEntry) {
            const [nameA, nameB] = pairEntry.key.split("-")
            const partnerName = planet.name === nameA ? nameB : nameA
            const partnerData = planets.get(partnerName)!

            createdBinaryPairNames.add(pairEntry.key)

            const barycentreOrbitRadius = (planet.radius + partnerData.radius) * 50 / 2
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
                new ColorComponent("rgba(255,255,255,0.4)")
            )
            engine.addEntity(barycentre, star)

            const { bodyA, bodyB } = createBinaryOrbitPair(
                engine, barycentre,
                nameA,
                nameB,
                pairEntry.separation
            )

            const memberA = planet.name === nameA ? bodyA : bodyB
            const memberB = planet.name === nameA ? bodyB : bodyA
            const dataA = planet.name === nameA ? planet : partnerData
            const dataB = planet.name === nameA ? partnerData : planet

            const styleBinaryMember = (body: Entity, data: Colony) => {
                applyComponents(body,
                    new ColorComponent("green"),
                    new RadiusComponent(10),
                    new HoverableComponent("pointer", { width: 40, height: 40 }),
                    new ClickableComponent(true, { width: 40, height: 40 }, () => {
                        engine.dispatchEvent(new SelectionChangedEvent({ data: body, type: "colony" }))
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

            continue
        }

        const colony = createColony(engine, planet, star)!
        const orbitRadius = planet.radius * 50
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
