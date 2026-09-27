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

const size = 96

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
}

function grad(hash: number, x: number, y: number): number {
    const h = hash & 3
    const u = h < 2 ? x : y
    const v = h < 2 ? y : x
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

function perlin(x: number, y: number, perm: number[]): number {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)

    const aa = perm[perm[xi] + yi]
    const ab = perm[perm[xi] + yi + 1]
    const ba = perm[perm[xi + 1] + yi]
    const bb = perm[perm[xi + 1] + yi + 1]

    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u)
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u)
    return lerp(x1, x2, v)
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

function fbm(x: number, y: number, perm: number[], octaves = 6): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    for(let i = 0; i < octaves; i++) {
        value += perlin(x * frequency, y * frequency, perm) * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
    }
    return value / maxValue
}

function sampleFbm(x: number, y: number, perm: number[], warp = 0.35, octaves = 5): number {
    const qx = fbm(x + 1.7, y + 9.2, perm, octaves)
    const qy = fbm(x + 8.3, y + 2.8, perm, octaves)
    return fbm(x + warp * qx, y + warp * qy, perm, octaves)
}

function seedFrom(base: string, archetype: string): number {
    let h = 0
    for(let i = 0; i < base.length; i++) h = ((h << 5) - h + base.charCodeAt(i)) | 0
    for(let i = 0; i < archetype.length; i++) h = ((h << 5) - h + archetype.charCodeAt(i)) | 0
    return Math.abs(h) || 1
}

export function createPlanetTexture(baseColor: string, archetype: string = "earth"): HTMLCanvasElement {
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

    const seed = seedFrom(baseColor, archetype)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const nx = x / size * 4
            const ny = y / size * 4

            const landMask = sampleFbm(nx, ny, perm, 0.4, 5)
            const normalizedLand = (landMask + 1) / 2
            const cloudNoise = sampleFbm(nx * 1.5 + 10, ny * 1.5 + 10, perm, 0.3, 4)
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

export function createStarTexture(_baseColor: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.clearRect(0, 0, size, size)

    const seed = 31337
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const nx = x / size * 3
            const ny = y / size * 3
            const n = (sampleFbm(nx, ny, perm, 0.35, 5) + 1) / 2
            const bright = 0.55 + n * 0.45
            const v = Math.round(clamp(bright * 255, 0, 255))
            const idx = (y * size + x) * 4
            data[idx] = v
            data[idx + 1] = v
            data[idx + 2] = v
            data[idx + 3] = 255
        }
    }

    ctx.putImageData(imageData, 0, 0)

    for(let i = 0; i < 80; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const r = Math.random() * 12 + 3
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
        gradient.addColorStop(0, "rgba(255,255,255,0.8)")
        gradient.addColorStop(0.5, "rgba(255,255,255,0.2)")
        gradient.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }

    return canvas
}

export function createNightTexture(baseColor: string, archetype: string = "earth"): HTMLCanvasElement {
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

    const seed = seedFrom(baseColor, archetype)
    const perm = buildPerm(seed)

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const nx = x / size * 4
            const ny = y / size * 4

            const landMask = sampleFbm(nx, ny, perm, 0.4, 5)
            const normalizedLand = (landMask + 1) / 2
            const cloudNoise = sampleFbm(nx * 1.5 + 10, ny * 1.5 + 10, perm, 0.3, 4)
            const normalizedCloud = (cloudNoise + 1) / 2

            let r: number, g: number, b: number
            if(normalizedLand > 0.48) {
                r = landRgb.r * 0.2
                g = landRgb.g * 0.2
                b = landRgb.b * 0.2
            } else {
                r = oceanRgb.r * 0.12
                g = oceanRgb.g * 0.12
                b = oceanRgb.b * 0.12
            }

            if(normalizedCloud > 0.55) {
                const cloudAlpha = Math.min(1, (normalizedCloud - 0.55) * 3)
                r = lerp(r, Math.round(cloudsRgb.r * 0.15), cloudAlpha * 0.7)
                g = lerp(g, Math.round(cloudsRgb.g * 0.15), cloudAlpha * 0.7)
                b = lerp(b, Math.round(cloudsRgb.b * 0.15), cloudAlpha * 0.7)
            }

            if(normalizedLand > 0.48) {
                const cityNoise = sampleFbm(nx * 3 + 50, ny * 3 + 50, perm, 0.35, 3)
                const normalizedCity = (cityNoise + 1) / 2
                if(normalizedCity > 0.62) {
                    const intensity = (normalizedCity - 0.62) / 0.38
                    const warmth = Math.random()
                    if(warmth > 0.5) {
                        r = lerp(r, 255, intensity * 0.9)
                        g = lerp(g, 200, intensity * 0.9)
                        b = lerp(b, 120, intensity * 0.9)
                    } else {
                        r = lerp(r, 255, intensity * 0.9)
                        g = lerp(r, 255, intensity * 0.9)
                        b = lerp(b, 220, intensity * 0.9)
                    }
                }
            }

            const latitude = Math.abs(y / size - 0.5) * 2
            if(latitude > 0.78) {
                const polarAlpha = (latitude - 0.78) / 0.22
                r = lerp(r, Math.round(polesRgb.r * 0.2), polarAlpha * 0.85)
                g = lerp(g, Math.round(polesRgb.g * 0.2), polarAlpha * 0.85)
                b = lerp(b, Math.round(polesRgb.b * 0.2), polarAlpha * 0.85)
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
