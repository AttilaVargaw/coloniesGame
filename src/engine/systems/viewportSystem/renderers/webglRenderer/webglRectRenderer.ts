import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { TextureComponent, TextureSource } from "@/engine/components/textureComponent"
import { WebGLBaseRenderer, sortGroupsByDepth } from "./webglBaseRenderer"
import { createRectShaderProgram, type RectShaderProgram } from "./webglRectShaders"
import { WebGLTextureAtlas, type AtlasEntry, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { getPlatform } from "@/engine/lib/platform"
import { AsteroidBeltComponent } from "@/engine/components/asteroidBeltComponent"
import { ProjectedPoint } from "@/lib/camera"
import { SizeComponent } from "@/engine/components/sizeComponent"
import { RectNode } from "../rectNode"
import { ViewportSystem } from "../../viewportSystem"
import { mat4, vec3 } from "gl-matrix"
import { SOLAR_UNIT } from "@/game/constants"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { hexToRgb } from "./hexToRgb"
import {
    setupInstancedAttrib,
    resetInstancedAttrib,
    bindPageTexture,
    growFloatPool,
    uploadInstanceBatch,
    groupInstancesByPage,
} from "./webglRendererUtils"

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
    private readonly atlasKeyMap = new WeakMap<object, string>()
    private nextTextureKey = 0
    private readonly textureCache = new Map<string, TextureSource>()
    private projection = mat4.create()
    private readonly MAX_RECT_INSTANCES = 256
    private rectInstancePool: Float32Array | null = null
    private rectBatchBuffer: Float32Array | null = null
    private readonly pendingInstances: Array<{ page: number; depth: number; offset: number }> = []
    private readonly parseColorCache = new Map<string, [number, number, number]>()
    private instanceBufferCapacity = 0

    private ensureRectCapacity(count: number): void {
        const needed = count * 17
        if(!this.rectInstancePool || this.rectInstancePool.length < needed) {
            const newSize = Math.max(needed, this.MAX_RECT_INSTANCES * 23)
            this.rectInstancePool = new Float32Array(newSize)
        }
        if(!this.rectBatchBuffer || this.rectBatchBuffer.length < needed) {
            const newSize = Math.max(needed, this.MAX_RECT_INSTANCES * 23)
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

        this.rectInstancePool = new Float32Array(this.MAX_RECT_INSTANCES * 23)
        this.rectBatchBuffer = new Float32Array(this.MAX_RECT_INSTANCES * 23)

        this.atlas = new WebGLTextureAtlas(1024, 256)
        const whiteCanvas = getPlatform().createCanvas()
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
        if(cached) return cached

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
        if(!this.engine || !this.glContext || !this.shader || !this.viewportSystem.camera || !this.gl) {
            return
        }

        this.pendingInstances.length = 0

        const { camera } = this.viewportSystem
        const showCheckerPattern = this.engine.getDebugManager().debugflags.showCheckerPattern
        const gl = this.gl

        for(const { node, projected } of this.getProjectedCacheEntries()) {
            const { worldPos } = this.getProjected(node)
            const scale = projected.scale
            const rawScreenWidth = node.size.width * scale
            const rawScreenHeight = node.size.height * scale
            const minSize = node.size.minSize
            const maxRawScreenSize = Math.max(rawScreenWidth, rawScreenHeight)
            const scaleUp = minSize && maxRawScreenSize < minSize ? minSize / maxRawScreenSize : 1
            const screenWidth = rawScreenWidth * scaleUp
            const screenHeight = rawScreenHeight * scaleUp

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

            const resolvedTexture = node.texture && this.resolveTexture(node.texture)
            let atlasEntry: AtlasEntry | undefined

            if(showCheckerPattern) {
                atlasEntry = this.atlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
            } else if(resolvedTexture) {
                const texKey = this.getAtlasKey(resolvedTexture)
                atlasEntry = this.atlas.getOrCreateEntry(texKey, resolvedTexture)
            } else {
                atlasEntry = this.atlas.getEntry("__white__")
            }

            if(!atlasEntry) {
                continue
            }

            const fill = node.color.fill || "#ffffff"
            const [r, g, b] = this.parseColor(fill)

            const starEntity = this.findStarEntityForPlanet(node.entity)
            let lightDir = vec3.fromValues(0, 1, 0)
            let starColor = vec3.fromValues(1.0, 1.0, 1.0)

            if(starEntity) {
                const lightDirRaw: vec3 = vec3.sub(vec3.create(), getAbsolute(starEntity, this.engine!), worldPos)
                const lightDirLength = vec3.length(lightDirRaw)
                lightDir = lightDirLength > 0
                    ? vec3.normalize(vec3.create(), lightDirRaw)
                    : vec3.fromValues(0, 1, 0)
                const attenuation = lightDirLength > 0 ? Math.min(1.0, 150.0 / lightDirLength) : 1.0

                const starColorComponent = starEntity.getComponent(ColorComponent)
                if(starColorComponent?.fill) {
                    const parsed = hexToRgb(starColorComponent.fill)
                    starColor = [parsed.r / 255 * attenuation, parsed.g / 255 * attenuation, parsed.b / 255 * attenuation]
                }
            }

            if(this.pendingInstances.length >= this.MAX_RECT_INSTANCES) {
                this.ensureRectCapacity(this.pendingInstances.length + 1)
            }

            const poolOffset = this.pendingInstances.length * 23
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
            const [tintR, tintG, tintB] = node.texture?.tint ? this.parseColor(node.texture.tint) : [1, 1, 1]
            pool[poolOffset + 13] = tintR
            pool[poolOffset + 14] = tintG
            pool[poolOffset + 15] = tintB
            pool[poolOffset + 16] = node.texture?.tint ? 1.0 : 0.0
            pool[poolOffset + 17] = lightDir[0]
            pool[poolOffset + 18] = lightDir[1]
            pool[poolOffset + 19] = lightDir[2]
            pool[poolOffset + 20] = starColor[0]
            pool[poolOffset + 21] = starColor[1]
            pool[poolOffset + 22] = starColor[2]

            this.pendingInstances.push({
                page: atlasEntry.page,
                depth: projected.depth,
                offset: poolOffset
            })
        }

        this.resetGLState(gl)

        if(this.pendingInstances.length === 0) {
            return
        }

        mat4.ortho(this.projection, 0, camera.cssWidth, camera.cssHeight, 0, -1, 1)

        gl.useProgram(this.shader.program)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.03, 0.03, 0.05)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
        const stride = 4 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 2, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, stride, 2 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)

        const instanceStride = 23 * 4

        const groups = groupInstancesByPage(this.pendingInstances)

        const sortedGroups = sortGroupsByDepth(groups)

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)

        let _lastPage = -1
        for(const [page, instances] of sortedGroups) {
            instances.sort((a, b) => b.depth - a.depth)

            const totalFloats = instances.length * 23
            this.rectBatchBuffer = growFloatPool(this.rectBatchBuffer, totalFloats, this.MAX_RECT_INSTANCES * 23)
            const batch = this.rectBatchBuffer!.subarray(0, totalFloats)
            for(let i = 0; i < instances.length; i++) {
                batch.set(this.rectInstancePool!.subarray(instances[i].offset, instances[i].offset + 23), i * 23)
            }

            const upload = uploadInstanceBatch(gl, this.instanceBuffer, batch, this.instanceBufferCapacity)
            this.instanceBuffer = upload.buffer
            this.instanceBufferCapacity = upload.capacity

            setupInstancedAttrib(gl, this.shader.attribs.instanceTranslation, 2, 0, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceScale, 2, 2 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceRotation, 1, 4 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceTexOffset, 2, 5 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceTexScale, 2, 7 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceColor, 4, 9 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceTintColor, 3, 13 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceTintAlpha, 1, 16 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceLightDir, 3, 17 * 4, instanceStride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceLightColor, 3, 20 * 4, instanceStride)

            _lastPage = bindPageTexture(gl, this.atlas.getTextures(gl), page, 0, this.shader.uniforms.texture, _lastPage)

            gl.drawElementsInstanced(gl.TRIANGLES, this.quadIndexCount, gl.UNSIGNED_SHORT, 0, instances.length)
        }

        gl.depthMask(true)
        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)

        //set state back
        resetInstancedAttrib(gl, this.shader.attribs.instanceTranslation)
        resetInstancedAttrib(gl, this.shader.attribs.instanceScale)
        resetInstancedAttrib(gl, this.shader.attribs.instanceRotation)
        resetInstancedAttrib(gl, this.shader.attribs.instanceTexOffset)
        resetInstancedAttrib(gl, this.shader.attribs.instanceTexScale)
        resetInstancedAttrib(gl, this.shader.attribs.instanceColor)
        resetInstancedAttrib(gl, this.shader.attribs.instanceTintColor)
        resetInstancedAttrib(gl, this.shader.attribs.instanceTintAlpha)
        gl.disableVertexAttribArray(this.shader.attribs.position)
        gl.disableVertexAttribArray(this.shader.attribs.texCoord)
    }

    protected getCullMargin(node: RectNode): number {
        return Math.max(node.size.width, node.size.height) / 2
    }

    protected shouldSkipProjection(node: RectNode, cameraDistance: number, _cameraScale: number): boolean {
        const belt = node.entity.getComponent(AsteroidBeltComponent)
        if(belt?.cullingDistanceThreshold !== undefined && cameraDistance > belt.cullingDistanceThreshold) {
            return true
        }
        return false
    }

    protected shouldCullNode(node: RectNode, projected: ProjectedPoint, _worldPos: vec3): boolean {
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
                const texture = e.getComponent(TextureComponent)

                return new RectNode(e, e.getComponent(PositionComponent)!,
                    e.getComponent(SizeComponent)!,
                    color,
                    texture,
                    texture?.rotation ?? 0,
                    color.emitLight,
                    !!texture?.svg
                )
            },
        )
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.shader) this.gl.deleteProgram(this.shader.program)
            if(this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer)
            if(this.quadIndexBuffer) this.gl.deleteBuffer(this.quadIndexBuffer)
            if(this.atlas) this.atlas.dispose(this.gl)
        }
        this.parseColorCache.clear()
        this.textureCache.clear()
        return super.removeFromEngine()
    }

    private resolveTexture(texture: TextureComponent): TextureSource {
        if(texture.day) {
            return texture.day
        }

        const sourceUri = texture.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texture.svg)}` : texture.src!
        const cached = this.textureCache.get(sourceUri)

        if(cached) {
            return cached
        }

        const image = new Image()
        image.src = sourceUri
        this.textureCache.set(sourceUri, image)

        if(image.complete) {
            return image
        }

        image.onload = () => {
            this.textureCache.set(sourceUri, image)
        }

        image.onerror = () => {
            this.textureCache.delete(sourceUri)
        }

        return image
    }
}
