import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { RectNode } from "../viewportSystem/renderers/rectNode"
import { BaseRenderer } from "../viewportSystem/renderers/baseRenderer"
import { mat4, Mat4 } from "@/engine/lib/mat4"
import { createRectShaderProgram, type RectShaderProgram } from "./webglRectShaders"
import { WebGLTextureAtlas, type AtlasEntry } from "./webglTextureAtlas"
import { Entity } from "@/engine/entities/entity"
import { AsteroidBeltComponent } from "@/game/components/asteroidBeltComponent"
import { ProjectedPoint } from "@/lib/camera"
import { Vector3 } from "@/lib/Vector3"
import { SizeComponent } from "@/engine/components/sizeComponent"

const QUAD_VERTICES = new Float32Array([
    -0.5, -0.5, 0, 0,
    0.5, -0.5, 1, 0,
    0.5, 0.5, 1, 1,
    -0.5, 0.5, 0, 1,
])

const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3])

export class WebGLRectRenderer extends BaseRenderer<RectNode> {
    private gl: WebGL2RenderingContext | null = null
    private shader: RectShaderProgram | null = null
    private quadBuffer: WebGLBuffer | null = null
    private quadIndexBuffer: WebGLBuffer | null = null
    private quadIndexCount = 0
    private textureUnit = 0
    private atlas!: Map<`${number}-${number}`, WebGLTextureAtlas>
    private glCanvas!: HTMLCanvasElement
    private canvas!: HTMLCanvasElement
    private glDrawnThisFrame = false
    private whiteTexture: WebGLTexture | null = null
    private projection = mat4.create()
    private textureCache = new Map<string, HTMLImageElement | HTMLCanvasElement | ImageBitmap>()
    private textureToAtlasKey = new WeakMap<object, string>()
    private nextTextureKey = 0
    private instanceBuffer: WebGLBuffer | null = null
    private pendingInstances: Array<{ atlasKey: string; depth: number; data: Float32Array }> = []

    beginFrame() {
        this.glDrawnThisFrame = false
        this.pendingInstances = []

        if(!this.engine || !this.gl) {
            return
        }

        const mainCanvas = this.canvas
        if(this.glCanvas.width !== mainCanvas.width || this.glCanvas.height !== mainCanvas.height) {
            this.glCanvas.width = mainCanvas.width
            this.glCanvas.height = mainCanvas.height
            this.resize(mainCanvas.width, mainCanvas.height)
            this.glCanvas.style.width = mainCanvas.style.width
            this.glCanvas.style.height = mainCanvas.style.height
        }
    }

    endFrame() {
        if(!this.gl || !this.shader) {
            if(this.glDrawnThisFrame) {
                const ctx = this.canvas.getContext("2d")
                if(ctx) {
                    const camera = this.viewportSystem.viewport.camera
                    ctx.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
                }
            }
            return
        }

        if(this.pendingInstances.length === 0) {
            return
        }

        const gl = this.gl

        const camera = this.viewportSystem.viewport.camera
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

        const groups = new Map<string, Array<{ depth: number; data: Float32Array }>>()
        for(const inst of this.pendingInstances) {
            if(!groups.has(inst.atlasKey)) {
                groups.set(inst.atlasKey, [])
            }
            groups.get(inst.atlasKey)!.push({ depth: inst.depth, data: inst.data })
        }

        const instanceStride = 13 * 4
        for(const [atlasKey, instances] of groups) {
            instances.sort((a, b) => b.depth - a.depth)

            const totalFloats = instances.length * 13
            const instanceArray = new Float32Array(totalFloats)
            let offset = 0
            for(const inst of instances) {
                instanceArray.set(inst.data, offset)
                offset += 13
            }

            let texture: WebGLTexture | null = null
            if(atlasKey === "__white__") {
                texture = this.whiteTexture
            } else {
                const atlas = this.atlas.get(atlasKey as `${number}-${number}`)
                if(atlas) {
                    texture = atlas.getTexture(gl)
                }
            }

            if(!texture) {
                continue
            }

            if(!this.instanceBuffer) {
                this.instanceBuffer = gl.createBuffer()
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, instanceArray, gl.DYNAMIC_DRAW)

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

            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.uniform1i(this.shader.uniforms.texture, 0)

            gl.disable(gl.DEPTH_TEST)
            gl.disable(gl.CULL_FACE)
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            gl.drawElementsInstanced(gl.TRIANGLES, this.quadIndexCount, gl.UNSIGNED_SHORT, 0, instances.length)

            gl.disableVertexAttribArray(this.shader.attribs.instanceTranslation)
            gl.disableVertexAttribArray(this.shader.attribs.instanceScale)
            gl.disableVertexAttribArray(this.shader.attribs.instanceRotation)
            gl.disableVertexAttribArray(this.shader.attribs.instanceTexOffset)
            gl.disableVertexAttribArray(this.shader.attribs.instanceTexScale)
            gl.disableVertexAttribArray(this.shader.attribs.instanceColor)
        }

        this.glDrawnThisFrame = true

        const ctx = this.canvas.getContext("2d")
        if(ctx) {
            ctx.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
        }
    }

    init() {
        if(!this.engine) return

        if(typeof document === "undefined") {
            throw new Error("WebGL not available")
        }
        this.glCanvas = this.engine.getCanvas("webgl2") as HTMLCanvasElement
        this.canvas = this.engine.getCanvas("2d") as HTMLCanvasElement
        this.gl = this.glCanvas.getContext("webgl2")

        if(!this.gl) {
            throw new Error("WebGL not supported")
        }

        this.shader = createRectShaderProgram(this.gl)
        this.initBuffers()
        this.initInstanceBuffer()
        this.initWhiteTexture()

        this.atlas = new Map<`${number}-${number}`, WebGLTextureAtlas>()
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

    private initWhiteTexture() {
        const gl = this.gl
        if(!gl) return

        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        this.whiteTexture = texture
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

    get glContext(): WebGL2RenderingContext | null {
        return this.gl
    }

    private getWorldPosition2(entity: Entity): [number, number, number] {
        const sceneNode = this.engine?.getSceneNode(entity)
        if(sceneNode) {
            const pos = sceneNode.getWorldPosition()
            return [pos[0], pos[1], pos[2]]
        }
        const pos = entity.getComponent(PositionComponent)
        return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
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

        if(image.complete) {
            this.textureCache.set(sourceKey, image)
            return image
        }

        image.onload = () => {
            this.textureCache.set(sourceKey, image)
        }

        return undefined
    }

    private getAtlasKey(texture: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas): string {
        if(this.textureToAtlasKey.has(texture)) {
            return this.textureToAtlasKey.get(texture)!
        }
        const key = `tex-${this.nextTextureKey++}`
        this.textureToAtlasKey.set(texture, key)
        return key
    }

    private static parseColor(color: string): [number, number, number] {
        if(color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16) / 255
            const g = parseInt(color.slice(3, 5), 16) / 255
            const b = parseInt(color.slice(5, 7), 16) / 255
            if(!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                return [r, g, b]
            }
        }

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const data = ctx.getImageData(0, 0, 1, 1).data
        return [data[0] / 255, data[1] / 255, data[2] / 255]
    }

    protected updateNode(node: RectNode, _dT?: number, ctx?: CanvasRenderingContext2D): void {
        if(ctx) {
            return
        }

        if(!this.engine || !this.atlas) {
            return
        }

        const camera = this.viewportSystem.viewport.camera

        const gl = this.glContext
        if(!gl) {
            return
        }

        const { worldPos, projected } = this.getProjected(node)
        const scale = projected.scale
        const screenWidth = node.size.width * scale
        const screenHeight = node.size.height * scale

        if(
            projected.x + screenWidth / 2 < 0 ||
            projected.x - screenWidth / 2 > camera.cssWidth ||
            projected.y + screenHeight / 2 < 0 ||
            projected.y - screenHeight / 2 > camera.cssHeight
        ) {
            return
        }

        if(this.shouldCullNode(node, projected, worldPos)) {
            return
        }

        const resolvedTexture = this.resolveTexture(node.texture)
        let atlasKey: string
        let atlasEntry: AtlasEntry | undefined

        if(resolvedTexture) {
            const sizeKey = `${resolvedTexture.width}-${resolvedTexture.height}` as `${number}-${number}`
            let atlas = this.atlas.get(sizeKey)

            if(!atlas) {
                atlas = new WebGLTextureAtlas(1024, Math.max(resolvedTexture.width, resolvedTexture.height))
                this.atlas.set(sizeKey, atlas)
            }

            const texKey = this.getAtlasKey(resolvedTexture)
            atlasEntry = atlas.getEntry(texKey)
            if(!atlasEntry) {
                atlasEntry = atlas.addTexture(texKey, resolvedTexture)
            }

            atlasKey = sizeKey
        } else {
            atlasKey = "__white__"
        }

        const fill = node.color.fill || "#ffffff"
        const [r, g, b] = WebGLRectRenderer.parseColor(fill)

        const instanceData = new Float32Array(13)
        instanceData[0] = projected.x
        instanceData[1] = projected.y
        instanceData[2] = screenWidth
        instanceData[3] = screenHeight
        instanceData[4] = node.texture?.rotation ?? 0
        instanceData[5] = atlasEntry ? atlasEntry.u0 : 0
        instanceData[6] = atlasEntry ? atlasEntry.v0 : 0
        instanceData[7] = atlasEntry ? (atlasEntry.u1 - atlasEntry.u0) : 1
        instanceData[8] = atlasEntry ? (atlasEntry.v1 - atlasEntry.v0) : 1
        instanceData[9] = r
        instanceData[10] = g
        instanceData[11] = b
        instanceData[12] = 1.0

        this.pendingInstances.push({
            atlasKey,
            depth: projected.depth,
            data: instanceData
        })
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    protected shouldSkipProjection(node: RectNode, _cameraScale: number): boolean {
        const belt = node.entity.getComponent(AsteroidBeltComponent)
        if(belt?.cullingDistanceThreshold !== undefined) {
            const distance = this.viewportSystem.viewport.camera.distance
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
            if(this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer)
            if(this.whiteTexture) this.gl.deleteTexture(this.whiteTexture)
            if(this.shader?.program) this.gl.deleteProgram(this.shader.program)
        }
        return super.removeFromEngine()
    }
}
