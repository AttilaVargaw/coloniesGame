import { OrbitComponent } from "@/engine/components/orbitComponent"
import { UNIVERSE_SCALE, DEFAULT_ORBIT_INCLINATION_RANGE } from "../constants"
import { angularSpeed } from "../utils/orbital"
import { applyComponents } from "./helpers"
import { Engine } from "@/engine/core/engine"
import { Entity } from "@/engine/entities/entity"
import { ColorComponent } from "@/engine/components/colorComponent"
import { PositionComponent } from "@/engine/components/position"
import { ThicknessComponent } from "@/engine/components/thicknessComponent"
import { OrbitalBlueprint } from "../data/OrbitalBlueprint"
import { ShapeComponent } from "@/engine/systems/viewportSystem/renderers/shapeNode"

export function createAsteroid({
    radius, angle, eccentricity, periapsis, ascendingNode,
}: OrbitalBlueprint, parent: Entity, engine: Engine) {
    const asteroid = engine.createEntity()
    const inclination = DEFAULT_ORBIT_INCLINATION_RANGE[0] + Math.random() * (DEFAULT_ORBIT_INCLINATION_RANGE[1] - DEFAULT_ORBIT_INCLINATION_RANGE[0])

    applyComponents(asteroid,
        new OrbitComponent(
            parent.id,
            radius * UNIVERSE_SCALE,
            angularSpeed(radius),
            angle,
            eccentricity ?? 0,
            inclination,
            periapsis ?? 0,
            ascendingNode ?? 0
        ),
        new ColorComponent("red", ""),
        new ThicknessComponent(1),
        new PositionComponent(0, 0),
        new ShapeComponent(asteroid, [
            [10, 70],
            [50, 50],
            [70, 10],
            [50, -30],
            [70, -70],
            [30, -90],
            [-10, -50],
            [-40, -20],
            [-80, -10],
            [-90, 30],
            [-50, 50],
            [-10, 30],
            [10, 70]
        ])
    )

    engine.addEntity(asteroid, parent)

    return asteroid
}