const ATLAS_SIZE = 1024
const CELL_SIZE = 128

export { createCheckerPatternCanvas } from "./createCheckerPattern"
export interface AtlasEntry {
    u0: number
    v0: number
    u1: number
    v1: number
    page: number
}

class AtlasPage {
    readonly canvas: HTMLCanvasElement
    private texture: WebGLTexture | null = null
    private dirty = true

    constructor(public size: number, public cellSize: number) {
        this.canvas = document.createElement("canvas")
        this.canvas.width = size
        this.canvas.height = size
    }

    addTexture(_key: string, source: HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas, index: number): { u0: number; v0: number; u1: number; v1: number } {
        const cols = this.size / this.cellSize
        const col = index % cols
        const row = Math.floor(index / cols)
        const x = col * this.cellSize
        const y = row * this.cellSize

        const ctx = this.canvas.getContext("2d")!
        ctx.drawImage(source, x, y, this.cellSize, this.cellSize)

        this.dirty = true

        return {
            u0: x / this.size,
            v0: y / this.size,
            u1: (x + this.cellSize) / this.size,
            v1: (y + this.cellSize) / this.size,
        }
    }

    getTexture(gl: WebGL2RenderingContext): WebGLTexture {
        if(!this.dirty && this.texture) {
            return this.texture
        }

        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

        this.texture = texture
        this.dirty = false
        return texture
    }
}

export class WebGLTextureAtlas {
    private pages: AtlasPage[] = []
    private entries = new Map<string, { page: number; index: number; entry: { u0: number; v0: number; u1: number; v1: number } }>()
    private cachedTextures: WebGLTexture[] | null = null

    constructor(atlasSize = ATLAS_SIZE, cellSize = CELL_SIZE) {
        if(typeof document === "undefined") {
            throw new Error("WebGL texture atlas not available")
        }
        this.pages.push(new AtlasPage(atlasSize, cellSize))
    }

    addTexture(key: string, source: HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas): AtlasEntry {
        if(!(
            source instanceof HTMLCanvasElement ||
            source instanceof HTMLImageElement ||
            source instanceof ImageBitmap ||
            source instanceof OffscreenCanvas)) {
            throw new Error("Unsupported texture source type")
        }

        const existing = this.entries.get(key)
        if(existing) {
            return { ...existing.entry, page: existing.page }
        }

        const cellsPerPage = (this.pages[0].size / this.pages[0].cellSize) ** 2

        let pageIndex = 0
        let cellIndex = 0

        for(let i = 0; i < this.pages.length; i++) {
            const usedInPage = this.entries.size - pageIndex * cellsPerPage
            if(usedInPage < cellsPerPage) {
                cellIndex = usedInPage
                break
            }
            pageIndex++
        }

        if(pageIndex >= this.pages.length) {
            this.pages.push(new AtlasPage(this.pages[0].size, this.pages[0].cellSize))
            cellIndex = 0
        }

        const page = this.pages[pageIndex]
        const uv = page.addTexture(key, source, cellIndex)

        this.entries.set(key, { page: pageIndex, index: cellIndex, entry: uv })
        this.cachedTextures = null

        return { ...uv, page: pageIndex }
    }

    getTextures(gl: WebGL2RenderingContext): WebGLTexture[] {
        if (this.cachedTextures) {
            return this.cachedTextures
        }
        const textures = this.pages.map(page => page.getTexture(gl))
        this.cachedTextures = textures
        return textures
    }

    getEntry(key: string): AtlasEntry | undefined {
        const entry = this.entries.get(key)
        if(!entry) return undefined
        return { ...entry.entry, page: entry.page }
    }
}
