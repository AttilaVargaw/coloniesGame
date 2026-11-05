import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { mulberry32 } from "./mulberry32"
import { hexToRgba } from "./renderers/hexToRgba"
import { drawRotationIndicator } from "./drawRotationIndicator"
import { drawCameraGizmo, drawCameraTarget } from "./drawCameraGizmo"
import { applyColorGrading, applyVignette, applyContrastSaturation } from "./postProcess"
import { drawStarfield } from "./drawStarfield"
import { drawNebulas } from "./drawNebulas"
import Camera from "@/lib/camera"
import { setPlatform } from "@/engine/lib/platform"

// ----- Minimal canvas mock for Node.js environment -----

class MockCanvas {
    _width: number
    _height: number
    clientWidth: number
    clientHeight: number
    _ctx: MockRenderingContext2D

    constructor(width = 800, height = 600) {
        this._width = width
        this._height = height
        this.clientWidth = width
        this.clientHeight = height
        this._ctx = new MockRenderingContext2D(this)
    }

    get width() { return this._width }
    set width(v: number) { this._width = v }
    get height() { return this._height }
    set height(v: number) { this._height = v }

    getContext() { return this._ctx }
    getBoundingClientRect() {
        return { left: 0, top: 0, right: this._width, bottom: this._height }
    }
    toDataURL() { return this.width + "" }
    toBlob() { return this.height }
    captureStream() { return this.height as unknown as MediaStream }
    transferControlToOffscreen() { return this._width as unknown as OffscreenCanvas }
}

class MockRenderingContext2D {
    canvas: HTMLCanvasElement
    _data: Uint8ClampedArray
    _fillStyle = "#000000"
    _strokeStyle = "#000000"
    globalAlpha = 1
    globalCompositeOperation = "source-over"
    filter = "none"
    lineWidth = 1
    lineCap = "butt"
    font = "10px sans-serif"
    textAlign = "start"
    textBaseline = "alphabetic"
    shadowColor = "rgba(0,0,0,0)"
    shadowBlur = 0
    shadowOffsetX = 0
    shadowOffsetY = 0

    constructor(canvas: MockCanvas) {
        this.canvas = canvas as unknown as HTMLCanvasElement
        this._data = new Uint8ClampedArray(canvas.width * canvas.height * 4)
    }

    save() { return this.canvas }
    restore() { return this.canvas }
    beginPath() { return this.canvas }
    fill() { return this.canvas }
    stroke() { return this.canvas }
    moveTo() { return this.canvas }
    lineTo() { return this.canvas }
    arc() { return this.canvas }
    clearRect() { return this.canvas }
    fillRect() { return this.canvas }
    fillText() { return this.canvas }

    setTransform() { return this }
    drawImage() { return this }

    createRadialGradient() { if(this.canvas) return { addColorStop: () => undefined } }

    set fillStyle(v: string) { this._fillStyle = v }
    get fillStyle() { return this._fillStyle }
    set strokeStyle(v: string) { this._strokeStyle = v }
    get strokeStyle() { return this._strokeStyle }
}

function makeCamera(canvas: MockCanvas): Camera {
    const ctx = canvas.getContext() as unknown as CanvasRenderingContext2D
    return new Camera({
        distance: 1000,
        fieldOfView: Math.PI / 4,
        scaleX: 1,
        scaleY: 1,
    }, ctx)
}

beforeAll(() => {
    vi.stubGlobal("document", {
        createElement: () => new MockCanvas(),
        body: { style: {} },
    } as unknown as Document)
    vi.stubGlobal("window", {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    } as unknown as Window)

    setPlatform({
        createCanvas: () => new MockCanvas() as unknown as HTMLCanvasElement,
        window: window as unknown as Window,
        document: document as unknown as Document,
    })
})

describe("mulberry32", () => {
    it("produces values in [0, 1)", () => {
        const rng = mulberry32(42)
        for(let i = 0; i < 1000; i++) {
            const v = rng()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    it("is deterministic - same seed produces identical sequence", () => {
        const a = mulberry32(12345)
        const b = mulberry32(12345)
        for(let i = 0; i < 50; i++) {
            expect(a()).toBe(b())
        }
    })

    it("different seeds produce different sequences", () => {
        const a = mulberry32(1)
        const b = mulberry32(2)
        let different = false
        for(let i = 0; i < 50; i++) {
            if(a() !== b()) {
                different = true
                break
            }
        }
        expect(different).toBe(true)
    })
})

describe("hexToRgba", () => {
    it("parses a hex color with alpha", () => {
        expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)")
    })

    it("parses white", () => {
        expect(hexToRgba("#ffffff", 1)).toBe("rgba(255,255,255,1)")
    })

    it("parses black", () => {
        expect(hexToRgba("#000000", 0)).toBe("rgba(0,0,0,0)")
    })
})

describe("canvas drawing functions", () => {
    let canvas: MockCanvas
    let ctx: CanvasRenderingContext2D
    let camera: Camera

    beforeEach(() => {
        canvas = new MockCanvas(800, 600)
        ctx = canvas.getContext() as unknown as CanvasRenderingContext2D
        camera = makeCamera(canvas)
    })

    it("drawRotationIndicator draws without throwing", () => {
        expect(() => drawRotationIndicator(ctx, camera)).not.toThrow()
    })

    it("drawCameraGizmo draws without throwing", () => {
        expect(() => drawCameraGizmo(ctx, camera)).not.toThrow()
    })

    it("drawCameraTarget draws without throwing", () => {
        expect(() => drawCameraTarget(ctx, camera)).not.toThrow()
    })

    it("applyColorGrading draws without throwing", () => {
        expect(() => applyColorGrading(ctx, canvas.width, canvas.height)).not.toThrow()
    })

    it("applyVignette draws without throwing", () => {
        expect(() => applyVignette(ctx, canvas.width, canvas.height)).not.toThrow()
    })

    it("applyContrastSaturation draws without throwing", () => {
        expect(() => applyContrastSaturation(ctx, canvas.width, canvas.height)).not.toThrow()
    })

    it("drawStarfield draws without throwing", () => {
        expect(() => drawStarfield(ctx, camera)).not.toThrow()
    })

    it("drawNebulas draws without throwing", () => {
        expect(() => drawNebulas(ctx, camera)).not.toThrow()
    })
})
