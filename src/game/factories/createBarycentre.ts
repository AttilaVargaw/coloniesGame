import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { createBody, resolveMass } from "./createBody"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { BodyBlueprint } from "../data/BodyBlueprint"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { angularSpeed } from "../utils/orbital"
import { OrbitalBlueprint } from "../data/OrbitalBlueprint"
import { PositionComponent } from "@/engine/components/position"
import { MassComponent } from "@engine/components/massComponent"

function makeMoonOrbit(
    body: BodyBlueprint,
    bodyAngle: number,
    speed: number
): OrbitalBlueprint {
    return {
        radius: body.orbit?.radius ?? 0,
        angle: body.orbit?.angle ?? bodyAngle,
        eccentricity: body.orbit?.eccentricity ?? 0,
        inclination: body.orbit?.inclination ?? 0,
        periapsis: body.orbit?.periapsis ?? 0,
        ascendingNode: body.orbit?.ascendingNode ?? 0,
        angularSpeed: speed,
    }
}

export function createBarycentre(
    engine: Engine,
    parent: Entity,
    bodies: BodyBlueprint[],
    { radius, angle, eccentricity, periapsis, ascendingNode }: OrbitalBlueprint,
    satellites?: BodyBlueprint[],
    dAngle = 0,
    parentMass = 0
): Entity {
    const masses = bodies.map(resolveMass)
    const totalMass = masses.reduce((sum, m) => sum + m, 0)
    const totalSeparation = bodies.reduce((sum, body) => sum + (body.orbit?.radius ?? 0), 0)
    const commonAngularSpeed = totalSeparation > 0 ? angularSpeed(totalSeparation * UNIVERSE_SCALE, totalMass) : 0

    const barycentre = engine.createEntity()
    engine.addEntity(barycentre, parent)

    barycentre.addComponent(new PositionComponent(0, 0))
    barycentre.addComponent(new OrbitComponent(
        parent.id,
        radius * UNIVERSE_SCALE,
        angularSpeed(radius * UNIVERSE_SCALE, parentMass),
        angle ?? Math.random() * TWO_PI,
        eccentricity ?? 0,
        0,
        periapsis ?? 0,
        ascendingNode ?? 0
    ))
    barycentre.addComponent(new MassComponent(totalMass))

    for(let i = 0; i < bodies.length; i += 1) {
        const bodyAngle = dAngle + (TWO_PI / bodies.length) * i
        createBody(
            { ...bodies[i], orbit: makeMoonOrbit(bodies[i], bodyAngle, commonAngularSpeed) },
            barycentre,
            engine,
            totalMass,
        )
    }

    satellites?.forEach((satellite) => {
        createBody(satellite, barycentre, engine, totalMass)
    })

    return barycentre
}
