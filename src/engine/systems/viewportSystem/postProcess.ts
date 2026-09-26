import type { BloomSettings } from "@/engine/lib/debugManager"

let offscreen: HTMLCanvasElement | null = null
let offCtx: CanvasRenderingContext2D | null = null
let bloomCanvas: HTMLCanvasElement | null = null
let tempCanvas: HTMLCanvasElement | null = null
let tempCtx: CanvasRenderingContext2D | null = null

function ensureCanvas(canvas: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
    if(!canvas || canvas.width !== width || canvas.height !== height) {
        const c = document.createElement("canvas")
        c.width = width
        c.height = height
        return c
    }
    return canvas
}

function blurCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement, iterations: number) {
    const w = source.width
    const h = source.height
    const targetCtx = target.getContext("2d")!
    targetCtx.clearRect(0, 0, w, h)

    tempCanvas = ensureCanvas(tempCanvas, w, h)
    tempCtx = tempCanvas.getContext("2d")!
    tempCtx.clearRect(0, 0, w, h)
    tempCtx.drawImage(source, 0, 0)

    for(let i = 0; i < iterations; i++) {
        targetCtx.clearRect(0, 0, w, h)
        targetCtx.filter = `blur(${8 + i * 4}px)`
        targetCtx.globalCompositeOperation = "screen"
        targetCtx.globalAlpha = 0.7
        targetCtx.drawImage(tempCanvas, 0, 0)
        tempCtx.clearRect(0, 0, w, h)
        tempCtx.drawImage(target, 0, 0)
    }

    targetCtx.filter = "none"
    targetCtx.globalCompositeOperation = "source-over"
    targetCtx.globalAlpha = 1
}

export function applyBloom(ctx: CanvasRenderingContext2D, width: number, height: number, settings: BloomSettings) {
    offscreen = ensureCanvas(offscreen, width, height)
    bloomCanvas = ensureCanvas(bloomCanvas, width, height)
    offCtx = offscreen.getContext("2d")!

    offCtx.clearRect(0, 0, width, height)
    offCtx.filter = `brightness(${settings.brightness}) contrast(${settings.contrast})`
    offCtx.drawImage(ctx.canvas, 0, 0)
    offCtx.filter = "none"

    blurCanvas(offscreen, bloomCanvas, settings.iterations)

    ctx.save()
    ctx.globalCompositeOperation = "screen"
    ctx.globalAlpha = settings.alpha
    ctx.drawImage(bloomCanvas, 0, 0)
    ctx.restore()
}

export function applyBloomLayer(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, settings: BloomSettings) {
    const width = source.width
    const height = source.height
    bloomCanvas = ensureCanvas(bloomCanvas, width, height)

    blurCanvas(source, bloomCanvas, settings.iterations)

    ctx.save()
    ctx.globalCompositeOperation = "screen"
    ctx.globalAlpha = settings.alpha
    ctx.drawImage(bloomCanvas, 0, 0)
    ctx.restore()
}

let gradient: CanvasGradient | null = null
let gradientWidth = 0
let gradientHeight = 0

function ensureGradient(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if(!gradient || gradientWidth !== width || gradientHeight !== height) {
        gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7)
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)")
        gradient.addColorStop(0.5, "rgba(60, 40, 100, 0.4)")
        gradient.addColorStop(1, "rgba(10, 15, 40, 0.7)")

        gradientWidth = width
        gradientHeight = height
    }

    return gradient
}

export function applyColorGrading(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save()
    ctx.globalCompositeOperation = "overlay"
    ctx.globalAlpha = 0.18

    const gradient = ensureGradient(ctx, width, height)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = "soft-light"
    ctx.globalAlpha = 0.12
    ctx.fillStyle = "rgba(255, 180, 120, 1)"
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}

export function applyVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save()
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1

    const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75)
    gradient.addColorStop(0, "rgba(0,0,0,0)")
    gradient.addColorStop(1, "rgba(0,0,0,0.65)")

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}
