import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
    getCachedTexture,
    setCachedTexture,
    clearTextureCache,
} from "./textureCache"

class MockImageBitmap {
    width: number
    height: number
    closed = false
    constructor(w = 10, h = 10) {
        this.width = w
        this.height = h
    }
    close() {
        this.closed = true
    }
}

function installStableGlobals() {
    vi.stubGlobal("ImageBitmap", MockImageBitmap as unknown as typeof ImageBitmap)
    vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async (_blob: Blob) => new MockImageBitmap(10, 10)) as unknown as typeof createImageBitmap
    )
    vi.stubGlobal(
        "OffscreenCanvas",
        class {
            width: number
            height: number
            constructor(w: number, h: number) {
                this.width = w
                this.height = h
            }
            // eslint-disable-next-line class-methods-use-this
            getContext() {
                return { drawImage: vi.fn() }
            }
            convertToBlob = vi.fn(async () => new Blob(["fake-blob"]))
        } as unknown as typeof OffscreenCanvas
    )
}

beforeEach(() => {
    installStableGlobals()
})

afterEach(() => {
    vi.unstubAllGlobals()
    clearTextureCache()
})

describe("textureCache memory cache", () => {
    it("returns null when nothing is cached (IndexedDB unavailable)", async () => {
        // indexedDB is not stubbed → isIndexedDBAvailable() returns false
        const result = await getCachedTexture("planet", "#ff0000", "earth", undefined)
        expect(result).toBeNull()
    })

    it("stores and retrieves from memory cache (IndexedDB unavailable)", async () => {
        const bitmap = new MockImageBitmap(100, 100)
        await setCachedTexture("planet", "#ff0000", "earth", undefined, bitmap)

        const result = await getCachedTexture("planet", "#ff0000", "earth", undefined)
        expect(result).toBe(bitmap)
    })

    it("distinguishes different cache keys", async () => {
        const bitmap1 = new MockImageBitmap(10, 10)
        const bitmap2 = new MockImageBitmap(20, 20)
        await setCachedTexture("planet", "#ff0000", "earth", undefined, bitmap1)
        await setCachedTexture("planet", "#00ff00", "earth", undefined, bitmap2)

        const r1 = await getCachedTexture("planet", "#ff0000", "earth", undefined)
        const r2 = await getCachedTexture("planet", "#00ff00", "earth", undefined)
        expect(r1).toBe(bitmap1)
        expect(r2).toBe(bitmap2)
    })

    it("differentiates by archetype", async () => {
        const bitmap1 = new MockImageBitmap(10, 10)
        const bitmap2 = new MockImageBitmap(20, 20)
        await setCachedTexture("planet", "#ff0000", "earth", undefined, bitmap1)
        await setCachedTexture("planet", "#ff0000", "mars", undefined, bitmap2)

        const r1 = await getCachedTexture("planet", "#ff0000", "earth", undefined)
        const r2 = await getCachedTexture("planet", "#ff0000", "mars", undefined)
        expect(r1).toBe(bitmap1)
        expect(r2).toBe(bitmap2)
    })

    it("differentiates by seedKey", async () => {
        const bitmap1 = new MockImageBitmap(10, 10)
        const bitmap2 = new MockImageBitmap(20, 20)
        await setCachedTexture("planet", "#ff0000", "earth", "seed1", bitmap1)
        await setCachedTexture("planet", "#ff0000", "earth", "seed2", bitmap2)

        const r1 = await getCachedTexture("planet", "#ff0000", "earth", "seed1")
        const r2 = await getCachedTexture("planet", "#ff0000", "earth", "seed2")
        expect(r1).toBe(bitmap1)
        expect(r2).toBe(bitmap2)
    })

    it("differentiates by inner/outer radius", async () => {
        const bitmap1 = new MockImageBitmap(10, 10)
        const bitmap2 = new MockImageBitmap(20, 20)
        await setCachedTexture("ring", "#ff0000", "saturn", undefined, bitmap1, 100, 200)
        await setCachedTexture("ring", "#ff0000", "saturn", undefined, bitmap2, 100, 300)

        const r1 = await getCachedTexture("ring", "#ff0000", "saturn", undefined, 100, 200)
        const r2 = await getCachedTexture("ring", "#ff0000", "saturn", undefined, 100, 300)
        expect(r1).toBe(bitmap1)
        expect(r2).toBe(bitmap2)
    })

    it("clears memory cache and closes bitmaps", async () => {
        const bitmap = new MockImageBitmap(10, 10)
        expect(bitmap.closed).toBe(false)
        await setCachedTexture("planet", "#ff0000", "earth", undefined, bitmap)

        clearTextureCache()
        expect(bitmap.closed).toBe(true)

        const result = await getCachedTexture("planet", "#ff0000", "earth", undefined)
        // IndexedDB is unavailable, so after memory cache clear this returns null
        expect(result).toBeNull()
    })
})
