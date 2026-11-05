import { describe, it, expect, beforeAll, vi } from "vitest"
import Camera from "./camera"

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
}

class MockRenderingContext2D {
    canvas: MockCanvas
    savedCount = 0
    restoredCount = 0

    constructor(canvas: MockCanvas) {
        this.canvas = canvas
    }

    save() { this.savedCount++ }
    restore() { this.restoredCount++ }
    scale() { return this.canvas }
    translate() { return this.canvas }

    _fillStyle = "#000000"
    _strokeStyle = "#000000"

    set fillStyle(v: string) { this._fillStyle = v }
    get fillStyle() { return this._fillStyle }
    set strokeStyle(v: string) { this._strokeStyle = v }
    get strokeStyle() { return this._strokeStyle }
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
})

function makeCanvas(): MockCanvas {
    return new MockCanvas(800, 600)
}

function makeCamera(settings?: ConstructorParameters<typeof Camera>[0]): Camera {
    const canvas = makeCanvas()
    const ctx = canvas.getContext() as unknown as CanvasRenderingContext2D
    return new Camera(settings ?? {}, ctx)
}

describe("Camera constructor", () => {
    it("sets defaults", () => {
        const cam = makeCamera()
        expect(cam.distance).toBe(1000)
        expect(cam.minDistance).toBe(100)
        expect(cam.maxDistance).toBe(12000)
        expect(cam.minHeightAboveTarget).toBe(20)
        expect(cam.fieldOfView).toBe(Math.PI / 4)
        expect(cam.yaw).toBe(0)
        expect(cam.pitch).toBe(Math.PI / 3)
        expect(cam.aspectRatio).toBe(800 / 600)
        expect(cam.lookAt).toEqual([0, 1, 0])
    })

    it("applies provided settings", () => {
        const cam = makeCamera({
            distance: 5000,
            fieldOfView: Math.PI / 2,
            yaw: 1,
            pitch: 0.5,
            initialPosition: [10, 20, 30],
        })
        expect(cam.distance).toBe(5000)
        expect(cam.fieldOfView).toBe(Math.PI / 2)
        expect(cam.yaw).toBe(1)
        expect(cam.pitch).toBe(0.5)
        expect(cam.lookAt).toEqual([10, 20, 30])
    })
})

describe("updateViewport", () => {
    it("updates css dimensions and viewport bounds", () => {
        const cam = makeCamera()
        expect(cam.cssWidth).toBe(800)
        expect(cam.cssHeight).toBe(600)
        expect(cam.aspectRatio).toBe(800 / 600)
    })

    it("recomputes aspect ratio on canvas resize", () => {
        const cam = makeCamera()
        const a1 = cam.aspectRatio
        const canvas = cam.context.canvas as any
        canvas.width = 1600
        canvas.clientWidth = 1600
        cam.updateViewport()
        expect(cam.aspectRatio).toBe(1600 / 600)
        expect(cam.aspectRatio).not.toBe(a1)
    })
})

describe("project", () => {
    it("projects a point in front of the camera", () => {
        const cam = makeCamera({ distance: 1000, yaw: 0, pitch: 0 })
        const projected = cam.project([0, 1, 500])
        expect(projected).not.toBeNull()
        expect(projected!.x).toBeCloseTo(cam.cssWidth / 2)
        expect(projected!.y).toBeCloseTo(cam.cssHeight / 2)
        expect(projected!.scale).toBeGreaterThan(0)
        expect(projected!.depth).toBeGreaterThan(0)
    })

    it("returns null for points behind the camera", () => {
        const cam = makeCamera({ distance: 1000, yaw: 0, pitch: 0 })
        const projected = cam.project([0, 1, 1500])
        expect(projected).toBeNull()
    })

    it("returns ProjectedPoint with all fields", () => {
        const cam = makeCamera({ distance: 1000 })
        const projected = cam.project([1000, 5, 1500])!
        expect(typeof projected.x).toBe("number")
        expect(typeof projected.y).toBe("number")
        expect(typeof projected.scale).toBe("number")
        expect(typeof projected.depth).toBe("number")
    })
})

describe("zoom", () => {
    it("zoomBy scales distance", () => {
        const cam = makeCamera({ distance: 1000 })
        const before = cam.distance
        cam.zoomBy(0.5, 400, 300)
        cam.updateSmoothZoom(1000)
        expect(cam.distance).toBeLessThan(before)
    })

    it("zoomTo clamps target between effectiveMin and max distance", () => {
        const cam = makeCamera({ distance: 1000, minDistance: 100, maxDistance: 2000 })
        const effectiveMin = cam.minHeightAboveTarget / Math.sin(cam.pitch)
        cam.zoomTo(50000)
        cam.updateSmoothZoom(1000)
        expect(cam.distance).toBeLessThanOrEqual(cam.maxDistance)
        expect(cam.distance).toBeGreaterThanOrEqual(effectiveMin)

        cam.zoomTo(1)
        cam.updateSmoothZoom(1000)
        expect(cam.distance).toBeGreaterThanOrEqual(effectiveMin)
    })

    it("zoomToAnchored updates target distance without throwing", () => {
        const cam = makeCamera({ distance: 1000 })
        const before = cam.distance
        expect(() => cam.zoomToAnchored(500, 400, 300)).not.toThrow()
        cam.updateSmoothZoom(1000)
        expect(cam.distance).not.toBe(before)
    })

    it("smooth zoom converges distance to target", () => {
        const cam = makeCamera({ distance: 1000 })
        cam.zoomTo(2000)
        cam.updateSmoothZoom(1000)
        expect(cam.distance).toBeGreaterThan(1000)
        expect(cam.distance).toBeCloseTo(2000, -1)
    })
})

describe("move", () => {
    it("moveTo sets lookAt", () => {
        const cam = makeCamera()
        cam.moveTo(100, 200, 300)
        expect(cam.lookAt).toEqual([100, 200, 300])
    })

    it("panByPixels moves lookAt", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const before = [...cam.lookAt]
        cam.panByPixels(100, 0)
        expect(cam.lookAt[0]).not.toBe(before[0])
    })
})

describe("screenToWorld", () => {
    it("returns a world-space point from screen coords", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const result = cam.screenToWorld(400, 300)
        expect(typeof result.x).toBe("number")
        expect(typeof result.y).toBe("number")
        expect(typeof result.z).toBe("number")
    })
})

describe("worldToScreen", () => {
    it("writes screen coords into the provided object", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const obj = { x: 0, y: 0 }
        cam.worldToScreen(0, 1, 0, obj)
        expect(typeof obj.x).toBe("number")
        expect(typeof obj.y).toBe("number")
    })
})

describe("screenToWorldRay", () => {
    it("returns origin and direction", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const ray = cam.screenToWorldRay(400, 300)
        expect(ray.origin).toHaveLength(3)
        expect(ray.direction).toHaveLength(3)
    })
})

describe("getBasisVectors", () => {
    it("returns right and up unit vectors", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const { right, up } = cam.getBasisVectors()
        expect(right).toHaveLength(3)
        expect(up).toHaveLength(3)
        const rightLen = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2)
        const upLen = Math.sqrt(up[0] ** 2 + up[1] ** 2 + up[2] ** 2)
        expect(rightLen).toBeCloseTo(1)
        expect(upLen).toBeCloseTo(1)
    })
})

describe("visibleBounds", () => {
    it("returns css bounds", () => {
        const cam = makeCamera()
        const b = cam.visibleBounds
        expect(b.left).toBe(0)
        expect(b.top).toBe(0)
        expect(b.right).toBe(cam.cssWidth)
        expect(b.bottom).toBe(cam.cssHeight)
    })
})

describe("cameraPosition", () => {
    it("returns the camera world position", () => {
        const cam = makeCamera({ yaw: 0, pitch: 0 })
        const pos = cam.cameraPosition
        expect(pos).toHaveLength(3)
        // camera sits in front of lookAt along +z when yaw=0, pitch=0
        expect(pos[2]).toBeGreaterThan(cam.lookAt[2])
    })
})
