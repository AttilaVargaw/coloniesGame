import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { WebGLBaseRenderer } from "./webglBaseRenderer"
import { mat4, Mat4 } from "@/engine/lib/mat4"
import { createRectShaderProgram, type RectShaderProgram } from "./webglRectShaders"
import { WebGLTextureAtlas, type AtlasEntry, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { AsteroidBeltComponent } from "@/game/components/asteroidBeltComponent"
import { ProjectedPoint } from "@/lib/camera"
import { Vector3 } from "@/lib/Vector3"
import { SizeComponent } from "@/engine/components/sizeComponent"
import { RectNode } from "../rectNode"
import { ViewportSystem } from "../../viewportSystem"

const QUAD_VERTICES = new Float32Array([
    -0.5, -0.5, 0, 0,
    0.5, -0.5, 1, 0,
    0.5, 0.5, 1, 1,
    -0.5, 0.5, 0, 1,
])

const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3])

export class WebGLRectRenderer extends WebGLBaseRenderer<RectNode> {
    private shader: RectShaderProgram | null = null
    private quadBuffer: WebGLBuffer | null = null
    private quadIndexBuffer: WebGLBuffer | null = null
    private quadIndexCount = 0
    private atlas!: WebGLTextureAtlas
    private atlasKeyMap = new WeakMap<object, string>()
    private nextTextureKey = 0
    private textureCache = new Map<string, HTMLImageElement | HTMLCanvasElement | ImageBitmap>()
    private projection = mat4.create()
    private readonly MAX_RECT_INSTANCES = 256
    private rectInstancePool: Float32Array | null = null
    private rectBatchBuffer: Float32Array | null = null
    private pendingInstances: Array<{ page: number; depth: number; offset: number }> = []
    private groupsMap = new Map<number, Array<{ depth: number; offset: number }>>()
    private parseColorCache = new Map<string, [number, number, number]>()

    beginFrame(): void {
        this.pendingInstances.length = 0
        this.groupsMap.clear()
    }

    private ensureRectCapacity(count: number): void {
        const needed = count * 13
        if(!this.rectInstancePool || this.rectInstancePool.length < needed) {
            const newSize = Math.max(needed, this.MAX_RECT_INSTANCES * 13)
            this.rectInstancePool = new Float32Array(newSize)
        }
        if(!this.rectBatchBuffer || this.rectBatchBuffer.length < needed) {
            const newSize = Math.max(needed, this.MAX_RECT_INSTANCES * 13)
            this.rectBatchBuffer = new Float32Array(newSize)
        }
    }

    init() {
        if(!this.engine) { return }

        this.initCanvases()
        const gl = this.initContext()

        this.shader = createRectShaderProgram(gl)
        this.initBuffers()
        this.initInstanceBuffer()

        this.rectInstancePool = new Float32Array(this.MAX_RECT_INSTANCES * 13)
        this.rectBatchBuffer = new Float32Array(this.MAX_RECT_INSTANCES * 13)

        this.atlas = new WebGLTextureAtlas()
        const whiteCanvas = document.createElement("canvas")
        whiteCanvas.width = 1
        whiteCanvas.height = 1
        const ctx = whiteCanvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, 1, 1)
        this.atlas.addTexture("__white__", whiteCanvas)
    }

    private initInstanceBuffer() {
        if(!this.gl) return

        this.instanceBuffer = this.gl.createBuffer()
    }

    private initBuffers() {
        if(!this.gl) return

        this.quadBuffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
        this.gl.bufferData(this.gl.ARRAY_BUFFER, QUAD_VERTICES, this.gl.STATIC_DRAW)

        this.quadIndexBuffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, this.gl.STATIC_DRAW)
        this.quadIndexCount = QUAD_INDICES.length
    }

    private static ortho(out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
        const w = right - left
        const h = top - bottom
        const d = far - near
        out[0] = 2 / w
        out[1] = 0
        out[2] = 0
        out[3] = 0
        out[4] = 0
        out[5] = 2 / h
        out[6] = 0
        out[7] = 0
        out[8] = 0
        out[9] = 0
        out[10] = -2 / d
        out[11] = 0
        out[12] = -(right + left) / w
        out[13] = -(top + bottom) / h
        out[14] = -(far + near) / d
        out[15] = 1
        return out
    }

    resize(width: number, height: number) {
        if(!this.gl) return
        this.gl.viewport(0, 0, width, height)
    }

    private getAtlasKey(texture: object): string {
        if(this.atlasKeyMap.has(texture)) {
            return this.atlasKeyMap.get(texture)!
        }
        const key = `tex-${this.nextTextureKey++}`
        this.atlasKeyMap.set(texture, key)
        return key
    }

    private parseColor(color: string): [number, number, number] {
        const cached = this.parseColorCache.get(color)
        if (cached) return cached
        
        let r: number, g: number, b: number
        if(color.startsWith('#')) {
            r = parseInt(color.slice(1, 3), 16) / 255
            g = parseInt(color.slice(3, 5), 16) / 255
            b = parseInt(color.slice(5, 7), 16) / 255
            if(!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                const result = [r, g, b] as [number, number, number]
                this.parseColorCache.set(color, result)
                return result
            }
        }

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const data = ctx.getImageData(0, 0, 1, 1).data
        const result = [data[0] / 255, data[1] / 255, data[2] / 255] as [number, number, number]
        this.parseColorCache.set(color, result)
        return result
    }

    drawNodes(): void {
        if(!this.engine || !this.glContext) {
            return
        }

        for(const { node, projected } of this.getProjectedCacheEntries()) {
            const { camera } = this.viewportSystem

            const { worldPos } = this.getProjected(node)
            const scale = projected.scale
            const screenWidth = node.size.width * scale
            const screenHeight = node.size.height * scale

            if(
                projected.x + screenWidth / 2 < 0 ||
                projected.x - screenWidth / 2 > camera.cssWidth ||
                projected.y + screenHeight / 2 < 0 ||
                projected.y - screenHeight / 2 > camera.cssHeight
            ) {
                continue
            }

            if(this.shouldCullNode(node, projected, worldPos)) {
                continue
            }

            const resolvedTexture = this.resolveTexture(node.texture)
            const showCheckerPattern = this.engine.getDebugManager().debugflags.showCheckerPattern
            let atlasEntry: AtlasEntry | undefined

            if(showCheckerPattern) {
                atlasEntry = this.atlas.getEntry("__checker__")
                if(!atlasEntry) {
                    atlasEntry = this.atlas.addTexture("__checker__", createCheckerPatternCanvas())
                }
            } else if(resolvedTexture) {
                const texKey = this.getAtlasKey(resolvedTexture)
                atlasEntry = this.atlas.getEntry(texKey)
                if(!atlasEntry) {
                    atlasEntry = this.atlas.addTexture(texKey, resolvedTexture)
                }
            } else {
                atlasEntry = this.atlas.getEntry("__white__")
            }

            if(!atlasEntry) {
                continue
            }

            const fill = node.color.fill || "#ffffff"
            const [r, g, b] = this.parseColor(fill)

            if(this.pendingInstances.length >= this.MAX_RECT_INSTANCES) {
                this.ensureRectCapacity(this.pendingInstances.length + 1)
            }

            const poolOffset = this.pendingInstances.length * 13
            const pool = this.rectInstancePool!
            pool[poolOffset + 0] = projected.x
            pool[poolOffset + 1] = projected.y
            pool[poolOffset + 2] = screenWidth
            pool[poolOffset + 3] = screenHeight
            pool[poolOffset + 4] = node.texture?.rotation ?? 0
            pool[poolOffset + 5] = atlasEntry.u0
            pool[poolOffset + 6] = atlasEntry.v0
            pool[poolOffset + 7] = atlasEntry.u1 - atlasEntry.u0
            pool[poolOffset + 8] = atlasEntry.v1 - atlasEntry.v0
            pool[poolOffset + 9] = r
            pool[poolOffset + 10] = g
            pool[poolOffset + 11] = b
            pool[poolOffset + 12] = 1.0

            this.pendingInstances.push({
                page: atlasEntry.page,
                depth: projected.depth,
                offset: poolOffset
            })
        }

        if(!this.gl || !this.shader) {
            this.endFrameFallback()
            return
        }

        const gl = this.gl!

        this.resetGLState(gl)

        if(this.pendingInstances.length === 0) {
            return
        }

        const { camera } = this.viewportSystem
        WebGLRectRenderer.ortho(this.projection, 0, camera.cssWidth, camera.cssHeight, 0, -1, 1)

        gl.useProgram(this.shader.program)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
        const stride = 4 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 2, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, stride, 2 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)

        const instanceStride = 13 * 4

        const groups = this.groupsMap
        groups.clear()
        for(const inst of this.pendingInstances) {
            let group = groups.get(inst.page)
            if(!group) {
                group = []
                groups.set(inst.page, group)
            }
            group.push({ depth: inst.depth, offset: inst.offset })
        }

        if(!this.instanceBuffer) {
            this.instanceBuffer = gl.createBuffer()
        }

        for(const [page, instances] of groups) {
            instances.sort((a, b) => b.depth - a.depth)

            const totalFloats = instances.length * 13
            if(!this.rectBatchBuffer || this.rectBatchBuffer.length < totalFloats) {
                const newSize = Math.max(totalFloats, this.MAX_RECT_INSTANCES * 13)
                this.rectBatchBuffer = new Float32Array(newSize)
            }
            const batch = this.rectBatchBuffer!.subarray(0, totalFloats)
            for(let i = 0; i < instances.length; i++) {
                batch.set(this.rectInstancePool!.subarray(instances[i].offset, instances[i].offset + 13), i * 13)
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, batch, gl.DYNAMIC_DRAW)

            gl.enableVertexAttribArray(this.shader.attribs.instanceTranslation)
            gl.vertexAttribPointer(this.shader.attribs.instanceTranslation, 2, gl.FLOAT, false, instanceStride, 0)
            gl.vertexAttribDivisor(this.shader.attribs.instanceTranslation, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceScale)
            gl.vertexAttribPointer(this.shader.attribs.instanceScale, 2, gl.FLOAT, false, instanceStride, 2 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceScale, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceRotation)
            gl.vertexAttribPointer(this.shader.attribs.instanceRotation, 1, gl.FLOAT, false, instanceStride, 4 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceRotation, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceTexOffset)
            gl.vertexAttribPointer(this.shader.attribs.instanceTexOffset, 2, gl.FLOAT, false, instanceStride, 5 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceTexOffset, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceTexScale)
            gl.vertexAttribPointer(this.shader.attribs.instanceTexScale, 2, gl.FLOAT, false, instanceStride, 7 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceTexScale, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceColor)
            gl.vertexAttribPointer(this.shader.attribs.instanceColor, 4, gl.FLOAT, false, instanceStride, 9 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceColor, 1)

            const texture = this.atlas.getTextures(gl)[page]
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.uniform1i(this.shader.uniforms.texture, 0)

            // gl.disable(gl.DEPTH_TEST)
            gl.disable(gl.CULL_FACE)
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            gl.depthMask(false)
            gl.drawElementsInstanced(gl.TRIANGLES, this.quadIndexCount, gl.UNSIGNED_SHORT, 0, instances.length)
            gl.depthMask(true)
        }

        //set state back
        gl.disableVertexAttribArray(this.shader.attribs.instanceTranslation)
        gl.disableVertexAttribArray(this.shader.attribs.instanceScale)
        gl.disableVertexAttribArray(this.shader.attribs.instanceRotation)
        gl.disableVertexAttribArray(this.shader.attribs.instanceTexOffset)
        gl.disableVertexAttribArray(this.shader.attribs.instanceTexScale)
        gl.disableVertexAttribArray(this.shader.attribs.instanceColor)
        gl.disableVertexAttribArray(this.shader.attribs.position)
        gl.disableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribDivisor(this.shader.attribs.instanceTranslation, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceScale, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceRotation, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceTexOffset, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceTexScale, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceColor, 0)
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    protected shouldSkipProjection(node: RectNode, _cameraScale: number): boolean {
        const belt = node.entity.getComponent(AsteroidBeltComponent)
        if(belt?.cullingDistanceThreshold !== undefined) {
            const distance = this.viewportSystem.camera.distance

            if(distance > belt.cullingDistanceThreshold) {
                return true
            }
        }
        return false
    }

    protected shouldCullNode(node: RectNode, projected: ProjectedPoint, _worldPos: Vector3): boolean {
        if(node.texture?.minimumScreenSize !== undefined && node.size) {
            const worldSize = Math.max(node.size.width, node.size.height)
            if(worldSize > 0 && projected.scale < node.texture.minimumScreenSize / worldSize) {
                return true
            }
        }
        return false
    }

    constructor(viewport: ViewportSystem) {
        super(viewport,
            [PositionComponent, SizeComponent],
            (e) => {
                const color = e.getComponent(ColorComponent) ?? new ColorComponent()
                return new RectNode(e, e.getComponent(PositionComponent)!,
                    e.getComponent(SizeComponent)!,
                    color,
                    e.getComponent(TextureComponent),
                    e.getComponent(TextureComponent)?.rotation ?? 0,
                    color.emitLight,
                )
            },
        )
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer)
            if(this.quadIndexBuffer) this.gl.deleteBuffer(this.quadIndexBuffer)
        }
        return super.removeFromEngine()
    }

    private resolveTexture(texture: TextureComponent | undefined): HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | undefined {
        if(!texture) {
            return undefined
        }

        if(texture.texture) {
            return texture.texture
        }

        let sourceKey: string | undefined
        let sourceUri: string | undefined

        if(texture.svg) {
            sourceKey = `svg:${texture.svg}`
            sourceUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texture.svg)}`
        } else if(texture.src) {
            sourceKey = `src:${texture.src}`
            sourceUri = texture.src
        }

        if(!sourceKey || !sourceUri) {
            return undefined
        }

        const cached = this.textureCache.get(sourceKey)
        if(cached) {
            return cached
        }

        const image = new Image()
        image.src = sourceUri
        this.textureCache.set(sourceKey, image)

        if(image.complete) {
            return image
        }

        image.onload = () => {
            this.textureCache.set(sourceKey, image)
        }

        image.onerror = () => {
            this.textureCache.delete(sourceKey)
        }

        return image
    }
}
