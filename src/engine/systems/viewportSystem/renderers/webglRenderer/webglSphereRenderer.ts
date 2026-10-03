import { createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram } from "./webglShaders"
import type { ShaderProgram } from "./ShaderProgram"
import { mat4 } from "@/engine/lib/mat4"
import type { Vec3 } from "@/engine/lib/vec3"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { WebGLBaseRenderer, sortGroupsByDepth } from "./webglBaseRenderer"
import { AtlasEntry, WebGLTextureAtlas, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { getPlatform } from "@/engine/lib/platform"
import { Entity } from "@/engine/entities/entity"
import { ViewportSystem } from "../../viewportSystem"
import { RenderableNode } from "../renderableNode"
import { ProjectedPoint } from "@/lib/camera"
import { Vector3 } from "@/lib/Vector3"

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
        if(!this.engine || !this.atlas || !this.gl || !this.shader) {
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
                const midGray = getPlatform().createCanvas()
                midGray.width = 1
                midGray.height = 1
                const midCtx = midGray.getContext("2d")!
                midCtx.fillStyle = "#808080"
                midCtx.fillRect(0, 0, 1, 1)
                roughnessAtlasEntry = this.roughnessAtlas.getOrCreateEntry("__mid__", midGray)
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

            let lightDir: Vec3

            if(starEntity) {
                const starPos = this.getWorldPosition2(starEntity)
                const lightDirRaw: Vec3 = [
                    starPos[0] - worldPos[0],
                    starPos[1] - worldPos[1],
                    starPos[2] - worldPos[2],
                ]
                const lightDirLength = Math.hypot(lightDirRaw[0], lightDirRaw[1], lightDirRaw[2])
                lightDir = lightDirLength > 0
                    ? [lightDirRaw[0] / lightDirLength, lightDirRaw[1] / lightDirLength, lightDirRaw[2] / lightDirLength]
                    : [0, 0, 1]
            } else {
                lightDir = [0, 0, 1]
            }

            const paletteRgb = hexToRgb(node.color.fill || "#808080")

            const model = mat4.create()
            mat4.identity(model)
            mat4.translate(model, model, [worldPos[0], worldPos[1], worldPos[2]])
            const scale = node.radius.radius
            mat4.scale(model, model, [scale, scale, scale])

            const normalMatrix = new Float32Array(9)
            normalMatrix[0] = model[0]
            normalMatrix[1] = model[1]
            normalMatrix[2] = model[2]
            normalMatrix[3] = model[4]
            normalMatrix[4] = model[5]
            normalMatrix[5] = model[6]
            normalMatrix[6] = model[8]
            normalMatrix[7] = model[9]
            normalMatrix[8] = model[10]

            const poolOffset = this.pendingInstances.length * 39
            if(poolOffset + 39 > this.sphereInstancePool!.length) {
                const newSize = Math.max(this.sphereInstancePool!.length * 2, poolOffset + 39 + this.MAX_SPHERE_INSTANCES * 39)
                const newPool = new Float32Array(newSize)
                newPool.set(this.sphereInstancePool!)
                this.sphereInstancePool = newPool
            }
            const pool = this.sphereInstancePool!
            pool.set(model, poolOffset)
            pool.set(normalMatrix, poolOffset + 16)
            pool.set(lightDir, poolOffset + 25)
            pool.set([atlasEntry.u0, atlasEntry.v0], poolOffset + 28)
            pool.set([atlasEntry.u1 - atlasEntry.u0, atlasEntry.v1 - atlasEntry.v0], poolOffset + 30)
            pool.set([nightAtlasEntry?.u0 ?? 0, nightAtlasEntry?.v0 ?? 0], poolOffset + 32)
            pool.set([nightAtlasEntry ? (nightAtlasEntry.u1 - nightAtlasEntry.u0) : 1, nightAtlasEntry ? (nightAtlasEntry.v1 - nightAtlasEntry.v0) : 1], poolOffset + 34)
            pool.set([node.color.emitLight ? 1.0 : 0.0], poolOffset + 36)
            pool.set([cloudPage], poolOffset + 37)
            pool.set([normalPage], poolOffset + 38)

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

        const gl = this.gl!

        this.resetGLState(gl)

        if(this.pendingInstances.length === 0) {
            return
        }

        const { fx, fy, fz } = camera.viewBasis
        const [camX, camY, camZ] = camera.cameraPosition
        mat4.lookAt(this.view, [camX, camY, camZ], [camX + fx, camY + fy, camZ + fz], [0, 0, 1])

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)
        //this.projection[5] *= -1

        gl.useProgram(this.shader.program)

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniform3f(this.shader.uniforms.lightColor, 2.0, 1.8, 1.5)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.02, 0.02, 0.04)

        gl.uniform3f(this.shader.uniforms.cameraPosition, camX, camY, camZ)
        gl.uniform3f(this.shader.uniforms.tintColor, 1, 1, 1)
        gl.uniform1f(this.shader.uniforms.tintAlpha, 0)
        gl.uniform1f(this.shader.uniforms.time, performance.now() / 1000.0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 6 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 3, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.normal)
        gl.vertexAttribPointer(this.shader.attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        if(!this.instanceBuffer) {
            this.instanceBuffer = gl.createBuffer()
        }

        const instanceStride = 38 * 4

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

        const modelLoc = this.shader.attribs.instanceModel
        const normalMatrixLoc = this.shader.attribs.instanceNormalMatrix

        for(const [key, instances] of sortedGroups) {
            instances.sort((a, b) => b.depth - a.depth)

            const [dayPage, nightPage, roughnessPage, cloudPage, normalPage] = key.split(':').map(Number)
            const totalFloats = instances.length * 38
            if(!this.sphereBatchBuffer || this.sphereBatchBuffer.length < totalFloats) {
                const newSize = Math.max(totalFloats, this.MAX_SPHERE_INSTANCES * 38)
                this.sphereBatchBuffer = new Float32Array(newSize)
            }
            const batch = this.sphereBatchBuffer!.subarray(0, totalFloats)
            for(let i = 0; i < instances.length; i++) {
                batch.set(this.sphereInstancePool!.subarray(instances[i].offset, instances[i].offset + 38), i * 38)
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, batch, gl.DYNAMIC_DRAW)

            gl.enableVertexAttribArray(modelLoc)
            gl.vertexAttribPointer(modelLoc, 4, gl.FLOAT, false, instanceStride, 0)
            gl.vertexAttribDivisor(modelLoc, 1)
            gl.enableVertexAttribArray(modelLoc + 1)
            gl.vertexAttribPointer(modelLoc + 1, 4, gl.FLOAT, false, instanceStride, 16)
            gl.vertexAttribDivisor(modelLoc + 1, 1)
            gl.enableVertexAttribArray(modelLoc + 2)
            gl.vertexAttribPointer(modelLoc + 2, 4, gl.FLOAT, false, instanceStride, 32)
            gl.vertexAttribDivisor(modelLoc + 2, 1)
            gl.enableVertexAttribArray(modelLoc + 3)
            gl.vertexAttribPointer(modelLoc + 3, 4, gl.FLOAT, false, instanceStride, 48)
            gl.vertexAttribDivisor(modelLoc + 3, 1)
            gl.enableVertexAttribArray(normalMatrixLoc)
            gl.vertexAttribPointer(normalMatrixLoc, 3, gl.FLOAT, false, instanceStride, 16 * 4)
            gl.vertexAttribDivisor(normalMatrixLoc, 1)
            gl.enableVertexAttribArray(normalMatrixLoc + 1)
            gl.vertexAttribPointer(normalMatrixLoc + 1, 3, gl.FLOAT, false, instanceStride, 19 * 4)
            gl.vertexAttribDivisor(normalMatrixLoc + 1, 1)
            gl.enableVertexAttribArray(normalMatrixLoc + 2)
            gl.vertexAttribPointer(normalMatrixLoc + 2, 3, gl.FLOAT, false, instanceStride, 22 * 4)
            gl.vertexAttribDivisor(normalMatrixLoc + 2, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceLightDir)
            gl.vertexAttribPointer(this.shader.attribs.instanceLightDir, 3, gl.FLOAT, false, instanceStride, 25 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceLightDir, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceTexOffset)
            gl.vertexAttribPointer(this.shader.attribs.instanceTexOffset, 2, gl.FLOAT, false, instanceStride, 28 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceTexOffset, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceTexScale)
            gl.vertexAttribPointer(this.shader.attribs.instanceTexScale, 2, gl.FLOAT, false, instanceStride, 30 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceTexScale, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceNightTexOffset)
            gl.vertexAttribPointer(this.shader.attribs.instanceNightTexOffset, 2, gl.FLOAT, false, instanceStride, 32 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceNightTexOffset, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceNightTexScale)
            gl.vertexAttribPointer(this.shader.attribs.instanceNightTexScale, 2, gl.FLOAT, false, instanceStride, 34 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceNightTexScale, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceEmissive)
            gl.vertexAttribPointer(this.shader.attribs.instanceEmissive, 1, gl.FLOAT, false, instanceStride, 36 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceEmissive, 1)
            gl.enableVertexAttribArray(this.shader.attribs.instanceCloudPage)
            gl.vertexAttribPointer(this.shader.attribs.instanceCloudPage, 1, gl.FLOAT, false, instanceStride, 37 * 4)
            gl.vertexAttribDivisor(this.shader.attribs.instanceCloudPage, 1)

            const atlasTexture = this.atlas.getTextures(gl)[dayPage]
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, atlasTexture)
            gl.uniform1i(this.shader.uniforms.texture, 0)

            const nightAtlasTextures = this.nightAtlas.getTextures(gl)
            const nightPageTexture = nightAtlasTextures[nightPage] ?? nightAtlasTextures[0]
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, nightPageTexture)
            gl.uniform1i(this.shader.uniforms.nightTexture, 1)

            const roughnessAtlasTextures = this.roughnessAtlas.getTextures(gl)
            const roughnessPageTexture = roughnessAtlasTextures[roughnessPage] ?? roughnessAtlasTextures[0]
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, roughnessPageTexture)
            gl.uniform1i(this.shader.uniforms.roughness, 2)

            const cloudAtlasTextures = this.cloudAtlas.getTextures(gl)
            const cloudPageTexture = cloudAtlasTextures[cloudPage] ?? cloudAtlasTextures[0]
            gl.activeTexture(gl.TEXTURE3)
            gl.bindTexture(gl.TEXTURE_2D, cloudPageTexture)
            gl.uniform1i(this.shader.uniforms.cloudTexture, 3)

            const normalAtlasTextures = this.normalAtlas.getTextures(gl)
            const normalPageTexture = normalAtlasTextures[normalPage] ?? normalAtlasTextures[0]
            gl.activeTexture(gl.TEXTURE4)
            gl.bindTexture(gl.TEXTURE_2D, normalPageTexture)
            gl.uniform1i(this.shader.uniforms.normalMap, 4)

            const first = instances[0]
            gl.uniform3f(this.shader.uniforms.paletteColor, first.paletteR, first.paletteG, first.paletteB)

            gl.enable(gl.DEPTH_TEST)
            gl.enable(gl.CULL_FACE)
            gl.cullFace(gl.BACK)
            gl.drawElementsInstanced(gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0, instances.length)
        }

        //reset state
        gl.disableVertexAttribArray(modelLoc)
        gl.disableVertexAttribArray(modelLoc + 1)
        gl.disableVertexAttribArray(modelLoc + 2)
        gl.disableVertexAttribArray(modelLoc + 3)
        gl.disableVertexAttribArray(normalMatrixLoc)
        gl.disableVertexAttribArray(normalMatrixLoc + 1)
        gl.disableVertexAttribArray(normalMatrixLoc + 2)
        gl.disableVertexAttribArray(this.shader.attribs.instanceLightDir)
        gl.disableVertexAttribArray(this.shader.attribs.instanceTexOffset)
        gl.disableVertexAttribArray(this.shader.attribs.instanceTexScale)
        gl.disableVertexAttribArray(this.shader.attribs.instanceNightTexOffset)
        gl.disableVertexAttribArray(this.shader.attribs.instanceNightTexScale)
        gl.disableVertexAttribArray(this.shader.attribs.instanceEmissive)
        gl.disableVertexAttribArray(this.shader.attribs.instanceCloudPage)
        gl.disableVertexAttribArray(this.shader.attribs.position)
        gl.disableVertexAttribArray(this.shader.attribs.normal)
        gl.vertexAttribDivisor(modelLoc, 0)
        gl.vertexAttribDivisor(modelLoc + 1, 0)
        gl.vertexAttribDivisor(modelLoc + 2, 0)
        gl.vertexAttribDivisor(modelLoc + 3, 0)
        gl.vertexAttribDivisor(normalMatrixLoc, 0)
        gl.vertexAttribDivisor(normalMatrixLoc + 1, 0)
        gl.vertexAttribDivisor(normalMatrixLoc + 2, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceLightDir, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceTexOffset, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceTexScale, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceNightTexOffset, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceNightTexScale, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceEmissive, 0)
        gl.vertexAttribDivisor(this.shader.attribs.instanceCloudPage, 0)
    }
    protected getCullMargin(_node: WebGLSphereNode): number {
        return 0
    }
    protected shouldCullNode(_node: WebGLSphereNode, _projected: ProjectedPoint, _worldPos: Vector3): boolean {
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
    private _lastShowCheckerPattern = false

    beginFrame(): void {
        this.pendingInstances.length = 0
        this.groupsMap.clear()

        const showCheckerPattern = this.engine?.getDebugManager().debugflags.showCheckerPattern
        if(showCheckerPattern !== undefined && showCheckerPattern !== this._lastShowCheckerPattern) {
            this._lastShowCheckerPattern = showCheckerPattern
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

        this.sphereInstancePool = new Float32Array(this.MAX_SPHERE_INSTANCES * 39)
        this.sphereBatchBuffer = new Float32Array(this.MAX_SPHERE_INSTANCES * 38)

        gl.clearColor(0, 0, 0, 0)
    }

    private initBuffers() {
        if(!this.gl) {
            return
        }

        const { indices, normals, positions } = createSphereMesh(4)

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

    private findStarEntityForPlanet(planetEntity: Entity): Entity | undefined {
        if (!this.engine) return undefined

        let current: Entity | undefined = planetEntity
        while (current) {
            const sceneNode = this.engine.getSceneNode(current)
            if (sceneNode?.parent) {
                current = sceneNode.parent.entity
            } else {
                break
            }

            const color = current.getComponent(ColorComponent)
            if (color?.emitLight) {
                return current
            }
        }

        return undefined
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
        }
        return super.removeFromEngine()
    }
}
