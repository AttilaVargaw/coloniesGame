
import { getPlatform } from "@/engine/lib/platform"

function ensureCanvas(canvas: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
    if(!canvas || canvas.width !== width || canvas.height !== height) {
        const c = getPlatform().createCanvas()
        c.width = width
        c.height = height
        return c
    }
    return canvas
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

    const gradient2 = ensureGradient(ctx, width, height)

    ctx.fillStyle = gradient2
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

    const vignetteGradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75)
    vignetteGradient.addColorStop(0, "rgba(0,0,0,0)")
    vignetteGradient.addColorStop(1, "rgba(0,0,0,0.65)")

    ctx.fillStyle = vignetteGradient
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}

let contrastCanvas: HTMLCanvasElement | null = null
let contrastCtx: CanvasRenderingContext2D | null = null

export function applyContrastSaturation(ctx: CanvasRenderingContext2D, width: number, height: number, contrast = 1.15, saturation = 1.1) {
    contrastCanvas = ensureCanvas(contrastCanvas, width, height)
    contrastCtx = contrastCanvas.getContext("2d")!

    contrastCtx.clearRect(0, 0, width, height)
    contrastCtx.filter = `contrast(${contrast}) saturate(${saturation})`
    contrastCtx.drawImage(ctx.canvas, 0, 0)
    contrastCtx.filter = "none"

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(contrastCanvas, 0, 0)
    ctx.restore()
}
