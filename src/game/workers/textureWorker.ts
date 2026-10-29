import { createPlanetTexture, createStarTexture, createNormalTexture, createRoughnessTexture, createCloudTexture, createNightTexture, createRingTexture } from "../factories/createPlanetTextures"
import { PlanetArchetype } from "../factories/helpers"

type TextureType = "planet" | "star" | "normal" | "roughness" | "cloud" | "night" | "ring"

interface TextureRequest {
    type: "texture"
    textureType: TextureType
    baseColor: string
    archetype?: PlanetArchetype
    seedKey?: string
    hasAtmosphere?: boolean
    innerRadius?: number
    outerRadius?: number
    id: number
}

self.onmessage = async ({ data: { textureType, baseColor, archetype, seedKey, hasAtmosphere, innerRadius, outerRadius, id } }: MessageEvent<TextureRequest>) => {
    let canvas: HTMLCanvasElement | OffscreenCanvas
    switch(textureType) {
        case "planet":
            canvas = createPlanetTexture(baseColor, archetype, seedKey)
            break
        case "star":
            canvas = createStarTexture(baseColor, seedKey)
            break
        case "normal":
            canvas = createNormalTexture(baseColor, archetype, seedKey, !!hasAtmosphere)
            break
        case "roughness":
            canvas = createRoughnessTexture(baseColor, archetype, seedKey)
            break
        case "cloud":
            canvas = createCloudTexture(baseColor, archetype, seedKey)
            break
        case "night":
            canvas = createNightTexture(baseColor, archetype, seedKey)
            break
        case "ring":
            canvas = createRingTexture(baseColor, archetype, seedKey, innerRadius, outerRadius)
            break
        default:
            throw new Error(`Unknown texture type: ${textureType}`)
    }

    const bitmap = await createImageBitmap(canvas)
    self.postMessage({ type: "result", id, bitmap })
}
