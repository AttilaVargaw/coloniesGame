import { createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram } from "./webglShaders"
import { type ShaderProgram } from "./ShaderProgram"
import { mat4 } from "@/engine/lib/mat4"
import type { Vec3 } from "@/engine/lib/vec3"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { WebGLBaseRenderer } from "./webglBaseRenderer"
import { AtlasEntry, WebGLTextureAtlas, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { Entity } from "@/engine/entities/entity"
import { RenderableNode } from "../viewportSystem/renderers/renderableNode"

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
    private shader: ShaderProgram | null = null
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private sphereIndexType = 0
    private atlas!: WebGLTextureAtlas
    private nightAtlas!: WebGLTextureAtlas
    private pendingInstances: Array<{ page: number; depth: number; data: Float32Array }> = []

    beginFrame(): void {
        this.pendingInstances = []
        super.beginFrame()
    }

    endFrame() {
        if(!this.gl || !this.shader) {
            this.endFrameFallback()
            return
        }

        const gl = this.gl!

        this.resetGLState(gl)

        if(this.pendingInstances.length === 0) {
            return
        }

        const camera = this.viewportSystem.viewport.camera
        const { fx, fy, fz } = camera.viewBasis
        const [camX, camY, camZ] = camera.cameraPosition
        mat4.lookAt(this.view, [camX, camY, camZ], [camX + fx, camY + fy, camZ + fz], [0, 0, 1])

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        gl.useProgram(this.shader.program)

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniform3f(this.shader.uniforms.lightColor, 1, 0.95, 0.85)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.02, 0.02, 0.04)

        gl.uniform3f(this.shader.uniforms.cameraPosition, camX, camY, camZ)

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

        const instanceStride = 37 * 4

        const groups = new Map<number, Array<{ depth: number; data: Float32Array }>>()
        for(const inst of this.pendingInstances) {
            if(!groups.has(inst.page)) {
                groups.set(inst.page, [])
            }
            groups.get(inst.page)!.push({ depth: inst.depth, data: inst.data })
        }

        const modelLoc = this.shader.attribs.instanceModel
        const normalMatrixLoc = this.shader.attribs.instanceNormalMatrix

        for(const [page, instances] of groups) {
            instances.sort((a, b) => b.depth - a.depth)

            const totalFloats = instances.length * 37
            const instanceArray = new Float32Array(totalFloats)
            let offset = 0
            for(const inst of instances) {
                instanceArray.set(inst.data, offset)
                offset += 37
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, instanceArray, gl.DYNAMIC_DRAW)

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

            const atlasTexture = this.atlas.getTextures(gl)[page]
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, atlasTexture)
            gl.uniform1i(this.shader.uniforms.texture, 0)

            const nightAtlasTextures = this.nightAtlas.getTextures(gl)
            const nightPageTexture = nightAtlasTextures[page] ?? nightAtlasTextures[0]
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, nightPageTexture)
            gl.uniform1i(this.shader.uniforms.nightTexture, 1)

            gl.enable(gl.DEPTH_TEST)
            gl.enable(gl.CULL_FACE)
            gl.cullFace(gl.BACK)
            gl.drawElementsInstanced(gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0, instances.length)
        }

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

        this.glDrawnThisFrame = true
        this.viewportSystem.webglDrawn = true
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

        this.initBuffers()

        gl.disable(gl.DEPTH_TEST)
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

    private findStarEntity(): Entity | undefined {
        return this.engine?.getAllEntities().find(e => {
            const color = e.getComponent(ColorComponent)
            return color?.emitLight
        })
    }

    drawNode(node: WebGLSphereNode, _dT?: number): void {
        if(!this.engine || !this.atlas) {
            return
        }

        const camera = this.viewportSystem.viewport.camera
        const showCheckerPattern = this.engine.getDebugManager().debugflags.showCheckerPattern

        const textureSource = node.texture.texture
        const nightTextureSource = node.texture.nightTexture

        if(!textureSource) {
            if(showCheckerPattern) {
                if(!this.atlas.getEntry("__checker__")) {
                    this.atlas.addTexture("__checker__", createCheckerPatternCanvas())
                }
            }
            //textureSource = this.atlas.getEntry("__checker__")?.texture
            return
        }

        if(!this.atlas.getEntry(node.entity.id)) {
            this.atlas.addTexture(node.entity.id, textureSource)
        }

        const atlasEntry = this.atlas.getEntry(node.entity.id)
        if(!atlasEntry) {
            return
        }

        let nightAtlasEntry: AtlasEntry | undefined

        if(nightTextureSource) {
            const nightKey = `${node.entity.id}_night`
            if(!this.nightAtlas.getEntry(nightKey)) {
                this.nightAtlas.addTexture(nightKey, nightTextureSource)
            }
            nightAtlasEntry = this.nightAtlas.getEntry(nightKey)
        }

        if(showCheckerPattern) {
            nightAtlasEntry = this.nightAtlas.getEntry("__checker__")
            if(!nightAtlasEntry) {
                const entry = this.nightAtlas.addTexture("__checker__", createCheckerPatternCanvas())
                nightAtlasEntry = entry
            }
        }

        const { worldPos, projected } = this.getProjected(node)
        const screenRadius = node.radius.radius * projected.scale
        if(
            projected.x + screenRadius < 0 ||
            projected.x - screenRadius > camera.cssWidth ||
            projected.y + screenRadius < 0 ||
            projected.y - screenRadius > camera.cssHeight
        ) {
            return
        }

        const starEntity = this.findStarEntity()

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

        const instanceData = new Float32Array(37)
        instanceData.set(model, 0)
        instanceData.set(normalMatrix, 16)
        instanceData.set(lightDir, 25)
        instanceData.set([atlasEntry.u0, atlasEntry.v0], 28)
        instanceData.set([atlasEntry.u1 - atlasEntry.u0, atlasEntry.v1 - atlasEntry.v0], 30)
        instanceData.set([nightAtlasEntry?.u0 ?? 0, nightAtlasEntry?.v0 ?? 0], 32)
        instanceData.set([nightAtlasEntry ? (nightAtlasEntry.u1 - nightAtlasEntry.u0) : 1, nightAtlasEntry ? (nightAtlasEntry.v1 - nightAtlasEntry.v0) : 1], 34)
        instanceData.set([node.color.emitLight ? 1.0 : 0.0], 36)

        this.pendingInstances.push({
            page: atlasEntry.page,
            depth: projected.depth,
            data: instanceData
        })
    }

    constructor(viewport: ViewportSystem) {
        super(viewport, [PositionComponent, RadiusComponent, TextureComponent], (entity) => {
            const pos = entity.getComponent(PositionComponent)!
            const radius = entity.getComponent(RadiusComponent)!
            const texture = entity.getComponent(TextureComponent)!
            const color = entity.getComponent(ColorComponent)!

            return new WebGLSphereNode(entity, pos, radius, texture, color)
        })
    }

    private model = mat4.create()
    private view = mat4.create()
    private projection = mat4.create()
    private normalMatrix = new Float32Array(9)

    removeFromEngine(): this {
        if(this.gl) {
            if(this.sphereVao) this.gl.deleteBuffer(this.sphereVao)
            if(this.sphereIndexBuffer) this.gl.deleteBuffer(this.sphereIndexBuffer)
        }
        return super.removeFromEngine()
    }
}
