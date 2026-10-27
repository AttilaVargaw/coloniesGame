import { createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram } from "./webglShaders"
import { createBloomShaderProgram, createBlurShaderProgram } from "./webglSphereShaders"
import type { ShaderProgram } from "./ShaderProgram"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { WebGLBaseRenderer, sortGroupsByDepth } from "./webglBaseRenderer"
import { SOLAR_UNIT } from "@/game/constants"
import { AtlasEntry, WebGLTextureAtlas, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { getPlatform } from "@/engine/lib/platform"
import { Entity } from "@/engine/entities/entity"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { ViewportSystem } from "../../viewportSystem"
import { RenderableNode } from "../renderableNode"
import Camera from "@/lib/camera"
import { ProjectedPoint } from "@/lib/camera"
import { vec3, mat4, mat3 } from "gl-matrix"

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 0.3, g: 0.6, b: 1.0 }
}

export class WebGLSphereNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public texture: TextureComponent,
        public color: ColorComponent
    ) {
        super(color, entity)
    }

    get emitLight(): boolean {
        return this.color.emitLight
    }
}

export class WebGLSphereRenderer extends WebGLBaseRenderer<WebGLSphereNode> {
    drawNodes(): void {
        if(!this.engine || !this.atlas || !this.gl || !this.shader || !this.viewportSystem.camera) {
            return
        }

        const { camera } = this.viewportSystem

        const showCheckerPattern = this.engine.getDebugManager().debugflags.showCheckerPattern

        for(const { node, projected } of this.getProjectedCacheEntries()) {
            const textureSource = node.texture.day
            const nightTextureSource = node.texture.night

            if(!textureSource) {
                if(showCheckerPattern) {
                    this.atlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
                }
                continue
            }

            const atlasEntry = showCheckerPattern
                ? this.atlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
                : this.atlas.getOrCreateEntry(node.entity.id, textureSource)

            let nightAtlasEntry: AtlasEntry | undefined

            if(showCheckerPattern) {
                nightAtlasEntry = this.nightAtlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
            } else if(nightTextureSource) {
                const nightKey = `${node.entity.id}_night`
                nightAtlasEntry = this.nightAtlas.getOrCreateEntry(nightKey, nightTextureSource)
            } else {
                nightAtlasEntry = this.nightAtlas.getOrCreateEntry("__black__", this.getBlackCanvas())
            }

            const roughnessSource = node.texture.roughness
            let roughnessAtlasEntry: AtlasEntry | undefined
            if(showCheckerPattern) {
                roughnessAtlasEntry = this.roughnessAtlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
            } else if(roughnessSource) {
                const roughnessKey = `${node.entity.id}_roughness`
                roughnessAtlasEntry = this.roughnessAtlas.getOrCreateEntry(roughnessKey, roughnessSource)
            } else {
                roughnessAtlasEntry = this.roughnessAtlas.getOrCreateEntry("__mid__", this.getMidGrayCanvas())
            }

            const cloudSource = node.texture.cloud
            let cloudAtlasEntry: AtlasEntry | undefined
            let cloudPage = -1
            if(showCheckerPattern) {
                cloudAtlasEntry = this.cloudAtlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
                cloudPage = cloudAtlasEntry.page
            } else if(cloudSource) {
                const cloudKey = `${node.entity.id}_cloud`
                cloudAtlasEntry = this.cloudAtlas.getOrCreateEntry(cloudKey, cloudSource)
                cloudPage = cloudAtlasEntry.page
            }

            const normalSource = node.texture.normal
            let normalAtlasEntry: AtlasEntry | undefined
            let normalPage = 0
            if(showCheckerPattern) {
                normalAtlasEntry = this.normalAtlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
                normalPage = normalAtlasEntry.page
            } else if(normalSource) {
                const normalKey = `${node.entity.id}_normal`
                normalAtlasEntry = this.normalAtlas.getOrCreateEntry(normalKey, normalSource)
                normalPage = normalAtlasEntry.page
            }

            const { worldPos } = this.getProjected(node)
            const screenRadius = node.radius.radius * projected.scale
            if(
                projected.x + screenRadius < 0 ||
                projected.x - screenRadius > camera.cssWidth ||
                projected.y + screenRadius < 0 ||
                projected.y - screenRadius > camera.cssHeight
            ) {
                continue
            }

            const starEntity = this.findStarEntityForPlanet(node.entity)

            let lightDir = vec3.fromValues(0, 1, 0)
            let starColor = vec3.fromValues(1.0, 1.0, 1.0)

            if(starEntity) {
                const lightDirRaw: vec3 = vec3.sub(vec3.create(), getAbsolute(starEntity, this.engine!), worldPos)

                const lightDirLength = vec3.length(lightDirRaw)
                lightDir = lightDirLength > 0
                    ? vec3.normalize(vec3.create(), lightDirRaw)
                    : vec3.fromValues(0, 1, 0)

                const attenuation = (SOLAR_UNIT ** 2) / (SOLAR_UNIT ** 2 + lightDirLength ** 2) * 40

                const starColorComponent = starEntity.getComponent(ColorComponent)
                if(starColorComponent?.fill) {
                    const parsed = hexToRgb(starColorComponent.fill)
                    starColor = [parsed.r / 255 * attenuation, parsed.g / 255 * attenuation, parsed.b / 255 * attenuation]
                }
            }

            const paletteRgb = hexToRgb(node.color.fill || "#808080")

            const model = mat4.create()
            mat4.identity(model)
            mat4.translate(model, model, worldPos)

            const scale = node.radius.radius

            mat4.scale(model, model, [scale, scale, scale])

            const normalMatrix = mat3.create()
            mat3.normalFromMat4(normalMatrix, model)

            const poolOffset = this.pendingInstances.length * 43
            if(poolOffset + 43 > this.sphereInstancePool!.length) {
                const newSize = Math.max(this.sphereInstancePool!.length * 2, poolOffset + 43 + this.MAX_SPHERE_INSTANCES * 43)
                const newPool = new Float32Array(newSize)
                newPool.set(this.sphereInstancePool!)
                this.sphereInstancePool = newPool
            }
            const pool = this.sphereInstancePool!
            pool.set(model, poolOffset)
            pool.set(normalMatrix, poolOffset + 16)
            pool.set(lightDir, poolOffset + 25)
            pool.set(starColor, poolOffset + 28)
            pool.set([atlasEntry.u0, atlasEntry.v0], poolOffset + 31)
            pool.set([atlasEntry.u1 - atlasEntry.u0, atlasEntry.v1 - atlasEntry.v0], poolOffset + 33)
            pool.set([nightAtlasEntry?.u0 ?? 0, nightAtlasEntry?.v0 ?? 0], poolOffset + 35)
            pool.set([nightAtlasEntry ? (nightAtlasEntry.u1 - nightAtlasEntry.u0) : 1, nightAtlasEntry ? (nightAtlasEntry.v1 - nightAtlasEntry.v0) : 1], poolOffset + 37)
            pool.set([node.color.emitLight ? 1.0 : 0.0, cloudPage, node.texture.rotation ?? 0], poolOffset + 39)
            pool.set([normalPage], poolOffset + 42)

            this.pendingInstances.push({
                page: atlasEntry.page,
                depth: projected.depth,
                offset: poolOffset,
                nightPage: nightAtlasEntry?.page ?? 0,
                roughnessPage: roughnessAtlasEntry?.page ?? 0,
                cloudPage,
                normalPage,
                paletteR: paletteRgb.r / 255,
                paletteG: paletteRgb.g / 255,
                paletteB: paletteRgb.b / 255
            })
        }

        const gl = this.gl

        this.resetGLState(gl)

        if(this.pendingInstances.length === 0) {
            return
        }

        const { fx, fy, fz } = camera.viewBasis
        const cam = camera.cameraPosition
        mat4.lookAt(this.view, cam, [cam[0] + fx, cam[1] + fy, cam[2] + fz], [0, 1, 0])

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        const groups = this.groupsMap
        groups.clear()
        for(const inst of this.pendingInstances) {
            const key = `${inst.page}:${inst.nightPage}:${inst.roughnessPage}:${inst.cloudPage}:${inst.normalPage}`
            let group = groups.get(key)
            if(!group) {
                group = []
                groups.set(key, group)
            }
            group.push({ depth: inst.depth, offset: inst.offset, nightPage: inst.nightPage, roughnessPage: inst.roughnessPage, cloudPage: inst.cloudPage, normalPage: inst.normalPage, paletteR: inst.paletteR, paletteG: inst.paletteG, paletteB: inst.paletteB })
        }

        const sortedGroups = sortGroupsByDepth(this.groupsMap)

        if(!this.shader) return

        this.renderPass(gl, this.shader, this.hdrFramebuffer, gl.canvas.width, gl.canvas.height, sortedGroups, camera)
        if(this._showBloom) {
            this.renderGpuBloom(gl, camera, sortedGroups)
        }
    }
    protected getCullMargin(node: WebGLSphereNode): number {
        return node.radius.radius
    }
    protected shouldCullNode(_node: WebGLSphereNode, _projected: ProjectedPoint, _worldPos: vec3): boolean {
        return false
    }
    protected shouldSkipProjection(_node: WebGLSphereNode, _cameraDistance: number, _cameraScale: number): boolean {
        return false
    }
    private shader: ShaderProgram | null = null
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private sphereIndexType = 0
    private atlas!: WebGLTextureAtlas
    private nightAtlas!: WebGLTextureAtlas
    private roughnessAtlas!: WebGLTextureAtlas
    private cloudAtlas!: WebGLTextureAtlas
    private normalAtlas!: WebGLTextureAtlas
    private readonly MAX_SPHERE_INSTANCES = 256
    private sphereInstancePool: Float32Array | null = null
    private sphereBatchBuffer: Float32Array | null = null
    private pendingInstances: Array<{ page: number; depth: number; offset: number; nightPage: number; roughnessPage: number; cloudPage: number; normalPage: number; paletteR: number; paletteG: number; paletteB: number }> = []
    private groupsMap = new Map<string, Array<{ depth: number; offset: number; nightPage: number; roughnessPage: number; cloudPage: number; normalPage: number; paletteR: number; paletteG: number; paletteB: number }>>()
    private _blackCanvas: HTMLCanvasElement | undefined
    private _midGrayCanvas: HTMLCanvasElement | undefined
    private _lastShowCheckerPattern = false
    private bloomFramebuffer: WebGLFramebuffer | null = null
    private bloomTexture: WebGLTexture | null = null
    private bloomShader: ShaderProgram | null = null
    private bloomWidth = 0
    private bloomHeight = 0
    private blurFramebufferA: WebGLFramebuffer | null = null
    private blurTextureA: WebGLTexture | null = null
    private blurFramebufferB: WebGLFramebuffer | null = null
    private blurTextureB: WebGLTexture | null = null
    private blurShader: ShaderProgram<any, any> | null = null
    private quadVao: WebGLBuffer | null = null
    private quadIndexBuffer: WebGLBuffer | null = null
    private quadIndexCount = 0
    private _showBloom = false
    private hdrEnabled = false
    private hdrFramebuffer: WebGLFramebuffer | null = null

    private static readonly MAX_BLOOM_DIMENSION = 1024

    setShowBloom(value: boolean) {
        this._showBloom = value
    }

    setHdr(enabled: boolean) {
        this.hdrEnabled = enabled
    }

    setHdrFramebuffer(framebuffer: WebGLFramebuffer | null) {
        this.hdrFramebuffer = framebuffer
    }

    private createBloomFramebuffer(gl: WebGL2RenderingContext): void {
        if(this.bloomFramebuffer) {
            gl.deleteFramebuffer(this.bloomFramebuffer)
            this.bloomFramebuffer = null
        }
        if(this.bloomTexture) {
            gl.deleteTexture(this.bloomTexture)
            this.bloomTexture = null
        }

        const width = Math.min(
            WebGLSphereRenderer.MAX_BLOOM_DIMENSION,
            Math.max(1, Math.floor(gl.canvas.width / 2))
        )
        const height = Math.min(
            WebGLSphereRenderer.MAX_BLOOM_DIMENSION,
            Math.max(1, Math.floor(gl.canvas.height / 2))
        )
        this.bloomWidth = width
        this.bloomHeight = height

        this.bloomFramebuffer = gl.createFramebuffer()
        this.bloomTexture = gl.createTexture()

        gl.bindTexture(gl.TEXTURE_2D, this.bloomTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFramebuffer)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bloomTexture, 0)

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
        if(status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Bloom framebuffer incomplete: ${status}`)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    private renderPass(
        gl: WebGL2RenderingContext,
        shader: ShaderProgram,
        targetFramebuffer: WebGLFramebuffer | null,
        width: number,
        height: number,
        sortedGroups: Array<[string, Array<{ depth: number; offset: number; nightPage: number; roughnessPage: number; cloudPage: number; normalPage: number; paletteR: number; paletteG: number; paletteB: number }>]>,
        camera: Camera
    ): void {
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer)
        if(targetFramebuffer) {
            gl.viewport(0, 0, width, height)
        } else {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        }

        gl.useProgram(shader.program)

        gl.uniformMatrix4fv(shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.projection)
        gl.uniform3f(shader.uniforms.ambientColor, 0.15, 0.15, 0.2)

        const [camX, camY, camZ] = camera.cameraPosition
        gl.uniform3f(shader.uniforms.cameraPosition, camX, camY, camZ)
        gl.uniform3f(shader.uniforms.tintColor, 1, 1, 1)
        gl.uniform1f(shader.uniforms.tintAlpha, 0)
        gl.uniform1f(shader.uniforms.time, performance.now() / 1000.0)
        gl.uniform1f(shader.uniforms.bloomBrightness, this.engine?.getDebugManager()?.bloomSettings?.brightness ?? 1.0)
        gl.uniform1f(shader.uniforms.bloomThreshold, this.engine?.getDebugManager()?.bloomSettings?.threshold ?? 0.2)
        gl.uniform1f(shader.uniforms.hdrMode, this.hdrEnabled ? 1.0 : 0.0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 6 * 4
        gl.enableVertexAttribArray(shader.attribs.position)
        gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(shader.attribs.normal)
        gl.vertexAttribPointer(shader.attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        if(!this.instanceBuffer) {
            this.instanceBuffer = gl.createBuffer()
        }

        const instanceStride = 43 * 4

        let lastDayPage = -1
        let lastNightPage = -1
        let lastRoughnessPage = -1
        let lastCloudPage = -1
        let lastNormalPage = -1

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.CULL_FACE)
        gl.cullFace(gl.BACK)

        const modelLoc = shader.attribs.instanceModel
        const normalMatrixLoc = shader.attribs.instanceNormalMatrix

        for(const [key, instances] of sortedGroups) {
            instances.sort((a, b) => b.depth - a.depth)

            const [dayPage, nightPage, roughnessPage, cloudPage, normalPage] = key.split(':').map(Number)
            const totalFloats = instances.length * 43
            if(!this.sphereBatchBuffer || this.sphereBatchBuffer.length < totalFloats) {
                const newSize = Math.max(totalFloats, this.MAX_SPHERE_INSTANCES * 43)
                this.sphereBatchBuffer = new Float32Array(newSize)
            }
            const batch = this.sphereBatchBuffer!.subarray(0, totalFloats)
            for(let i = 0; i < instances.length; i++) {
                batch.set(this.sphereInstancePool!.subarray(instances[i].offset, instances[i].offset + 43), i * 43)
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, batch, gl.DYNAMIC_DRAW)

            const setupAttrib = (loc: number, size: number, offset: number) => {
                if(loc < 0) return
                gl.enableVertexAttribArray(loc)
                gl.vertexAttribPointer(loc, size, gl.FLOAT, false, instanceStride, offset)
                gl.vertexAttribDivisor(loc, 1)
            }

            setupAttrib(modelLoc, 4, 0)
            setupAttrib(modelLoc + 1, 4, 16)
            setupAttrib(modelLoc + 2, 4, 32)
            setupAttrib(modelLoc + 3, 4, 48)
            setupAttrib(normalMatrixLoc, 3, 16 * 4)
            setupAttrib(normalMatrixLoc + 1, 3, 19 * 4)
            setupAttrib(normalMatrixLoc + 2, 3, 22 * 4)
            setupAttrib(shader.attribs.instanceLightDir, 3, 25 * 4)
            setupAttrib(shader.attribs.instanceLightColor, 3, 28 * 4)
            setupAttrib(shader.attribs.instanceTexOffset, 2, 31 * 4)
            setupAttrib(shader.attribs.instanceTexScale, 2, 33 * 4)
            setupAttrib(shader.attribs.instanceNightTexOffset, 2, 35 * 4)
            setupAttrib(shader.attribs.instanceNightTexScale, 2, 37 * 4)
            setupAttrib(shader.attribs.instanceEmissiveCloud, 3, 39 * 4)

            if(dayPage !== lastDayPage) {
                const atlasTexture = this.atlas.getTextures(gl)[dayPage]
                gl.activeTexture(gl.TEXTURE0)
                gl.bindTexture(gl.TEXTURE_2D, atlasTexture)
                gl.uniform1i(shader.uniforms.texture, 0)
                lastDayPage = dayPage
            }

            if(nightPage !== lastNightPage) {
                const nightAtlasTextures = this.nightAtlas.getTextures(gl)
                const nightPageTexture = nightAtlasTextures[nightPage] ?? nightAtlasTextures[0]
                gl.activeTexture(gl.TEXTURE1)
                gl.bindTexture(gl.TEXTURE_2D, nightPageTexture)
                gl.uniform1i(shader.uniforms.nightTexture, 1)
                lastNightPage = nightPage
            }

            if(roughnessPage !== lastRoughnessPage) {
                const roughnessAtlasTextures = this.roughnessAtlas.getTextures(gl)
                const roughnessPageTexture = roughnessAtlasTextures[roughnessPage] ?? roughnessAtlasTextures[0]
                gl.activeTexture(gl.TEXTURE2)
                gl.bindTexture(gl.TEXTURE_2D, roughnessPageTexture)
                gl.uniform1i(shader.uniforms.roughness, 2)
                lastRoughnessPage = roughnessPage
            }

            if(cloudPage !== lastCloudPage) {
                const cloudAtlasTextures = this.cloudAtlas.getTextures(gl)
                const cloudPageTexture = cloudAtlasTextures[cloudPage] ?? cloudAtlasTextures[0]
                gl.activeTexture(gl.TEXTURE3)
                gl.bindTexture(gl.TEXTURE_2D, cloudPageTexture)
                gl.uniform1i(shader.uniforms.cloudTexture, 3)
                lastCloudPage = cloudPage
            }

            if(normalPage !== lastNormalPage) {
                const normalAtlasTextures = this.normalAtlas.getTextures(gl)
                const normalPageTexture = normalAtlasTextures[normalPage] ?? normalAtlasTextures[0]
                gl.activeTexture(gl.TEXTURE4)
                gl.bindTexture(gl.TEXTURE_2D, normalPageTexture)
                gl.uniform1i(shader.uniforms.normalMap, 4)
                lastNormalPage = normalPage
            }

            gl.drawElementsInstanced(gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0, instances.length)
        }

        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.CULL_FACE)

        gl.disableVertexAttribArray(modelLoc)
        gl.disableVertexAttribArray(modelLoc + 1)
        gl.disableVertexAttribArray(modelLoc + 2)
        gl.disableVertexAttribArray(modelLoc + 3)
        gl.disableVertexAttribArray(normalMatrixLoc)
        gl.disableVertexAttribArray(normalMatrixLoc + 1)
        gl.disableVertexAttribArray(normalMatrixLoc + 2)
        gl.disableVertexAttribArray(shader.attribs.instanceLightDir)
        gl.disableVertexAttribArray(shader.attribs.instanceTexOffset)
        gl.disableVertexAttribArray(shader.attribs.instanceTexScale)
        gl.disableVertexAttribArray(shader.attribs.instanceNightTexOffset)
        gl.disableVertexAttribArray(shader.attribs.instanceNightTexScale)
        gl.disableVertexAttribArray(shader.attribs.position)
        gl.disableVertexAttribArray(shader.attribs.normal)

        const resetDivisor = (loc: number) => {
            if(loc >= 0) gl.vertexAttribDivisor(loc, 0)
        }

        resetDivisor(modelLoc)
        resetDivisor(modelLoc + 1)
        resetDivisor(modelLoc + 2)
        resetDivisor(modelLoc + 3)
        resetDivisor(normalMatrixLoc)
        resetDivisor(normalMatrixLoc + 1)
        resetDivisor(normalMatrixLoc + 2)
        resetDivisor(shader.attribs.instanceLightDir)
        resetDivisor(shader.attribs.instanceLightColor)
        resetDivisor(shader.attribs.instanceTexOffset)
        resetDivisor(shader.attribs.instanceTexScale)
        resetDivisor(shader.attribs.instanceNightTexOffset)
        resetDivisor(shader.attribs.instanceNightTexScale)
        resetDivisor(shader.attribs.instanceEmissiveCloud)
    }

    private renderGpuBloom(
        gl: WebGL2RenderingContext,
        camera: Camera,
        sortedGroups: Array<[string, Array<{ depth: number; offset: number; nightPage: number; roughnessPage: number; cloudPage: number; normalPage: number; paletteR: number; paletteG: number; paletteB: number }>]>
    ): void {
        if(!this.bloomFramebuffer || !this.bloomShader || !this.blurFramebufferA || !this.blurFramebufferB || !this.blurShader || !this.bloomTexture || !this.blurTextureA || !this.blurTextureB) {
            return
        }

        const settings = this.engine?.getDebugManager()?.bloomSettings ?? { brightness: 1.2, contrast: 2, iterations: 3, alpha: 0.9 }
        const passes = Math.max(1, Math.round(settings.iterations))
        const intensity = settings.alpha

        const bw = Math.min(WebGLSphereRenderer.MAX_BLOOM_DIMENSION, Math.max(1, Math.floor(gl.canvas.width / 2)))
        const bh = Math.min(WebGLSphereRenderer.MAX_BLOOM_DIMENSION, Math.max(1, Math.floor(gl.canvas.height / 2)))
        if(bw !== this.bloomWidth || bh !== this.bloomHeight) {
            this.createBloomFramebuffer(gl)
            this.createBlurFramebuffers(gl)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFramebuffer)
        gl.viewport(0, 0, this.bloomWidth, this.bloomHeight)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        this.renderPass(gl, this.bloomShader, this.bloomFramebuffer, this.bloomWidth, this.bloomHeight, sortedGroups, camera)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

        let readTexture = this.bloomTexture
        for(let i = 0; i < passes; i++) {
            this.renderBlurPass(gl, readTexture, this.blurFramebufferA, [1.0 / this.bloomWidth, 0.0], this.bloomWidth, this.bloomHeight, intensity)
            this.renderBlurPass(gl, this.blurTextureA, this.blurFramebufferB, [0.0, 1.0 / this.bloomHeight], this.bloomWidth, this.bloomHeight, intensity)
            readTexture = this.blurTextureB
        }

        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFramebuffer ?? null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        if(this.blurShader && this.quadVao && this.quadIndexBuffer) {
            gl.useProgram(this.blurShader.program)
            gl.uniform2f(this.blurShader.uniforms.direction, 0.0, 0.0)
            gl.uniform1f(this.blurShader.uniforms.intensity, intensity)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, readTexture)
            gl.uniform1i(this.blurShader.uniforms.texture, 0)
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVao)
            gl.enableVertexAttribArray(this.blurShader.attribs.position)
            gl.vertexAttribPointer(this.blurShader.attribs.position, 2, gl.FLOAT, false, 16, 0)
            gl.enableVertexAttribArray(this.blurShader.attribs.texCoord)
            gl.vertexAttribPointer(this.blurShader.attribs.texCoord, 2, gl.FLOAT, false, 16, 8)
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)
            gl.drawElements(gl.TRIANGLES, this.quadIndexCount, gl.UNSIGNED_SHORT, 0)
            gl.disableVertexAttribArray(this.blurShader.attribs.position)
            gl.disableVertexAttribArray(this.blurShader.attribs.texCoord)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.disable(gl.BLEND)
    }

    private createBlurFramebuffers(gl: WebGL2RenderingContext): void {
        if(this.blurFramebufferA) {
            gl.deleteFramebuffer(this.blurFramebufferA)
            this.blurFramebufferA = null
        }
        if(this.blurTextureA) {
            gl.deleteTexture(this.blurTextureA)
            this.blurTextureA = null
        }
        if(this.blurFramebufferB) {
            gl.deleteFramebuffer(this.blurFramebufferB)
            this.blurFramebufferB = null
        }
        if(this.blurTextureB) {
            gl.deleteTexture(this.blurTextureB)
            this.blurTextureB = null
        }

        const width = this.bloomWidth
        const height = this.bloomHeight

        this.blurFramebufferA = gl.createFramebuffer()
        this.blurTextureA = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.blurTextureA)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebufferA)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTextureA, 0)

        this.blurFramebufferB = gl.createFramebuffer()
        this.blurTextureB = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.blurTextureB)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebufferB)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTextureB, 0)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    private initQuadBuffer(gl: WebGL2RenderingContext): void {
        const vertices = new Float32Array([
            -1, -1, 0, 0,
            1, -1, 1, 0,
            -1, 1, 0, 1,
            1, 1, 1, 1,
        ])
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3])

        this.quadVao = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVao)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        this.quadIndexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

        this.quadIndexCount = indices.length
    }

    private renderBlurPass(
        gl: WebGL2RenderingContext,
        sourceTexture: WebGLTexture,
        targetFbo: WebGLFramebuffer | null,
        direction: [number, number],
        width: number,
        height: number,
        intensity: number
    ): void {
        if(!this.blurShader || !this.quadVao || !this.quadIndexBuffer) {
            return
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo)
        if(targetFbo) {
            gl.viewport(0, 0, width, height)
        } else {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        }

        gl.useProgram(this.blurShader.program)
        gl.uniform2f(this.blurShader.uniforms.direction, direction[0], direction[1])
        gl.uniform1f(this.blurShader.uniforms.intensity, intensity)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
        gl.uniform1i(this.blurShader.uniforms.texture, 0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVao)
        gl.enableVertexAttribArray(this.blurShader.attribs.position)
        gl.vertexAttribPointer(this.blurShader.attribs.position, 2, gl.FLOAT, false, 16, 0)
        gl.enableVertexAttribArray(this.blurShader.attribs.texCoord)
        gl.vertexAttribPointer(this.blurShader.attribs.texCoord, 2, gl.FLOAT, false, 16, 8)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer)
        gl.drawElements(gl.TRIANGLES, this.quadIndexCount, gl.UNSIGNED_SHORT, 0)

        gl.disableVertexAttribArray(this.blurShader.attribs.position)
        gl.disableVertexAttribArray(this.blurShader.attribs.texCoord)
    }

    beginFrame(): void {
        this.pendingInstances.length = 0
        this.groupsMap.clear()

        const showCheckerPattern = this.engine?.getDebugManager().debugflags.showCheckerPattern
        if(showCheckerPattern !== undefined && showCheckerPattern !== this._lastShowCheckerPattern) {
            this._lastShowCheckerPattern = showCheckerPattern

            const gl = this.gl
            if(gl) {
                this.atlas?.dispose(gl)
                this.nightAtlas?.dispose(gl)
                this.roughnessAtlas?.dispose(gl)
                this.cloudAtlas?.dispose(gl)
                this.normalAtlas?.dispose(gl)
            }

            this.atlas = new WebGLTextureAtlas()
            this.nightAtlas = new WebGLTextureAtlas()
            this.roughnessAtlas = new WebGLTextureAtlas()
            this.cloudAtlas = new WebGLTextureAtlas()
            this.normalAtlas = new WebGLTextureAtlas()
            const whiteCanvas = getPlatform().createCanvas()
            whiteCanvas.width = 1
            whiteCanvas.height = 1
            const whiteCtx = whiteCanvas.getContext("2d")!
            whiteCtx.fillStyle = "#ffffff"
            whiteCtx.fillRect(0, 0, 1, 1)
            this.nightAtlas.addTexture("__white__", whiteCanvas)
            this.nightAtlas.addTexture("__black__", this.getBlackCanvas())
            const midGray = getPlatform().createCanvas()
            midGray.width = 1
            midGray.height = 1
            const midCtx = midGray.getContext("2d")!
            midCtx.fillStyle = "#808080"
            midCtx.fillRect(0, 0, 1, 1)
            this.roughnessAtlas.addTexture("__mid__", midGray)
            const flatNormal = getPlatform().createCanvas()
            flatNormal.width = 1
            flatNormal.height = 1
            const flatCtx = flatNormal.getContext("2d")!
            flatCtx.fillStyle = "#8080ff"
            flatCtx.fillRect(0, 0, 1, 1)
            this.normalAtlas.addTexture("__flat__", flatNormal)
        }
    }

    init() {
        if(!this.engine) {
            throw new Error("WebGL not available")
        }

        this.initCanvases()
        const gl = this.initContext()

        this.shader = createShaderProgram(gl)
        this.bloomShader = createBloomShaderProgram(gl)
        this.blurShader = createBlurShaderProgram(gl)

        this.createBloomFramebuffer(gl)
        this.createBlurFramebuffers(gl)
        this.initQuadBuffer(gl)

        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = this.glCanvas.width
        this.glCanvas.height = this.glCanvas.height
        this.glCanvas.style.pointerEvents = "none"
        this.atlas = new WebGLTextureAtlas()
        this.nightAtlas = new WebGLTextureAtlas()
        this.roughnessAtlas = new WebGLTextureAtlas()
        this.cloudAtlas = new WebGLTextureAtlas()
        this.normalAtlas = new WebGLTextureAtlas()

        const whiteCanvas = document.createElement("canvas")
        whiteCanvas.width = 1
        whiteCanvas.height = 1
        const whiteCtx = whiteCanvas.getContext("2d")!
        whiteCtx.fillStyle = "#ffffff"
        whiteCtx.fillRect(0, 0, 1, 1)
        this.nightAtlas.addTexture("__white__", whiteCanvas)
        this.nightAtlas.addTexture("__black__", this.getBlackCanvas())
        const midGray = document.createElement("canvas")
        midGray.width = 1
        midGray.height = 1
        const midCtx = midGray.getContext("2d")!
        midCtx.fillStyle = "#808080"
        midCtx.fillRect(0, 0, 1, 1)
        this.roughnessAtlas.addTexture("__mid__", midGray)
        const flatNormal = document.createElement("canvas")
        flatNormal.width = 1
        flatNormal.height = 1
        const flatCtx = flatNormal.getContext("2d")!
        flatCtx.fillStyle = "#8080ff"
        flatCtx.fillRect(0, 0, 1, 1)
        this.normalAtlas.addTexture("__flat__", flatNormal)

        this.initBuffers()

        this.sphereInstancePool = new Float32Array(this.MAX_SPHERE_INSTANCES * 43)
        this.sphereBatchBuffer = new Float32Array(this.MAX_SPHERE_INSTANCES * 43)

        gl.clearColor(0, 0, 0, 0)
    }

    private initBuffers() {
        if(!this.gl) {
            return
        }

        const { indices, normals, positions } = createSphereMesh(5)

        const vertexCount = positions.length / 3
        const interleaved = new Float32Array(vertexCount * 6)
        for(let i = 0; i < vertexCount; i++) {
            const base = i * 6
            const posBase = i * 3

            interleaved[base + 0] = positions[posBase + 0]
            interleaved[base + 1] = positions[posBase + 1]
            interleaved[base + 2] = positions[posBase + 2]
            interleaved[base + 3] = normals[posBase + 0]
            interleaved[base + 4] = normals[posBase + 1]
            interleaved[base + 5] = normals[posBase + 2]
        }

        this.sphereVao = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereVao)
        this.gl.bufferData(this.gl.ARRAY_BUFFER, interleaved, this.gl.STATIC_DRAW)

        this.sphereIndexBuffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW)
        this.sphereIndexCount = indices.length
        this.sphereIndexType = indices instanceof Uint32Array ? this.gl.UNSIGNED_INT : this.gl.UNSIGNED_SHORT
    }

    constructor(viewport: ViewportSystem) {
        super(
            viewport,
            [
                PositionComponent, RadiusComponent, TextureComponent
            ],
            (entity) => {
                const pos = entity.getComponent(PositionComponent)!
                const radius = entity.getComponent(RadiusComponent)!
                const texture = entity.getComponent(TextureComponent)!
                const color = entity.getComponent(ColorComponent)!

                return new WebGLSphereNode(entity, pos, radius, texture, color)
            })
    }

    private getMidGrayCanvas(): HTMLCanvasElement {
        if(!this._midGrayCanvas) {
            const canvas = getPlatform().createCanvas()
            canvas.width = 1
            canvas.height = 1
            const ctx = canvas.getContext("2d")!
            ctx.fillStyle = "#808080"
            ctx.fillRect(0, 0, 1, 1)
            this._midGrayCanvas = canvas
        }
        return this._midGrayCanvas
    }

    private getBlackCanvas(): HTMLCanvasElement {
        if(!this._blackCanvas) {
            const canvas = getPlatform().createCanvas()
            canvas.width = 1
            canvas.height = 1
            const ctx = canvas.getContext("2d")!
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, 1, 1)
            this._blackCanvas = canvas
        }
        return this._blackCanvas
    }

    private view = mat4.create()
    private projection = mat4.create()

    removeFromEngine(): this {
        if(this.gl) {
            if(this.sphereVao) this.gl.deleteBuffer(this.sphereVao)
            if(this.sphereIndexBuffer) this.gl.deleteBuffer(this.sphereIndexBuffer)
            if(this.bloomFramebuffer) this.gl.deleteFramebuffer(this.bloomFramebuffer)
            if(this.bloomTexture) this.gl.deleteTexture(this.bloomTexture)
            if(this.blurFramebufferA) this.gl.deleteFramebuffer(this.blurFramebufferA)
            if(this.blurTextureA) this.gl.deleteTexture(this.blurTextureA)
            if(this.blurFramebufferB) this.gl.deleteFramebuffer(this.blurFramebufferB)
            if(this.blurTextureB) this.gl.deleteTexture(this.blurTextureB)
            if(this.quadVao) this.gl.deleteBuffer(this.quadVao)
            if(this.quadIndexBuffer) this.gl.deleteBuffer(this.quadIndexBuffer)
        }
        return super.removeFromEngine()
    }
}
