import { createPlanetTexture, createStarTexture, createNormalTexture, createRoughnessTexture, createCloudTexture, createNightTexture } from "../factories/createCircleTextures"

type TextureType = "planet" | "star" | "normal" | "roughness" | "cloud" | "night"

interface TextureRequest {
    type: "texture"
    textureType: TextureType
    baseColor: string
    archetype?: string
    seedKey?: string
    id: number
}

self.onmessage = async (event: MessageEvent<TextureRequest>) => {
    const { textureType, baseColor, archetype, seedKey } = event.data
    
    let canvas: HTMLCanvasElement | OffscreenCanvas
    switch(textureType) {
        case "planet":
            canvas = createPlanetTexture(baseColor, archetype, seedKey)
            break
        case "star":
            canvas = createStarTexture(baseColor, seedKey)
            break
        case "normal":
            canvas = createNormalTexture(baseColor, archetype, seedKey)
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
        default:
            throw new Error(`Unknown texture type: ${textureType}`)
    }

    const bitmap = await createImageBitmap(canvas)
    self.postMessage({ type: "result", id: event.data.id, bitmap })
}
