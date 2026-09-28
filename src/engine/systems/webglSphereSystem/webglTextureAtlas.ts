const ATLAS_SIZE = 1024
const CELL_SIZE = 128

export interface AtlasEntry {
    u0: number
    v0: number
    u1: number
    v1: number
}

export class WebGLTextureAtlas {
    private entries = new Map<string, AtlasEntry>()
    private atlasCanvas: HTMLCanvasElement
    private atlasTexture: WebGLTexture | null = null

    constructor(private gl: WebGLRenderingContext) {
        this.atlasCanvas = document.createElement("canvas")
        this.atlasCanvas.width = ATLAS_SIZE
        this.atlasCanvas.height = ATLAS_SIZE
    }

    addTexture(key: string, source: HTMLCanvasElement | HTMLImageElement): AtlasEntry {
        if(this.entries.has(key)) {
            return this.entries.get(key)!
        }

        const index = this.entries.size
        if(index >= (ATLAS_SIZE / CELL_SIZE) ** 2) {
            throw new Error("Atlas full")
        }

        const col = index % (ATLAS_SIZE / CELL_SIZE)
        const row = Math.floor(index / (ATLAS_SIZE / CELL_SIZE))
        const x = col * CELL_SIZE
        const y = row * CELL_SIZE

        const ctx = this.atlasCanvas.getContext("2d")!
        ctx.drawImage(source, x, y, CELL_SIZE, CELL_SIZE)

        const entry: AtlasEntry = {
            u0: x / ATLAS_SIZE,
            v0: y / ATLAS_SIZE,
            u1: (x + CELL_SIZE) / ATLAS_SIZE,
            v1: (y + CELL_SIZE) / ATLAS_SIZE,
        }
        this.entries.set(key, entry)
        this.atlasTexture = null
        return entry
    }

    getTexture(gl: WebGLRenderingContext): WebGLTexture {
        if(this.atlasTexture) {
            return this.atlasTexture
        }

        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlasCanvas)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.generateMipmap(gl.TEXTURE_2D)
        this.atlasTexture = texture
        return texture
    }

    getEntry(key: string): AtlasEntry | undefined {
        return this.entries.get(key)
    }
}
