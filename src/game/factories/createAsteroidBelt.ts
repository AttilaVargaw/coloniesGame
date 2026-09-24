import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { PositionComponent } from "@/engine/components/position"
import { SizeComponent } from "@/engine/components/sizeComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ThicknessComponent } from "@engine/components/thicknessComponent"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { angularSpeed } from "../utils/orbital"
import asteroids1 from "../../components/icons/asteroid1.png"
import asteroids2 from "../../components/icons/asteroid2.png"
import asteroids3 from "../../components/icons/asteroid3.png"
import asteroids4 from "../../components/icons/asteroid4.png"
import asteroids5 from "../../components/icons/asteroid5.png"
import asteroids6 from "../../components/icons/asteroid6.png"
import dust1 from "../../components/icons/dust1.png"
import { applyComponents } from "./helpers"
import { RotationComponent } from "../components/rotationComponent"

const ASTEROID_TEXTURES = [asteroids1, asteroids2, asteroids3, asteroids4, asteroids5, asteroids6] as const
const ASTEROID_SIZE_MIN = 1
const ASTEROID_SIZE_MAX = 7
const RADIUS_SPREAD = 0.8
const ASTEROID_AREA_DENSITY = 0.5
const ASTEROID_COUNT_MIN = 200
const MAX_ECCENTRICITY = 0.2
const MAX_INCLINATION = 0.1
const DUST_COUNT = 800
// const ASTEROID_TINTS = [
//     "#8a7e72",
//     "#a09888",
//     "#78695e",
//     "#9e9488",
//     "#6e6258",
//     "#b0a498",
//     "#847868",
//     "#a89880",
//     "#706458",
//     "#9a8c7a",
// ]

export function createAsteroidBelt({
    innerRadius,
    outerRadius,
    parent,
    engine,
    parentMass,
}: {
    innerRadius: number
    outerRadius: number
    parent: Entity
    engine: Engine
    parentMass: number
}): void {
    const beltArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius)
    const count = Math.max(ASTEROID_COUNT_MIN, Math.floor(beltArea * ASTEROID_AREA_DENSITY))
    const mid = (innerRadius + outerRadius) / 2
    const half = (outerRadius - innerRadius) * RADIUS_SPREAD / 2

    for(let i = 0; i < count; ++i) {
        const radius = mid + (Math.random() + Math.random() - 1) * half
        const angle = Math.random() * TWO_PI
        const sizeRatio = ASTEROID_SIZE_MAX / ASTEROID_SIZE_MIN
        const size = ASTEROID_SIZE_MIN * Math.pow(sizeRatio, Math.random() * 0.65)

        const textureComponent = new TextureComponent(ASTEROID_TEXTURES[Math.floor(Math.random() * ASTEROID_TEXTURES.length)])
        textureComponent.rotation = Math.random() * TWO_PI

        const eccentricity = Math.random() * MAX_ECCENTRICITY
        const inclination = (Math.random() - 0.5) * 2 * MAX_INCLINATION
        const argumentOfPeriapsis = Math.random() * TWO_PI
        const spinSpeed = Math.random() * Math.PI / 2

        const asteroid = engine.createEntity()

        applyComponents(
            asteroid,
            new RotationComponent(textureComponent.rotation, spinSpeed),
            new OrbitComponent(
                parent.id,
                radius * UNIVERSE_SCALE,
                angularSpeed(radius * UNIVERSE_SCALE, parentMass),
                angle,
                eccentricity,
                inclination,
                argumentOfPeriapsis,
                0,
                true
            ),
            (new PositionComponent(0, 0)),
            (new SizeComponent(size, size)),
            (textureComponent),
            (new ThicknessComponent(1)))

        engine.addEntity(asteroid, parent)
    }

    for(let i = 0; i < DUST_COUNT; ++i) {
        const radius = mid + (Math.random() + Math.random() - 1) * half
        const angle = Math.random() * TWO_PI
        const size = 20 + Math.random() * 20

        const dust = engine.createEntity()

        applyComponents(
            dust,
            new OrbitComponent(
                parent.id,
                radius * UNIVERSE_SCALE,
                angularSpeed(radius * UNIVERSE_SCALE, parentMass),
                angle,
                0, 0, 0, 0,
                true
            ),
            new PositionComponent(0, 0),
            new SizeComponent(size, size),
            new TextureComponent(dust1)
        )

        engine.addEntity(dust, parent)
    }
}
