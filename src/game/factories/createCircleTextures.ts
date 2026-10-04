function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 128, g: 128, b: 128 }
}

function tintColor(rgb: { r: number; g: number; b: number }, base: { r: number; g: number; b: number }, strength: number): { r: number; g: number; b: number } {
    const t = strength
    return {
        r: Math.round(lerp(rgb.r, base.r, t)),
        g: Math.round(lerp(rgb.g, base.g, t)),
        b: Math.round(lerp(rgb.b, base.b, t)),
    }
}

type Palette = { land: string; ocean: string; clouds: string; poles: string; atmosphere?: string }

const PALETTES: Record<string, Palette> = {
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
}

const size = 384

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
    for(let i = 0; i < base.length; i++) h = ((h << 5) - h + base.charCodeAt(i)) | 0
    for(let i = 0; i < archetype.length; i++) h = ((h << 5) - h + archetype.charCodeAt(i)) | 0
    if(extra) {
        for(let i = 0; i < extra.length; i++) h = ((h << 5) - h + extra.charCodeAt(i)) | 0
    }
    return Math.abs(h) || 1
}

function uvToSpherePoint(u: number, v: number): [number, number, number] {
    const phi = (u - 0.5) * 2 * Math.PI
    const theta = (v - 0.5) * Math.PI
    const y = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    const x = cosTheta * Math.cos(phi)
    const z = cosTheta * Math.sin(phi)
    return [x, y, z]
}

const noiseScale = 4

export function createNormalTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    const epsilon = 0.04
    const strength = 0.01

    const raw = new Float32Array(size * size * 3)

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size

            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const nx = sx, ny = sy, nz = sz
            let tx, ty, tz
            if(Math.abs(ny) < 0.999) {
                tx = nz
                ty = 0
                tz = -nx
            } else {
                tx = 0
                ty = 0
                tz = ny > 0 ? -1 : 1
            }
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz)
            tx /= tLen
            ty /= tLen
            tz /= tLen

            const bx = ny * tz - nz * ty
            const by = nz * tx - nx * tz
            const bz = nx * ty - ny * tx
            const bLen = Math.sqrt(bx * bx + by * by + bz * bz)
            const nbx = bx / bLen
            const nby = by / bLen
            const nbz = bz / bLen

            const h = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
            const hT = sampleFbm3d((sx + tx * epsilon) * noiseScale, (sy + ty * epsilon) * noiseScale, (sz + tz * epsilon) * noiseScale, perm, 0.4, 5)
            const hB = sampleFbm3d((sx + nbx * epsilon) * noiseScale, (sy + nby * epsilon) * noiseScale, (sz + nbz * epsilon) * noiseScale, perm, 0.4, 5)

            const dhDT = (hT - h) / epsilon
            const dhDB = (hB - h) / epsilon

            let nnx = -dhDT * strength
            let nny = -dhDB * strength
            let nnz = 1.0
            const nLen = Math.sqrt(nnx * nnx + nny * nny + nnz * nnz)
            nnx /= nLen
            nny /= nLen
            nnz /= nLen

            const idx = (y * size + x) * 3
            raw[idx] = nnx
            raw[idx + 1] = nny
            raw[idx + 2] = nnz
        }
    }

    const blurred = boxBlurNormalMap(raw, size, size, 1)

    for(let i = 0; i < size * size; i++) {
        const idx = i * 4
        data[idx] = clamp(Math.round((blurred[i * 3] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 1] = clamp(Math.round((blurred[i * 3 + 1] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 2] = clamp(Math.round((blurred[i * 3 + 2] * 0.5 + 0.5) * 255), 0, 255)
        data[idx + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
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
            //let count = 0
            for(let dy = -radius; dy <= radius; dy++) {
                for(let dx = -radius; dx <= radius; dx++) {
                    const sx = (x + dx + width) % width
                    const sy = (y + dy + height) % height
                    const idx = (sy * width + sx) * 3
                    rx += tmp[idx]
                    ry += tmp[idx + 1]
                    rz += tmp[idx + 2]
                    //count++
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

export function createPlanetTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const palette = { land: baseColor, ocean: PALETTES[archetype].ocean, clouds: "#ffffff", poles: "#e0e0e0" }
    const base = hexToRgb(baseColor)

    const landRgb = tintColor(hexToRgb(palette.land), base, 0.35)
    const oceanRgb = tintColor(hexToRgb(palette.ocean), base, 0.35)
    const cloudsRgb = tintColor(hexToRgb(palette.clouds), base, 0.2)
    const polesRgb = tintColor(hexToRgb(palette.poles), base, 0.15)

    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size

            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const landMask = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
            const normalizedLand = (landMask + 1) / 2
            const cloudNoise = sampleFbm3d(sx * noiseScale * 1.5 + 10, sy * noiseScale * 1.5 + 10, sz * noiseScale * 1.5 + 10, perm, 0.3, 4)
            const normalizedCloud = (cloudNoise + 1) / 2

            let r: number, g: number, b: number
            if(normalizedLand > 0.48) {
                r = lerp(landRgb.r * 0.7, landRgb.r * 1.3, normalizedLand)
                g = lerp(landRgb.g * 0.7, landRgb.g * 1.3, normalizedLand)
                b = lerp(landRgb.b * 0.7, landRgb.b * 1.3, normalizedLand)
            } else {
                r = lerp(oceanRgb.r * 0.8, oceanRgb.r * 1.2, normalizedLand)
                g = lerp(oceanRgb.g * 0.8, oceanRgb.g * 1.2, normalizedLand)
                b = lerp(oceanRgb.b * 0.8, oceanRgb.b * 1.2, normalizedLand)
            }

            if(normalizedCloud > 0.55) {
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.55) * 3)
                r = lerp(r, cloudsRgb.r, cloudAlpha * 0.7)
                g = lerp(g, cloudsRgb.g, cloudAlpha * 0.7)
                b = lerp(b, cloudsRgb.b, cloudAlpha * 0.7)
            }

            const latitude = Math.abs(y / size - 0.5) * 2
            if(latitude > 0.78) {
                const polarAlpha = (latitude - 0.78) / 0.22
                r = lerp(r, polesRgb.r, polarAlpha * 0.85)
                g = lerp(g, polesRgb.g, polarAlpha * 0.85)
                b = lerp(b, polesRgb.b, polarAlpha * 0.85)
            }

            const idx = (y * size + x) * 4
            data[idx] = clamp(Math.round(r), 0, 255)
            data[idx + 1] = clamp(Math.round(g), 0, 255)
            data[idx + 2] = clamp(Math.round(b), 0, 255)
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    const atmosphereColor = palette.atmosphere || palette.clouds
    const atmRgb = tintColor(hexToRgb(atmosphereColor), base, 0.15)
    const atmGradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.42, size / 2, size / 2, size * 0.5)
    atmGradient.addColorStop(0, "rgba(0,0,0,0)")
    atmGradient.addColorStop(0.85, "rgba(0,0,0,0)")
    atmGradient.addColorStop(1, `rgba(${atmRgb.r},${atmRgb.g},${atmRgb.b},0.15)`)
    ctx.fillStyle = atmGradient
    ctx.fillRect(0, 0, size, size)

    return canvas
}

export function createStarTexture(baseColor: string, seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const seedVal = seedFrom(baseColor, "star", seedKey)
    const perm = buildPerm(seedVal)
    const base = hexToRgb(baseColor)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size
            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const fine = (sampleFbm3d(sx * noiseScale * 1.25, sy * noiseScale * 1.25, sz * noiseScale * 1.25, perm, 0.4, 6) + 1) / 2
            const coarse = (sampleFbm3d(sx * noiseScale * 0.75 + 7, sy * noiseScale * 0.75 + 7, sz * noiseScale * 0.75 + 7, perm, 0.3, 4) + 1) / 2
            const bright = 0.25 + fine * 0.60 + coarse * 0.15
            const brightness = Math.round(clamp(bright * 255, 0, 255))

            const r = Math.round(clamp(brightness * (base.r / 255), 0, 255))
            const g = Math.round(clamp(brightness * (base.g / 255), 0, 255))
            const b = Math.round(clamp(brightness * (base.b / 255), 0, 255))

            const idx = (y * size + x) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    const radialGradient = ctx.createRadialGradient(
        size / 2, size / 2, size * 0.15,
        size / 2, size / 2, size * 0.5
    )
    radialGradient.addColorStop(0, "rgba(255,255,255,0.35)")
    radialGradient.addColorStop(0.6, "rgba(255,255,255,0.05)")
    radialGradient.addColorStop(1, "rgba(0,0,0,0.25)")
    ctx.fillStyle = radialGradient
    ctx.fillRect(0, 0, size, size)

    for(let i = 0; i < 60; i++) {
        const spotU = (perlin3d(i * 1.7, 42.1, 13.7, perm) + 1) / 2
        const spotV = (perlin3d(42.1, i * 1.7, 13.7, perm) + 1) / 2
        const x = spotU * size
        const y = spotV * size
        const r = (perlin3d(13.7, 42.1, i * 1.7, perm) + 1) / 2 * 20 + 5
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
        gradient.addColorStop(0, "rgba(255,255,255,0.9)")
        gradient.addColorStop(0.3, "rgba(255,255,255,0.35)")
        gradient.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }

    return canvas
}

export function createRoughnessTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size

            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const landMask = sampleFbm3d(sx * noiseScale, sy * noiseScale, sz * noiseScale, perm, 0.4, 5)
            const normalizedLand = (landMask + 1) / 2
            const cloudNoise = sampleFbm3d(sx * noiseScale * 1.5 + 10, sy * noiseScale * 1.5 + 10, sz * noiseScale * 1.5 + 10, perm, 0.3, 4)
            const normalizedCloud = (cloudNoise + 1) / 2

            let roughness: number
            if(normalizedLand > 0.48) {
                roughness = lerp(0.55, 0.85, normalizedLand)
            } else {
                roughness = lerp(0.08, 0.18, normalizedLand)
            }

            if(normalizedCloud > 0.55) {
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.55) * 3)
                roughness = lerp(roughness, 0.35, cloudAlpha * 0.6)
            }

            const latitude = Math.abs(y / size - 0.5) * 2
            if(latitude > 0.78) {
                const polarAlpha = (latitude - 0.78) / 0.22
                roughness = lerp(roughness, 0.15, polarAlpha * 0.7)
            }

            const value = Math.round(clamp(roughness, 0, 1) * 255)
            const idx = (y * size + x) * 4
            data[idx] = value
            data[idx + 1] = value
            data[idx + 2] = value
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createCloudTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const palette = PALETTES[archetype] || { clouds: "#ffffff" }
    const base = hexToRgb(baseColor)
    const cloudsRgb = tintColor(hexToRgb(palette.clouds), base, 0.2)

    const seed = seedFrom(baseColor, `${archetype}-clouds`, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size

            const [sx, sy, sz] = uvToSpherePoint(u, v)

            const cloudNoise = sampleFbm3d(sx * noiseScale * 0.8 + 20, sy * noiseScale * 0.8 + 20, sz * noiseScale * 0.8 + 20, perm, 0.35, 4)
            const normalizedCloud = (cloudNoise + 1) / 2

            let alpha = 0
            if(normalizedCloud > 0.52) {
                alpha = Math.min(1, (normalizedCloud - 0.52) * 2.5)
            }

            const idx = (y * size + x) * 4
            data[idx] = cloudsRgb.r
            data[idx + 1] = cloudsRgb.g
            data[idx + 2] = cloudsRgb.b
            data[idx + 3] = Math.round(clamp(alpha * 200, 0, 255))
        }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
}

export function createNightTexture(baseColor: string, archetype: string = "earth", seedKey?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const palette = PALETTES[archetype] || { land: baseColor, ocean: baseColor, clouds: "#ffffff", poles: "#e0e0e0" }
    const base = hexToRgb(baseColor)

    const landRgb = tintColor(hexToRgb(palette.land), base, 0.35)
    const oceanRgb = tintColor(hexToRgb(palette.ocean), base, 0.35)
    const cloudsRgb = tintColor(hexToRgb(palette.clouds), base, 0.2)
    const polesRgb = tintColor(hexToRgb(palette.poles), base, 0.15)

    const seed = seedFrom(baseColor, archetype, seedKey)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const u = x / size
            const v = y / size
            const [sx, sy, sz] = uvToSpherePoint(u, v)

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
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.55) * 3)
                r = lerp(r, Math.round(cloudsRgb.r * 0.08), cloudAlpha * 0.7)
                g = lerp(g, Math.round(cloudsRgb.g * 0.08), cloudAlpha * 0.7)
                b = lerp(b, Math.round(cloudsRgb.b * 0.08), cloudAlpha * 0.7)
            }

            if(normalizedLand > 0.48) {
                const cityNoise = sampleFbm3d(sx * noiseScale * 3 + 50, sy * noiseScale * 3 + 50, sz * noiseScale * 3 + 50, perm, 0.35, 3)
                const normalizedCity = (cityNoise + 1) / 2
                if(normalizedCity > 0.62) {
                    const intensity = (normalizedCity - 0.62) / 0.38
                    const warmth = Math.random()
                    if(warmth > 0.5) {
                        r = lerp(r, 255, intensity)
                        g = lerp(g, 180, intensity)
                        b = lerp(b, 80, intensity)
                    } else {
                        r = lerp(r, 255, intensity)
                        g = lerp(g, 240, intensity)
                        b = lerp(b, 200, intensity)
                    }
                }
            }

            const latitude = Math.abs(y / size - 0.5) * 2
            if(latitude > 0.78) {
                const polarAlpha = (latitude - 0.78) / 0.22
                r = lerp(r, Math.round(polesRgb.r * 0.1), polarAlpha * 0.85)
                g = lerp(g, Math.round(polesRgb.g * 0.1), polarAlpha * 0.85)
                b = lerp(b, Math.round(polesRgb.b * 0.1), polarAlpha * 0.85)
            }

            const idx = (y * size + x) * 4
            data[idx] = clamp(Math.round(r), 0, 255)
            data[idx + 1] = clamp(Math.round(g), 0, 255)
            data[idx + 2] = clamp(Math.round(b), 0, 255)
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    const atmosphereColor = palette.atmosphere || palette.clouds
    const atmRgb = tintColor(hexToRgb(atmosphereColor), base, 0.15)
    const atmGradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.42, size / 2, size / 2, size * 0.5)
    atmGradient.addColorStop(0, "rgba(0,0,0,0)")
    atmGradient.addColorStop(0.85, "rgba(0,0,0,0)")
    atmGradient.addColorStop(1, `rgba(${atmRgb.r},${atmRgb.g},${atmRgb.b},0.1)`)
    ctx.fillStyle = atmGradient
    ctx.fillRect(0, 0, size, size)

    return canvas
}
