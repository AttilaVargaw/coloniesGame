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
import { AsteroidBeltComponent } from "../components/asteroidBeltComponent"
import { generateRandomNumber } from "../../lib/generateRandomNumber"

const ASTEROID_TEXTURES = [asteroids1, asteroids2, asteroids3, asteroids4, asteroids5, asteroids6] as const
const ASTEROID_SIZE_MIN = 1
const ASTEROID_SIZE_MAX = 7
const RADIUS_SPREAD = 0.8
const ASTEROID_AREA_DENSITY = 0.5
const ASTEROID_COUNT_MIN = 200
const MAX_ECCENTRICITY = 0.2
const MAX_INCLINATION = 0.1
const DUST_AREA_DENSITY = 0.3
const ASTEROID_CULLING_SCALE_THRESHOLD = 1
const DUST_CULLING_SCALE_THRESHOLD = 0.1
const DUST_SIZE_MIN = 30
const DUST_SIZE_MAX = 80

const asteroidImageSize = 32

const ASTEROID_TINTS = [
    "#8a7e72",
    "#a09888",
    "#78695e",
    "#9e9488",
    "#6e6258",
    "#b0a498",
    "#847868",
    "#a89880",
    "#706458",
    "#9a8c7a",
] as const

const SMOKE_TINTS = [
    "#ffffff",
    "#f0f0f0",
    "#e0e0e0",
    "#d0d0d0",
    "#c0c0c0"
] as const

const tintedTextures = new Map<string, OffscreenCanvas | HTMLImageElement>()
const tintedDustTextures = [] as (OffscreenCanvas | HTMLImageElement)[]
let tintedTexturesReady = false

function Colorize(image: HTMLImageElement | OffscreenCanvas | ImageBitmap, color: `#${string}`) {
    const imageSize = image.width

    const color2 = color.replace("#", "")
    const r = parseInt(color2.substring(0, 2), 16) / 255
    const g = parseInt(color2.substring(2, 4), 16) / 255
    const b = parseInt(color2.substring(4, 6), 16) / 255

    const offscreen = new OffscreenCanvas(imageSize, imageSize)
    const ctx = offscreen.getContext("2d")

    if(!ctx) {
        throw "Something went wrong with the offset canvas"
    }

    ctx.drawImage(image, 0, 0)

    const imageData = ctx.getImageData(0, 0, imageSize, imageSize)

    for(let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] *= r
        imageData.data[i + 1] *= g
        imageData.data[i + 2] *= b
    }

    ctx.putImageData(imageData, 0, 0)

    return offscreen
}

async function buildTintedTextures() {
    for(const tint of ASTEROID_TINTS) {
        for(let i = 0; i < ASTEROID_TEXTURES.length; ++i) {
            const image = new Image()
            image.src = ASTEROID_TEXTURES[i]
            await image.decode()
            tintedTextures.set(`${tint}-${i}`, Colorize(await createImageBitmap(image, {
                resizeHeight: asteroidImageSize, resizeWidth: asteroidImageSize, resizeQuality: "pixelated"
            }), tint))
        }
    }

    for(let i = 0; i < SMOKE_TINTS.length; ++i) {
        const image = new Image()
        image.src = dust1
        await image.decode()
        tintedDustTextures[i] = Colorize(image, SMOKE_TINTS[i])
    }

    tintedTexturesReady = true
}

async function ensureTintedTextures() {
    if(!tintedTexturesReady) {
        await buildTintedTextures()
    }
}

export async function createAsteroidBelt({
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
}): Promise<void> {
    await ensureTintedTextures()

    const beltArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius)
    const count = Math.max(ASTEROID_COUNT_MIN, Math.floor(beltArea * ASTEROID_AREA_DENSITY))
    const dustCount = Math.max(50, Math.floor(beltArea * DUST_AREA_DENSITY))
    const mid = (innerRadius + outerRadius) / 2
    const half = (outerRadius - innerRadius) * RADIUS_SPREAD / 2

    for(let i = 0; i < count; ++i) {
        const radius = mid + (generateRandomNumber(0, 1) + generateRandomNumber(0, 1) - 1) * half
        const angle = generateRandomNumber(0, TWO_PI)
        const sizeRatio = ASTEROID_SIZE_MAX / ASTEROID_SIZE_MIN
        const size = ASTEROID_SIZE_MIN * Math.pow(sizeRatio, generateRandomNumber(0, 0.65))

        const textureComponent = new TextureComponent(undefined, undefined,
            tintedTextures.get(
                `${ASTEROID_TINTS[generateRandomNumber(0, ASTEROID_TINTS.length, true)]}-${generateRandomNumber(0, ASTEROID_TEXTURES.length, true)}`
            )
        )
        textureComponent.rotation = generateRandomNumber(0, TWO_PI)

        const eccentricity = generateRandomNumber(0, MAX_ECCENTRICITY)
        const inclination = (generateRandomNumber(0, 1) - 0.5) * 2 * MAX_INCLINATION
        const argumentOfPeriapsis = generateRandomNumber(0, TWO_PI)
        const spinSpeed = generateRandomNumber(0, Math.PI / 2)

        const asteroid = engine.createEntity()
        const asteroidBeltComponent = new AsteroidBeltComponent()
        asteroidBeltComponent.cullingScaleThreshold = ASTEROID_CULLING_SCALE_THRESHOLD

        applyComponents(
            asteroid,
            asteroidBeltComponent,
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
            new PositionComponent(0, 0),
            new SizeComponent(size, size),
            textureComponent,
            new ThicknessComponent(1)
        )

        engine.addEntity(asteroid, parent)
    }

    for(let i = 0; i < dustCount; ++i) {
        const radius = mid + (generateRandomNumber(0, 1) + generateRandomNumber(0, 1) - 1) * half
        const angle = generateRandomNumber(0, TWO_PI)
        const size = generateRandomNumber(DUST_SIZE_MIN, DUST_SIZE_MAX)

        const dust = engine.createEntity()
        const dustBeltComponent = new AsteroidBeltComponent()
        dustBeltComponent.cullingScaleThreshold = DUST_CULLING_SCALE_THRESHOLD

        const textureComponent = new TextureComponent(undefined, undefined, tintedDustTextures[generateRandomNumber(0, tintedDustTextures.length, true)])

        applyComponents(
            dust,
            dustBeltComponent,
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
            textureComponent,
            new RotationComponent(textureComponent.rotation),
        )

        engine.addEntity(dust, parent)
    }
}
