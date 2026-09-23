import { Engine } from "@/engine/core/engine"
import { Entity } from "@engine/entities/entity"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { PositionComponent } from "@/engine/components/position"
import { SizeComponent } from "@/engine/components/sizeComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ColorComponent } from "@engine/components/colorComponent"
import { ThicknessComponent } from "@engine/components/thicknessComponent"
import { TWO_PI, UNIVERSE_SCALE } from "../constants"
import { angularSpeed } from "../utils/orbital"
import asteroids1 from "../../components/icons/asteroid1.png"
import asteroids2 from "../../components/icons/asteroid2.png"
import asteroids3 from "../../components/icons/asteroid3.png"
import asteroids4 from "../../components/icons/asteroid4.png"
import asteroids5 from "../../components/icons/asteroid5.png"
import asteroids6 from "../../components/icons/asteroid6.png"
import { applyComponents } from "./helpers"

const ASTEROID_TEXTURES = [asteroids1, asteroids2, asteroids3, asteroids4, asteroids5, asteroids6] as const
const ASTEROID_SIZE_MIN = 5
const ASTEROID_SIZE_MAX = 15
const RADIUS_SPREAD = 0.7
const ASTEROID_AREA_DENSITY = 0.4
const ASTEROID_COUNT_MIN = 80

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
        const normalizedRadius = (radius - innerRadius) / (outerRadius - innerRadius)
        const size = ASTEROID_SIZE_MIN + (ASTEROID_SIZE_MAX - ASTEROID_SIZE_MIN) * (normalizedRadius * 0.6 + Math.random() * 0.4)

        const textureComponent = new TextureComponent(ASTEROID_TEXTURES[Math.floor(Math.random() * ASTEROID_TEXTURES.length)])
        //textureComponent.rotation = Math.random() * TWO_PI

        const asteroid = engine.createEntity()

        applyComponents(
            asteroid,
            new OrbitComponent(
                parent.id,
                radius * UNIVERSE_SCALE,
                angularSpeed(radius * UNIVERSE_SCALE, parentMass),
                angle,
                0,
                0,
                0,
                0,
                true
            ),
            (new PositionComponent(0, 0)),
            (new SizeComponent(size, size)),
            (textureComponent),
            (new ColorComponent("", "")),
            (new ThicknessComponent(1)))

        engine.addEntity(asteroid, parent)
    }
}
