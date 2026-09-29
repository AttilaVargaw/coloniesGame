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
import { applyComponents, calculateSoi, createAttractorClickHandler } from "./helpers"
import { createMarker } from "./createSpaceship"
import { RotationComponent } from "../components/rotationComponent"
import { AsteroidBeltComponent } from "../components/asteroidBeltComponent"
import { generateRandomNumber } from "../../lib/generateRandomNumber"
import buildableSite from "../../components/icons/buildable.svg"
import { BuildableComponent } from "../components/buildableComponent"
import { SoiComponent } from "@engine/components/soiComponent"
import { PathComponent } from "../components/pathComponent"
import { JumpNodeComponent } from "../components/jumpGraph"
import { TargetableComponent } from "@engine/components/targetableComponent"
import { HoverableComponent } from "@game/systems/cursorSystem"
import { MassComponent } from "@engine/components/massComponent"
import { SelectableComponent } from "@engine/components/SelectableComponent"
import { ClickableComponent } from "@/engine/components/clickableComponent"
import { createEntity } from "@/engine/lib/entityRegistry"
import { v4 as uuid } from "uuid"

const ASTEROID_TEXTURES = [asteroids1, asteroids2, asteroids3, asteroids4, asteroids5, asteroids6] as const
const ASTEROID_SIZE_MIN = 1
const ASTEROID_SIZE_MAX = 7
const RADIUS_SPREAD = 0.8
const ASTEROID_AREA_DENSITY = 0.5
const ASTEROID_COUNT_MIN = 200
const MAX_ECCENTRICITY = 0.2
const MAX_INCLINATION = 0.1
const DUST_AREA_DENSITY = 0.3
const ASTEROID_CULLING_DISTANCE_THRESHOLD = 10000
const DUST_CULLING_DISTANCE_THRESHOLD = 10000
const DUST_SIZE_MIN = 30
const DUST_SIZE_MAX = 80
const MINING_SITE_RADIUS = 4
const MINING_SITE_AREA_DENSITY = 0.005

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
    "#8a7e72",
    "#847868",
    "#706458",
    "#a09888",
    "#6e6258"
] as const

const DUST_TEXTURE_SIZE = 64

const tintedTextures = new Map<string, OffscreenCanvas | HTMLImageElement>()
const tintedDustTextures = [] as (OffscreenCanvas | HTMLImageElement)[]
let tintedTexturesReady = false

export function disposeAsteroidTextures() {
    for(const texture of tintedTextures.values()) {
        if(texture instanceof OffscreenCanvas) {
            // OffscreenCanvas has no explicit close in all browsers; just drop references
        }
    }
    tintedTextures.clear()
    tintedDustTextures.length = 0
    tintedTexturesReady = false
}

function Colorize(image: HTMLImageElement | OffscreenCanvas | ImageBitmap, color: `#${string}`) {
    const imageSize = image.width

    const offscreen = new OffscreenCanvas(imageSize, imageSize)
    const ctx = offscreen.getContext("2d")!

    ctx.drawImage(image, 0, 0)
    ctx.globalCompositeOperation = "multiply"
    ctx.fillStyle = color
    ctx.fillRect(0, 0, imageSize, imageSize)

    ctx.globalCompositeOperation = "destination-in"
    ctx.drawImage(image, 0, 0)

    return offscreen
}

async function buildTintedTextures() {
    const asteroidPromises: Promise<void>[] = []
    for(const tint of ASTEROID_TINTS) {
        for(let i = 0; i < ASTEROID_TEXTURES.length; ++i) {
            const key = `${tint}-${i}`
            asteroidPromises.push(
                new Promise<void>((resolve) => {
                    const image = new Image()
                    image.src = ASTEROID_TEXTURES[i]
                    image.decode().then(() => createImageBitmap(image, {
                        resizeHeight: asteroidImageSize, resizeWidth: asteroidImageSize, resizeQuality: "pixelated"
                    })).then((bitmap) => {
                        tintedTextures.set(key, Colorize(bitmap, tint))
                        resolve()
                    })
                })
            )
        }
    }

    const dustPromises = SMOKE_TINTS.map((tint, i) => new Promise<void>((resolve) => {
        const image = new Image()
        image.src = dust1
        image.decode().then(() => createImageBitmap(image, {
            resizeHeight: DUST_TEXTURE_SIZE, resizeWidth: DUST_TEXTURE_SIZE, resizeQuality: "pixelated"
        })).then((bitmap) => {
            tintedDustTextures[i] = Colorize(bitmap, tint)
            resolve()
        })
    }))

    await Promise.all([...asteroidPromises, ...dustPromises])
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
    name,
}: {
    innerRadius: number
    outerRadius: number
    parent: Entity
    engine: Engine
    parentMass: number
    name: string
}): Promise<void> {
    await ensureTintedTextures()

    const beltArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius)
    const count = Math.max(ASTEROID_COUNT_MIN, Math.floor(beltArea * ASTEROID_AREA_DENSITY))
    const dustCount = Math.max(50, Math.floor(beltArea * DUST_AREA_DENSITY))
    const mid = (innerRadius + outerRadius) / 2
    const half = (outerRadius - innerRadius) * RADIUS_SPREAD / 2

    const asteroidTintKeys = ASTEROID_TINTS.map(t => t as string)
    const asteroidTextureCount = ASTEROID_TEXTURES.length

    for(let i = 0; i < count; ++i) {
        const radius = mid + (generateRandomNumber(0, 1) + generateRandomNumber(0, 1) - 1) * half
        const angle = generateRandomNumber(0, TWO_PI)
        const sizeRatio = ASTEROID_SIZE_MAX / ASTEROID_SIZE_MIN
        const size = ASTEROID_SIZE_MIN * Math.pow(sizeRatio, generateRandomNumber(0, 0.65))

        const tintIndex = Math.floor(generateRandomNumber(0, ASTEROID_TINTS.length, true))
        const textureIndex = Math.floor(generateRandomNumber(0, asteroidTextureCount, true))
        const textureKey = `${asteroidTintKeys[tintIndex]}-${textureIndex}`
        const texture = tintedTextures.get(textureKey)

        const textureComponent = new TextureComponent(undefined, undefined, texture, undefined, undefined, undefined, undefined, undefined, uuid())
        textureComponent.rotation = generateRandomNumber(0, TWO_PI)

        const eccentricity = generateRandomNumber(0, MAX_ECCENTRICITY)
        const inclination = (generateRandomNumber(0, 1) - 0.5) * 2 * MAX_INCLINATION
        const argumentOfPeriapsis = generateRandomNumber(0, TWO_PI)
        const spinSpeed = generateRandomNumber(0, Math.PI / 2)

        const asteroid = createEntity()
        const asteroidBeltComponent = new AsteroidBeltComponent()
        asteroidBeltComponent.cullingDistanceThreshold = ASTEROID_CULLING_DISTANCE_THRESHOLD

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

        const dust = createEntity()
        const dustBeltComponent = new AsteroidBeltComponent()
        dustBeltComponent.cullingDistanceThreshold = DUST_CULLING_DISTANCE_THRESHOLD

        const textureComponent = new TextureComponent(undefined, undefined, tintedDustTextures[Math.floor(generateRandomNumber(0, tintedDustTextures.length, true))])
        textureComponent.rotation = 0

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

    const siteCount = Math.max(6, Math.floor(beltArea * MINING_SITE_AREA_DENSITY))
    const clickSize = MINING_SITE_RADIUS * 2
    const clickSquare = { width: clickSize, height: clickSize }
    const radius = innerRadius + generateRandomNumber(0, 1) * (outerRadius - innerRadius)

    for(let i = 0; i < siteCount; i++) {
        const angle = i * TWO_PI / siteCount //generateRandomNumber(0, TWO_PI)
        const eccentricity = 0
        const inclination = 0
        const argumentOfPeriapsis = 0

        const site = createMarker({
            color: "yellow",
            shade: true,
            texture: buildableSite,
            radius: MINING_SITE_RADIUS,
            label: `${name} Mining Site ${i + 1}`,
        })

        applyComponents(site,
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
            new SoiComponent(calculateSoi(MINING_SITE_RADIUS, "luna")),
            new PathComponent(),
            new TargetableComponent(),
            new HoverableComponent("pointer", clickSquare),
            new MassComponent(1),
            new JumpNodeComponent(),
            new BuildableComponent(["hydrocarbonRefinery"]),
            new SelectableComponent(clickSize, "red"),
            new ClickableComponent(true, clickSquare, createAttractorClickHandler(engine, site))
        )

        engine.addEntity(site, parent)
    }
}
