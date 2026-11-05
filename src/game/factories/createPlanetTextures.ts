import chroma from "chroma-js";
import { PlanetArchetype } from "./helpers"

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if(typeof document !== "undefined") {
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        return canvas
    }
    return new OffscreenCanvas(width, height)
}

type Palette = { land: string; ocean: string; clouds: string; poles: string; atmosphere?: string }

const PALETTES = {
    earth: { land: "#3a7d44", ocean: "#1a4b8c", clouds: "#ffffff", poles: "#e8f0f8" },
    kobol: { land: "#4a7c3f", ocean: "#1e5c8a", clouds: "#f0f4f8", poles: "#d8e8ec" },
    mercury: { land: "#8c7e6e", ocean: "#6b5e4e", clouds: "#a09585", poles: "#c8bfb0" },
    venus: { land: "#c9b896", ocean: "#d4c4a0", clouds: "#f0e8d0", poles: "#f5efe0" },
    mars: { land: "#b5532b", ocean: "#8b3a1a", clouds: "#d4a088", poles: "#e8ddd0" },
    jupiter: { land: "#c9a06c", ocean: "#a67c52", clouds: "#e8d4b0", poles: "#f0e0c0" },
    saturn: { land: "#d4bc7e", ocean: "#c4a860", clouds: "#f0e4b8", poles: "#f8f0d8" },
    uranus: { land: "#7ec8c8", ocean: "#5aa8a8", clouds: "#b8e8e8", poles: "#d8f4f4" },
    neptune: { land: "#3a6cb0", ocean: "#1e4a80", clouds: "#6090d0", poles: "#c0d8f8" },
    luna: { land: "#8a8a8a", ocean: "#6e6e6e", clouds: "#a0a0a0", poles: "#c8c8c8" },
    asteroid: { land: "#8a8a8a", ocean: "#6e6e6e", clouds: "#a0a0a0", poles: "#c8c8c8" },
} as Readonly<Record<PlanetArchetype, Palette>>

const textureSize = 512

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
}

function grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z)
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

function perlin3d(x: number, y: number, z: number, perm: number[]): number {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const zi = Math.floor(z) & 255

    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const zf = z - Math.floor(z)

    const u = fade(xf)
    const v = fade(yf)
    const w = fade(zf)

    const aaa = perm[perm[perm[xi] + yi] + zi]
    const aab = perm[perm[perm[xi] + yi] + zi + 1]
    const aba = perm[perm[perm[xi] + yi + 1] + zi]
    const abb = perm[perm[perm[xi] + yi + 1] + zi + 1]
    const baa = perm[perm[perm[xi + 1] + yi] + zi]
    const bab = perm[perm[perm[xi + 1] + yi] + zi + 1]
    const bba = perm[perm[perm[xi + 1] + yi + 1] + zi]
    const bbb = perm[perm[perm[xi + 1] + yi + 1] + zi + 1]

    const x1 = lerp(grad3(aaa, xf, yf, zf), grad3(baa, xf - 1, yf, zf), u)
    const x2 = lerp(grad3(aba, xf, yf - 1, zf), grad3(bba, xf - 1, yf - 1, zf), u)
    const y1 = lerp(x1, x2, v)

    const x3 = lerp(grad3(aab, xf, yf, zf - 1), grad3(bab, xf - 1, yf, zf - 1), u)
    const x4 = lerp(grad3(abb, xf, yf - 1, zf - 1), grad3(bbb, xf - 1, yf - 1, zf - 1), u)
    const y2 = lerp(x3, x4, v)

    return lerp(y1, y2, w)
}

function buildPerm(seed: number): number[] {
    const p = Array.from({ length: 256 }, (_, i) => i)
    let s = seed
    for(let i = 255; i > 0; i--) {
        s = (s * 16807 + 0) % 2147483647
        const j = s % (i + 1)
            ;[p[i], p[j]] = [p[j], p[i]]
    }
    return [...p, ...p]
}

function fbm3d(x: number, y: number, z: number, perm: number[], octaves = 6): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    for(let i = 0; i < octaves; i++) {
        value += perlin3d(x * frequency, y * frequency, z * frequency, perm) * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
    }
    return value / maxValue
}

function sampleFbm3d(x: number, y: number, z: number, perm: number[], warp = 0.35, octaves = 5): number {
    const qx = fbm3d(x + 1.7, y + 9.2, z + 2.3, perm, octaves)
    const qy = fbm3d(x + 8.3, y + 2.8, z + 7.1, perm, octaves)
    return fbm3d(x + warp * qx, y + warp * qy, z + warp * 0.3 * (qx + qy), perm, octaves)
}

function seedFrom(base: string, archetype: string, extra?: string): number {
    let h = 0
    for(let i = 0; i < base.length; i++) {
        h = ((h << 5) - h + base.charCodeAt(i)) | 0

    }
    for(let i = 0; i < archetype.length; i++) {
        h = ((h << 5) - h + archetype.charCodeAt(i)) | 0
    }
    if(extra) {
        for(let i = 0; i < extra.length; i++) {
            h = ((h << 5) - h + extra.charCodeAt(i)) | 0
        }
    }

    return Math.abs(h) || 1
}

function uvToSpherePoint(u: number, v: number): [number, number, number] {
    const phi = (u - 0.5) * 2 * Math.PI
    const theta = (v - 0.5) * Math.PI
    const y = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    const x = cosTheta * Math.cos(phi)
    const z = cosTheta * Math.sin(phi) + 1.0 / 3.0
    return [x, y, z]
}

function powBandTransition(t: number): number {
    const shaped = Math.sin(t * Math.PI)
    return shaped * shaped
}

const noiseScale = 4

function computeEarthLikeElevation(
    sx: number, sy: number, sz: number,
    perm: number[],
): number {
    const continental = sampleFbm3d(sx * noiseScale * 0.3, sy * noiseScale * 0.3, sz * noiseScale * 0.3, perm, 0.35, 5)
    const detail = sampleFbm3d(sx * noiseScale * 1.6, sy * noiseScale * 1.6, sz * noiseScale * 1.6, perm, 0.45, 3)
    let elevation = (continental * 0.7 + detail * 0.3 + 1) / 2
    elevation = Math.pow(elevation, 1.4)
    return elevation
}

type PixelProcessor = (x: number, y: number, sx: number, sy: number, sz: number, data: Uint8ClampedArray, perm: number[]) => void

interface TextureResult {
    canvas: HTMLCanvasElement | OffscreenCanvas
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
    data: Uint8ClampedArray
    imageData: ImageData
    size: number
    perm: number[]
}

function generateTexture(
    baseColor: string,
    seedArchetype: string,
    seedKey: string | undefined,
    processPixel: PixelProcessor
): TextureResult {
    const canvas = createCanvas(textureSize, textureSize)
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, textureSize, textureSize)

    const seed = seedFrom(baseColor, seedArchetype, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(textureSize, textureSize)
    const data = imageData.data

    for(let y = 0; y < textureSize; y++) {
        for(let x = 0; x < textureSize; x++) {
            const u = x / textureSize
            const v = y / textureSize
            const [sx, sy, sz] = uvToSpherePoint(u, v)
            processPixel(x, y, sx, sy, sz, data, perm)
        }
    }

    return { canvas, ctx, data, imageData, size: textureSize, perm }
}

function boxBlurNormalMap(src: Float32Array, width: number, height: number, radius: number): Float32Array {
    const out = new Float32Array(src.length)
    const tmp = new Float32Array(src.length)

    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            let rx = 0, ry = 0, rz = 0
            let count = 0
            for(let dy = -radius; dy <= radius; dy++) {
                for(let dx = -radius; dx <= radius; dx++) {
                    const sx = (x + dx + width) % width
                    const sy = (y + dy + height) % height
                    const idx = (sy * width + sx) * 3
                    rx += src[idx]
                    ry += src[idx + 1]
                    rz += src[idx + 2]
                    count++
                }
            }
            const idx = (y * width + x) * 3
            tmp[idx] = rx / count
            tmp[idx + 1] = ry / count
            tmp[idx + 2] = rz / count
        }
    }

    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            let rx = 0, ry = 0, rz = 0
            for(let dy = -radius; dy <= radius; dy++) {
                for(let dx = -radius; dx <= radius; dx++) {
                    const sx = (x + dx + width) % width
                    const sy = (y + dy + height) % height
                    const idx = (sy * width + sx) * 3
                    rx += tmp[idx]
                    ry += tmp[idx + 1]
                    rz += tmp[idx + 2]
                }
            }
            const idx = (y * width + x) * 3
            const len = Math.sqrt(rx * rx + ry * ry + rz * rz)
            out[idx] = rx / len
            out[idx + 1] = ry / len
            out[idx + 2] = rz / len
        }
    }

    return out
}

const GAS_GIANTS = new Set(["jupiter", "saturn", "uranus", "neptune"])

const GAS_GIANT_PALETTES: Record<string, { bands: [string, string][]; storm: string }> = {
    jupiter: {
        bands: [["#c9a06c", "#a67c52"], ["#e8d4b0", "#d4bc7e"], ["#8b6e4e", "#6b4e30"], ["#f0e0c0", "#dcc8a0"], ["#a08060", "#785838"]],
        storm: "#e8a878"
    },
    saturn: {
        bands: [["#f0e4b8", "#d4bc7e"], ["#e8d8b0", "#c4a860"], ["#f8f0d8", "#e0d0a0"], ["#d8c898", "#b8a470"], ["#ece0c0", "#d0c098"]],
        storm: "#f8ecd0"
    },
    uranus: {
        bands: [["#a8e8e8", "#7ec8c8"], ["#c8f4f4", "#a0dcdc"], ["#88d8d8", "#68b8b8"], ["#b8ecec", "#98d4d4"], ["#78c4c4", "#58a4a4"]],
        storm: "#d0f8f8"
    },
    neptune: {
        bands: [["#5a90d0", "#3a6cb0"], ["#4a7cc0", "#2a5490"], ["#6aa0e0", "#4a78b8"], ["#3870a8", "#184880"], ["#5080c8", "#305898"]],
        storm: "#80b8ff"
    }
} as const

export function createNormalTexture(baseColor: string, archetype: string = "earth", seedKey?: string, hasAtmosphere: boolean = false): HTMLCanvasElement | OffscreenCanvas {
    const epsilon = 0.04
    const strength = hasAtmosphere ? 0.02 : 0.05
    const isEarthLike = archetype === "earth" || archetype === "kobol"

    const raw = new Float32Array(textureSize * textureSize * 3)

    const { canvas, ctx, data, imageData } = generateTexture(baseColor, archetype, seedKey, (x, y, sx, sy, sz, _data, perm) => {
        let tx, ty, tz
        if(Math.abs(sy) < 0.999) {
            tx = sz
            ty = 0
            tz = -sx
        } else {
            tx = 0
            ty = 0
            tz = sy > 0 ? -1 : 1
        }
        const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz)
        tx /= tLen
        ty /= tLen
        tz /= tLen

        const bx = sy * tz - sz * ty
        const by = sz * tx - sx * tz
        const bz = sx * ty - sy * tx
        const bLen = Math.sqrt(bx * bx + by * by + bz * bz)
        const nbx = bx / bLen
        const nby = by / bLen
        const nbz = bz / bLen

        let h: number, hT: number, hB: number
        if(isEarthLike) {
            h = computeEarthLikeElevation(sx, sy, sz, perm)
            hT = computeEarthLikeElevation(sx + tx * epsilon, sy + ty * epsilon, sz + tz * epsilon, perm)
            hB = computeEarthLikeElevation(sx + nbx * epsilon, sy + nby * epsilon, sz + nbz * epsilon, perm)
        } else {
            h = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
            hT = sampleFbm3d((sx + tx * epsilon) * noiseScale, (sy + ty * epsilon) * noiseScale, (sz + tz * epsilon) * noiseScale, perm, 0.4, 5)
            hB = sampleFbm3d((sx + nbx * epsilon) * noiseScale, (sy + nby * epsilon) * noiseScale, (sz + nbz * epsilon) * noiseScale, perm, 0.4, 5)
        }

        const dhDT = (hT - h) / epsilon
        const dhDB = (hB - h) / epsilon

        let nnx = -dhDT * strength
        let nny = -dhDB * strength
        let nnz = 1.0
        const nLen = Math.sqrt(nnx * nnx + nny * nny + nnz * nnz)
        nnx /= nLen
        nny /= nLen
        nnz /= nLen

        const idx = (y * textureSize + x) * 3
        raw[idx] = nnx
        raw[idx + 1] = nny
        raw[idx + 2] = nnz
    })

    const blurred = boxBlurNormalMap(raw, textureSize, textureSize, 1)

    for(let i = 0; i < textureSize * textureSize; i++) {
        const idx = i * 4
        data[idx] = clamp(Math.round((blurred[i * 3] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 1] = clamp(Math.round((blurred[i * 3 + 1] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 2] = clamp(Math.round((blurred[i * 3 + 2] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

const ringTextureSize = 2048

export function createRingTexture(baseColor: string, archetype: string = "saturn", seedKey?: string, innerRadius?: number, outerRadius?: number): HTMLCanvasElement | OffscreenCanvas {
    const seed = seedFrom(baseColor, archetype, seedKey + "-rings")
    const perm = buildPerm(seed)

    const canvas = createCanvas(ringTextureSize, ringTextureSize)
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, ringTextureSize, ringTextureSize)

    const imageData = ctx.createImageData(ringTextureSize, ringTextureSize)
    const data = imageData.data

    const center = ringTextureSize / 2
    const maxRadius = ringTextureSize / 2

    const rInner = innerRadius !== undefined && outerRadius !== undefined && outerRadius > 0
        ? innerRadius / outerRadius
        : 0

    const iceR = 220
    const iceG = 225
    const iceB = 235
    const dirtR = 160
    const dirtG = 150
    const dirtB = 130

    for(let y = 0; y < ringTextureSize; y++) {
        for(let x = 0; x < ringTextureSize; x++) {
            const dx = x - center
            const dy = y - center
            const dist = Math.sqrt(dx * dx + dy * dy)
            const r = dist / maxRadius

            if(r > 1.0 || r < rInner) {
                const idx = (y * ringTextureSize + x) * 4
                data[idx] = 0
                data[idx + 1] = 0
                data[idx + 2] = 0
                data[idx + 3] = 0
                continue
            }

            // Remap annulus [rInner, 1.0] to full texture [0, 1]
            const rTex = (r - rInner) / (1.0 - rInner)

            const angle = Math.atan2(dy, dx)
            const cosA = Math.cos(angle)

            // Streaks tangential to the ring, continuous across the angle branch cut
            const streakX = (cosA + 1.0) * 30.0 + rTex * 2.0
            const streakY = rTex * 30.0
            const streakyNoise = sampleFbm3d(streakX, streakY, 0.0, perm, 0.5, 5)

            // Radial banding / gaps (continuous in rTex and cosA)
            const bandNoise = sampleFbm3d(rTex * 16.0, (cosA + 1.0) * 2.0, 0.0, perm, 0.4, 4)

            let band
            if(archetype === "saturn") {
                band = 0.5
                    + Math.sin(rTex * 20.0 + cosA * 0.5) * 0.15
                    + Math.cos(rTex * 40.0) * 0.08
                    + streakyNoise * 0.25
                    + bandNoise * 0.1
            } else {
                band = 0.5 + streakyNoise * 0.3 + bandNoise * 0.15
            }

            // Cassini-style gap
            const cassiniGap = Math.abs(rTex - 0.62) < 0.018
            const innerFade = rTex < 0.15 ? rTex / 0.15 : 1.0
            const outerFade = rTex > 0.88 ? (1.0 - rTex) / 0.12 : 1.0

            let brightness = band * innerFade * outerFade

            if(cassiniGap) {
                brightness *= 0.15
            }

            brightness = Math.pow(brightness, 1.2)

            // Ice streaks with dirt variation
            const mix = clamp(bandNoise * 0.5 + 0.5, 0, 1)
            const rgbR = clamp(Math.round(lerp(dirtR, iceR, mix * brightness)), 0, 255)
            const rgbG = clamp(Math.round(lerp(dirtG, iceG, mix * brightness)), 0, 255)
            const rgbB = clamp(Math.round(lerp(dirtB, iceB, mix * brightness)), 0, 255)

            const idx = (y * ringTextureSize + x) * 4
            data[idx] = rgbR
            data[idx + 1] = rgbG
            data[idx + 2] = rgbB
            data[idx + 3] = clamp(Math.round(brightness * 255), 0, 255)
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

function createEarthLikeTexture(
    baseColor: string,
    archetype: PlanetArchetype,
    seedKey: string | undefined
): HTMLCanvasElement | OffscreenCanvas {
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }
    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const canvas = createCanvas(textureSize, textureSize)
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, textureSize, textureSize)

    const imageData = ctx.createImageData(textureSize, textureSize)
    const data = imageData.data

    const deepOcean = { r: 6, g: 22, b: 44 }
    const shelf = { r: 30, g: 70, b: 110 }
    const beach = { r: 196, g: 180, b: 130 }
    const lowland = { r: 60, g: 128, b: 70 }
    const desert = { r: 188, g: 158, b: 88 }
    const highland = { r: 82, g: 102, b: 72 }
    const mountain = { r: 122, g: 112, b: 102 }
    const snow = { r: 232, g: 238, b: 244 }
    const clouds = { r: 242, g: 248, b: 254 }
    const poles = { r: 248, g: 254, b: 258 }

    for(let y = 0; y < textureSize; y++) {
        for(let x = 0; x < textureSize; x++) {
            const u = x / textureSize
            const v = y / textureSize
            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const detail = sampleFbm3d(sx * noiseScale * 1.6, sy * noiseScale * 1.6, sz * noiseScale * 1.6, perm, 0.45, 3)
            const elevation = computeEarthLikeElevation(sx, sy, sz, perm)

            const latitude = Math.abs(v - 0.5) * 2

            let r: number, g: number, b: number

            if(elevation < 0.32) {
                const t = elevation / 0.32
                r = lerp(deepOcean.r, shelf.r, t)
                g = lerp(deepOcean.g, shelf.g, t)
                b = lerp(deepOcean.b, shelf.b, t)
            } else if(elevation < 0.36) {
                const t = (elevation - 0.32) / 0.04
                r = lerp(shelf.r, beach.r, t)
                g = lerp(shelf.g, beach.g, t)
                b = lerp(shelf.b, beach.b, t)
            } else {
                const sharpened = Math.pow((elevation - 0.36) / 0.64, 1.2)
                const clamped = clamp(sharpened, 0, 1)
                const isDesert = latitude < 0.35 && detail > 0.05
                const src = isDesert ? desert : lowland
                const t = clamped
                r = lerp(src.r, highland.r, t)
                g = lerp(src.g, highland.g, t)
                b = lerp(src.b, highland.b, t)

                if(clamped > 0.5) {
                    const m = (clamped - 0.5) / 0.5
                    r = lerp(r, mountain.r, m * 1.5)
                    g = lerp(g, mountain.g, m * 1.5)
                    b = lerp(b, mountain.b, m * 1.5)
                }
                if(clamped > 0.85) {
                    const s = (clamped - 0.85) / 0.15
                    r = lerp(r, snow.r, s)
                    g = lerp(g, snow.g, s)
                    b = lerp(b, snow.b, s)
                }
            }

            r = Math.round(lerp(r, base.r, 0.08))
            g = Math.round(lerp(g, base.g, 0.08))
            b = Math.round(lerp(b, base.b, 0.08))

            const cloudNoise = sampleFbm3d(sx * noiseScale * 0.5 + 15, sy * noiseScale * 0.5 + 15, sz * noiseScale * 0.5 + 15, perm, 0.35, 4)
            const normalizedCloud = (cloudNoise + 1) / 2
            if(normalizedCloud > 0.52) {
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.52) * 3)
                r = lerp(r, clouds.r, cloudAlpha * 0.75)
                g = lerp(g, clouds.g, cloudAlpha * 0.75)
                b = lerp(b, clouds.b, cloudAlpha * 0.75)
            }

            if(latitude > 0.82 && elevation > 0.30) {
                const polarAlpha = (latitude - 0.82) / 0.18
                r = lerp(r, poles.r, polarAlpha * 0.8)
                g = lerp(g, poles.g, polarAlpha * 0.8)
                b = lerp(b, poles.b, polarAlpha * 0.8)
            }

            const idx = (y * textureSize + x) * 4
            data[idx] = clamp(Math.round(r), 0, 255)
            data[idx + 1] = clamp(Math.round(g), 0, 255)
            data[idx + 2] = clamp(Math.round(b), 0, 255)
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createPlanetTexture(baseColor: string, archetype: PlanetArchetype = "earth", seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    if(GAS_GIANTS.has(archetype)) {
        return createGasGiantTexture(baseColor, archetype, seedKey)
    }

    if(archetype === "earth" || archetype === "kobol") {
        return createEarthLikeTexture(baseColor, archetype, seedKey)
    }

    const palette = { land: baseColor, ocean: PALETTES[archetype].ocean, clouds: "#ffffff", poles: "#e0e0e0" }
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }

    const [lrn, lgn, lbn] = chroma(palette.land).mix(base, 0.18).rgb()
    const landRgb = { r: Math.round(lrn), g: Math.round(lgn), b: Math.round(lbn) }
    const [orn, ogn, obn] = chroma(palette.ocean).mix(base, 0.05).rgb()
    const oceanRgb = { r: Math.round(orn), g: Math.round(ogn), b: Math.round(obn) }
    const deepOceanRgb = {
        r: clamp(oceanRgb.r * 0.65, 0, 255),
        g: clamp(oceanRgb.g * 0.65, 0, 255),
        b: clamp(oceanRgb.b * 0.65, 0, 255),
    }
    const [crn, cgn, cbn] = chroma(palette.clouds).mix(base, 0.1).rgb()
    const cloudsRgb = { r: Math.round(crn), g: Math.round(cgn), b: Math.round(cbn) }
    const [prn, pgn, pbn] = chroma(palette.poles).mix(base, 0.1).rgb()
    const polesRgb = { r: Math.round(prn), g: Math.round(pgn), b: Math.round(pbn) }

    const { canvas, ctx, imageData, } = generateTexture(baseColor, archetype, seedKey, (x, y, sx, sy, sz, data, perm) => {
        const landMask = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
        const normalizedLand = (landMask + 1) / 2
        const cloudNoise = sampleFbm3d(sx * noiseScale * 1.5 + 10, sy * noiseScale * 1.5 + 10, sz * noiseScale * 1.5 + 10, perm, 0.3, 4)
        const normalizedCloud = (cloudNoise + 1) / 2

        const landFactor = smoothstep(0.55, 0.68, normalizedLand)
        const baseR = lerp(deepOceanRgb.r, landRgb.r, landFactor)
        const baseG = lerp(deepOceanRgb.g, landRgb.g, landFactor)
        const baseB = lerp(deepOceanRgb.b, landRgb.b, landFactor)
        const contrast = lerp(0.75, 1.45, landFactor)
        let r = clamp(lerp(baseR * 0.55, baseR * 1.55, contrast), 0, 255)
        let g = clamp(lerp(baseG * 0.55, baseG * 1.55, contrast), 0, 255)
        let b = clamp(lerp(baseB * 0.55, baseB * 1.55, contrast), 0, 255)

        if(normalizedCloud > 0.55) {
            const cloudAlpha = Math.min(1, (normalizedCloud - 0.52) * 3.5)
            r = lerp(r, cloudsRgb.r, cloudAlpha * 0.85)
            g = lerp(g, cloudsRgb.g, cloudAlpha * 0.85)
            b = lerp(b, cloudsRgb.b, cloudAlpha * 0.85)
        }

        const latitude = Math.abs(y / textureSize - 0.5) * 2
        if(latitude > 0.78) {
            const polarAlpha = (latitude - 0.78) / 0.22
            r = lerp(r, polesRgb.r, polarAlpha * 0.85)
            g = lerp(g, polesRgb.g, polarAlpha * 0.85)
            b = lerp(b, polesRgb.b, polarAlpha * 0.85)
        }

        const idx = (y * textureSize + x) * 4
        data[idx] = clamp(Math.round(r), 0, 255)
        data[idx + 1] = clamp(Math.round(g), 0, 255)
        data[idx + 2] = clamp(Math.round(b), 0, 255)
        data[idx + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createGasGiantTexture(baseColor: string, archetype: string = "jupiter", seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    const palette = GAS_GIANT_PALETTES[archetype] || GAS_GIANT_PALETTES.jupiter
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }

    const { canvas, ctx, imageData } = generateTexture(baseColor, archetype, seedKey, (x, y, sx, sy, sz, data, perm) => {
        const latitude = sy
        const bandNoise = sampleFbm3d(sx * 2.5 + 3.7, sy * 1.8 + 1.3, sz * 2.5 + 7.1, perm, 0.35, 4)
        const warpedLatitude = latitude + bandNoise * 0.25
        const rawIndex = ((warpedLatitude + 1) / 2) * palette.bands.length
        const bandIndex = Math.max(0, Math.min(Math.floor(rawIndex), palette.bands.length - 1))
        const bandFrac = rawIndex - bandIndex
        const bandA = palette.bands[bandIndex]
        const bandB = palette.bands[Math.min(bandIndex + 1, palette.bands.length - 1)]

        const [colorA, colorB] = [bandA[0], bandB[0]]
        const [arn, agn, abn] = chroma(colorA).mix(base, 0.25).rgb()
        const rgbA = { r: Math.round(arn), g: Math.round(agn), b: Math.round(abn) }
        const [crn2, cgn2, cbn2] = chroma(colorB).mix(base, 0.25).rgb()
        const rgbB = { r: Math.round(crn2), g: Math.round(cgn2), b: Math.round(cbn2) }

        const bandT = powBandTransition(bandFrac)
        const r = lerp(rgbA.r, rgbB.r, bandT)
        const g = lerp(rgbA.g, rgbB.g, bandT)
        const b = lerp(rgbA.b, rgbB.b, bandT)

        const idx = (y * textureSize + x) * 4
        data[idx] = clamp(Math.round(r), 0, 255)
        data[idx + 1] = clamp(Math.round(g), 0, 255)
        data[idx + 2] = clamp(Math.round(b), 0, 255)
        data[idx + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createStarTexture(baseColor: string, seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }

    const { canvas, ctx, imageData } = generateTexture(baseColor, "star", seedKey, (x, y, sx, sy, sz, data, perm) => {
        // Fine granulation (higher frequency for solar surface detail)
        const fine = (sampleFbm3d(sx * noiseScale * 2.0, sy * noiseScale * 2.0, sz * noiseScale * 2.0, perm, 0.5, 7) + 1) / 2
        // Coarse surface structure
        const coarse = (sampleFbm3d(sx * noiseScale * 0.75 + 7, sy * noiseScale * 0.75 + 7, sz * noiseScale * 0.75 + 7, perm, 0.3, 4) + 1) / 2
        // Sunspot regions (low-frequency dark patches)
        const spots = (sampleFbm3d(sx * noiseScale * 1.2 + 50, sy * noiseScale * 1.2 + 50, sz * noiseScale * 1.2 + 50, perm, 0.4, 3) + 1) / 2
        // Additional small sunspots
        const smallSpots = (sampleFbm3d(sx * noiseScale * 3.0 + 150, sy * noiseScale * 3.0 + 150, sz * noiseScale * 3.0 + 150, perm, 0.35, 2) + 1) / 2

        const v = y / textureSize
        const radialFalloff = 1.0 - Math.abs(v - 0.5) * 2.0
        const sharpFalloff = Math.pow(radialFalloff, 1.6)

        const bright = 0.05 + fine * 0.50 + coarse * 0.15 + sharpFalloff * 0.25
        // Sunspots darken localized regions
        const spotted = bright * (0.4 + 0.6 * spots) * (0.7 + 0.3 * smallSpots)
        const brightness = Math.round(clamp(spotted * 255, 0, 255))

        const r = Math.round(clamp(brightness * (base.r / 255), 0, 255))
        const g = Math.round(clamp(brightness * (base.g / 255), 0, 255))
        const b = Math.round(clamp(brightness * (base.b / 255), 0, 255))

        const idx = (y * textureSize + x) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    const radialGradient = ctx.createRadialGradient(
        textureSize / 2, textureSize / 2, textureSize * 0.05,
        textureSize / 2, textureSize / 2, textureSize * 0.45
    )
    radialGradient.addColorStop(0, "rgba(255,255,255,0.2)")
    radialGradient.addColorStop(0.2, "rgba(255,255,255,0.1)")
    radialGradient.addColorStop(0.5, "rgba(255,255,255,0.0)")
    radialGradient.addColorStop(1, "rgba(0,0,0,0.45)")
    ctx.fillStyle = radialGradient
    ctx.fillRect(0, 0, textureSize, textureSize)

    return canvas
}

export function createEarthLikeRoughnessTexture(
    baseColor: string,
    archetype: string,
    seedKey: string | undefined
): HTMLCanvasElement | OffscreenCanvas {
    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const canvas = createCanvas(textureSize, textureSize)
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, textureSize, textureSize)

    const imageData = ctx.createImageData(textureSize, textureSize)
    const data = imageData.data

    for(let y = 0; y < textureSize; y++) {
        for(let x = 0; x < textureSize; x++) {
            const u = x / textureSize
            const v = y / textureSize
            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const elevation = computeEarthLikeElevation(sx, sy, sz, perm)
            const elevSharpened = Math.pow(elevation, 1.4)
            const micro = sampleFbm3d(sx * noiseScale * 4.0, sy * noiseScale * 4.0, sz * noiseScale * 4.0, perm, 0.5, 2)

            let roughness: number
            if(elevSharpened < 0.34) {
                roughness = lerp(0.01, 0.06, elevSharpened)
            } else if(elevSharpened < 0.40) {
                roughness = lerp(0.1, 0.35, (elevSharpened - 0.34) / 0.06)
            } else if(elevSharpened < 0.60) {
                roughness = lerp(0.55, 0.8, (elevSharpened - 0.40) / 0.20)
            } else if(elevSharpened < 0.78) {
                roughness = lerp(0.8, 0.95, (elevSharpened - 0.60) / 0.18)
            } else {
                roughness = lerp(0.25, 0.45, (elevSharpened - 0.78) / 0.22)
            }

            roughness += micro * 0.08

            const cloudNoise = sampleFbm3d(sx * noiseScale * 0.5 + 15, sy * noiseScale * 0.5 + 15, sz * noiseScale * 0.5 + 15, perm, 0.35, 4)
            const normalizedCloud = (cloudNoise + 1) / 2
            if(normalizedCloud > 0.52) {
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.52) * 3)
                roughness = lerp(roughness, 0.4, cloudAlpha * 0.5)
            }

            const latitude = Math.abs(v - 0.5) * 2
            if(latitude > 0.82 && elevation > 0.30) {
                const polarAlpha = (latitude - 0.82) / 0.18
                roughness = lerp(roughness, 0.35, polarAlpha * 0.5)
            }

            const value = Math.round(clamp(roughness, 0, 1) * 255)
            const idx = (y * textureSize + x) * 4
            data[idx] = value
            data[idx + 1] = value
            data[idx + 2] = value
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createRoughnessTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    if(archetype === "earth" || archetype === "kobol") {
        return createEarthLikeRoughnessTexture(baseColor, archetype, seedKey)
    }

    const { canvas, ctx, imageData } = generateTexture(baseColor, archetype, seedKey, (x, y, sx, sy, sz, data, perm) => {
        const landMask = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
        const normalizedLand = (landMask + 1) / 2
        const cloudNoise = sampleFbm3d(sx * noiseScale * 1.5 + 10, sy * noiseScale * 1.5 + 10, sz * noiseScale * 1.5 + 10, perm, 0.3, 4)
        const normalizedCloud = (cloudNoise + 1) / 2

        let roughness: number
        if(normalizedLand > 0.48) {
            roughness = lerp(0.55, 0.88, normalizedLand)
        } else {
            roughness = lerp(0.02, 0.12, normalizedLand)
        }

        if(normalizedCloud > 0.55) {
            const cloudAlpha = Math.min(1, (normalizedCloud - 0.52) * 3.5)
            roughness = lerp(roughness, 0.25, cloudAlpha * 0.7)
        }

        const latitude = Math.abs(y / textureSize - 0.5) * 2
        if(latitude > 0.78) {
            const polarAlpha = (latitude - 0.78) / 0.22
            roughness = lerp(roughness, 0.08, polarAlpha * 0.7)
        }

        const value = Math.round(clamp(roughness, 0, 1) * 255)
        const idx = (y * textureSize + x) * 4
        data[idx] = value
        data[idx + 1] = value
        data[idx + 2] = value
        data[idx + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

function createEarthLikeCloudTexture(
    baseColor: string,
    archetype: string,
    seedKey: string | undefined
): HTMLCanvasElement | OffscreenCanvas {
    const seed = seedFrom(baseColor, archetype, seedKey + "-clouds")
    const perm = buildPerm(seed)

    const canvas = createCanvas(textureSize, textureSize)
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, textureSize, textureSize)

    const imageData = ctx.createImageData(textureSize, textureSize)
    const data = imageData.data

    for(let y = 0; y < textureSize; y++) {
        for(let x = 0; x < textureSize; x++) {
            const u = x / textureSize
            const v = y / textureSize
            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const lowClouds = sampleFbm3d(sx * noiseScale * 0.6 + 20, sy * noiseScale * 0.6 + 20, sz * noiseScale * 0.6 + 20, perm, 0.35, 4)
            const highClouds = sampleFbm3d(sx * noiseScale * 0.25 + 40, sy * noiseScale * 0.25 + 40, sz * noiseScale * 0.25 + 40, perm, 0.3, 5)
            const detail = sampleFbm3d(sx * noiseScale * 1.2 + 60, sy * noiseScale * 1.2 + 60, sz * noiseScale * 1.2 + 60, perm, 0.4, 3)

            const normalizedLow = (lowClouds + 1) / 2
            const normalizedHigh = (highClouds + 1) / 2
            const normalizedDetail = (detail + 1) / 2

            let alpha = 0
            if(normalizedLow > 0.5) {
                alpha = Math.max(alpha, Math.min(1, (normalizedLow - 0.5) * 3.5))
            }
            if(normalizedHigh > 0.55) {
                alpha = Math.max(alpha, Math.min(0.6, (normalizedHigh - 0.55) * 2.5))
            }
            alpha += normalizedDetail * 0.15
            alpha = clamp(alpha, 0, 1)

            const idx = (y * textureSize + x) * 4
            data[idx] = 255
            data[idx + 1] = 255
            data[idx + 2] = 255
            data[idx + 3] = Math.round(clamp(alpha * 255, 0, 255))
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createCloudTexture(baseColor: string, archetype: PlanetArchetype = "earth", seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    if(archetype === "earth" || archetype === "kobol") {
        return createEarthLikeCloudTexture(baseColor, archetype, seedKey)
    }

    const palette = PALETTES[archetype] || { clouds: "#ffffff" }
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }
    const [ccrn, ccgn, ccbn] = chroma(palette.clouds).mix(base, 0.2).rgb()
    const cloudsRgb = { r: Math.round(ccrn), g: Math.round(ccgn), b: Math.round(ccbn) }

    const { canvas, ctx, imageData } = generateTexture(baseColor, `${archetype}-clouds`, seedKey, (x, y, sx, sy, sz, data, perm) => {
        const cloudNoise = sampleFbm3d(sx * noiseScale * 0.8 + 20, sy * noiseScale * 0.8 + 20, sz * noiseScale * 0.8 + 20, perm, 0.35, 4)
        const normalizedCloud = (cloudNoise + 1) / 2

        let alpha = 0
        if(normalizedCloud > 0.4) {
            alpha = Math.min(1, (normalizedCloud - 0.45) * 4)
        }

        const idx = (y * textureSize + x) * 4
        data[idx] = cloudsRgb.r
        data[idx + 1] = cloudsRgb.g
        data[idx + 2] = cloudsRgb.b
        data[idx + 3] = Math.round(clamp(alpha * 255, 0, 255))
    })

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createNightTexture(baseColor: string, archetype: PlanetArchetype = "earth", seedKey?: string): HTMLCanvasElement | OffscreenCanvas {
    const palette = { land: baseColor, ocean: PALETTES[archetype].ocean, clouds: "#ffffff", poles: "#e0e0e0" }
    const [br, bg, bb] = chroma(baseColor).rgb()
    const base = { r: br, g: bg, b: bb }

    const [nlrn, nlgn, nlbn] = chroma(palette.land).mix(base, 0.35).rgb()
    const landRgb = { r: Math.round(nlrn), g: Math.round(nlgn), b: Math.round(nlbn) }
    const [norn, nogn, nobn] = chroma(palette.ocean).mix(base, 0.35).rgb()
    const oceanRgb = { r: Math.round(norn), g: Math.round(nogn), b: Math.round(nobn) }
    const [ncrn, ncgn, ncbn] = chroma(palette.clouds).mix(base, 0.2).rgb()
    const cloudsRgb = { r: Math.round(ncrn), g: Math.round(ncgn), b: Math.round(ncbn) }
    const [nprn, npgn, npbn] = chroma(palette.poles).mix(base, 0.15).rgb()
    const polesRgb = { r: Math.round(nprn), g: Math.round(npgn), b: Math.round(npbn) }

    const { canvas, ctx, imageData } = generateTexture(baseColor, archetype, seedKey, (x, y, sx, sy, sz, data, perm) => {
        const landMask = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
        const normalizedLand = (landMask + 1) / 2
        const cloudNoise = sampleFbm3d(sx * noiseScale * 1.5 + 10, sy * noiseScale * 1.5 + 10, sz * noiseScale * 1.5 + 10, perm, 0.3, 4)
        const normalizedCloud = (cloudNoise + 1) / 2

        let r: number, g: number, b: number
        if(normalizedLand > 0.48) {
            r = landRgb.r * 0.04
            g = landRgb.g * 0.04
            b = landRgb.b * 0.04
        } else {
            r = oceanRgb.r * 0.02
            g = oceanRgb.g * 0.02
            b = oceanRgb.b * 0.02
        }

        if(normalizedCloud > 0.55) {
            const cloudAlpha = Math.min(1, (normalizedCloud - 0.52) * 3.5)
            r = lerp(r, Math.round(cloudsRgb.r * 0.08), cloudAlpha * 0.85)
            g = lerp(g, Math.round(cloudsRgb.g * 0.08), cloudAlpha * 0.85)
            b = lerp(b, Math.round(cloudsRgb.b * 0.08), cloudAlpha * 0.85)
        }

        if(normalizedLand > 0.48) {
            const cityNoise = sampleFbm3d(sx * noiseScale * 3 + 50, sy * noiseScale * 3 + 50, sz * noiseScale * 3 + 50, perm, 0.35, 3)
            const normalizedCity = (cityNoise + 1) / 2
            if(normalizedCity > 0.65) {
                const intensity = (normalizedCity - 0.55) / 0.45
                const warmthNoise = sampleFbm3d(sx * noiseScale * 5 + 100, sy * noiseScale * 5 + 100, sz * noiseScale * 5 + 100, perm, 0.35, 2)
                const warmth = (warmthNoise + 1) / 2
                if(warmth > 0.5) {
                    r = lerp(r, 255, intensity * 0.7)
                    g = lerp(g, 200, intensity * 0.7)
                    b = lerp(b, 100, intensity * 0.7)
                } else {
                    r = lerp(r, 255, intensity * 0.7)
                    g = lerp(g, 240, intensity * 0.7)
                    b = lerp(b, 220, intensity * 0.7)
                }
            }
        }

        const latitude = Math.abs(y / textureSize - 0.5) * 2
        if(latitude > 0.78) {
            const polarAlpha = (latitude - 0.78) / 0.22
            r = lerp(r, Math.round(polesRgb.r * 0.1), polarAlpha * 0.85)
            g = lerp(g, Math.round(polesRgb.g * 0.1), polarAlpha * 0.85)
            b = lerp(b, Math.round(polesRgb.b * 0.1), polarAlpha * 0.85)
        }

        const idx = (y * textureSize + x) * 4
        data[idx] = clamp(Math.round(r), 0, 255)
        data[idx + 1] = clamp(Math.round(g), 0, 255)
        data[idx + 2] = clamp(Math.round(b), 0, 255)
        data[idx + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    return canvas
}
