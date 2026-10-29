const ATLAS_SIZE = 1024
const CELL_SIZE = 128
const BORDER = 4

import { TextureSource } from "@/engine/components/textureComponent"
import { getPlatform } from "@/engine/lib/platform"

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
        this.canvas = getPlatform().createCanvas()
        this.canvas.width = size
        this.canvas.height = size
    }

    addTexture(_key: string, source: TextureSource, index: number): { u0: number; v0: number; u1: number; v1: number } {
        const cols = this.size / this.cellSize
        const col = index % cols
        const row = Math.floor(index / cols)
        const x = col * this.cellSize
        const y = row * this.cellSize

        const ctx = this.canvas.getContext("2d")!

        const contentX = x + BORDER
        const contentY = y + BORDER
        const contentW = this.cellSize - BORDER * 2
        const contentH = this.cellSize - BORDER * 2

        ctx.drawImage(source, contentX, contentY, contentW, contentH)

        const srcW = source.width
        const srcH = source.height

        if(srcW > 0 && srcH > 0) {
            ctx.drawImage(source, 0, 0, srcW, 1, contentX, y, contentW, BORDER)
            ctx.drawImage(source, 0, srcH - 1, srcW, 1, contentX, y + this.cellSize - BORDER, contentW, BORDER)
            ctx.drawImage(source, 0, 0, 1, srcH, x, contentY, BORDER, contentH)
            ctx.drawImage(source, srcW - 1, 0, 1, srcH, x + this.cellSize - BORDER, contentY, BORDER, contentH)
        }

        this.dirty = true

        const halfU = 0.5 / this.size
        const halfV = 0.5 / this.size

        return {
            u0: contentX / this.size + halfU,
            v0: contentY / this.size + halfV,
            u1: (contentX + contentW) / this.size - halfU,
            v1: (contentY + contentH) / this.size - halfV,
        }
    }

    getTexture(gl: WebGL2RenderingContext): WebGLTexture {
        if(!this.dirty && this.texture) {
            return this.texture
        }

        if(this.texture) {
            gl.deleteTexture(this.texture)
        }
        const ext = gl.getExtension("EXT_texture_filter_anisotropic")

        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        ext &&
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT))

        gl.generateMipmap(gl.TEXTURE_2D)

        this.texture = texture
        this.dirty = false
        return texture
    }

    dispose(gl: WebGL2RenderingContext): void {
        if(this.texture) {
            gl.deleteTexture(this.texture)
        }
    }
}

export class WebGLTextureAtlas {
    private pages: AtlasPage[] = []
    private entries = new Map<string, { page: number; index: number; entry: { u0: number; v0: number; u1: number; v1: number } }>()
    private cachedTextures: WebGLTexture[] | null = null

    constructor(atlasSize = ATLAS_SIZE, cellSize = CELL_SIZE) {
        this.pages.push(new AtlasPage(atlasSize, cellSize))
    }

    addTexture(key: string, source: TextureSource): AtlasEntry {
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

    getOrCreateEntry(key: string, source: TextureSource): AtlasEntry {
        const existing = this.entries.get(key)
        if(existing) {
            return { ...existing.entry, page: existing.page }
        }
        return this.addTexture(key, source)
    }

    getTextures(gl: WebGL2RenderingContext): WebGLTexture[] {
        if(this.cachedTextures) {
            return this.cachedTextures
        }
        const textures = this.pages.map(page => page.getTexture(gl))
        this.cachedTextures = textures
        return textures
    }

    dispose(gl: WebGL2RenderingContext): void {
        for(const page of this.pages) {
            page.dispose(gl)
        }
        this.cachedTextures = null
        this.entries.clear()
    }

    getEntry(key: string): AtlasEntry | undefined {
        const entry = this.entries.get(key)
        if(!entry) return undefined
        return { ...entry.entry, page: entry.page }
    }
}
