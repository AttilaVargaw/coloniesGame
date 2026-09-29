import { createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram, type ShaderProgram } from "./webglShaders"
import { mat4 } from "@/engine/lib/mat4"
import { type Vec3 } from "@/engine/lib/vec3"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { BaseRenderer } from "../viewportSystem/renderers/baseRenderer"
import { WebGLTextureAtlas } from "./webglTextureAtlas"
import { Entity } from "@/engine/entities/entity"
import { RenderableNode } from "../viewportSystem/renderers/renderableNode"

const SPHERE_SEGMENTS = 32

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
}
export class WebGLSphereRenderer extends BaseRenderer<WebGLSphereNode> {
    private gl: WebGL2RenderingContext | null = null
    private shader: ShaderProgram | null = null
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private sphereIndexType = 0
    private textureUnit = 0
    private atlas!: WebGLTextureAtlas
    private glCanvas!: HTMLCanvasElement
    private canvas!: HTMLCanvasElement
    private glDrawnThisFrame = false
    private instanceBuffer: WebGLBuffer | null = null
    private pendingInstances: Array<{ depth: number; data: Float32Array }> = []

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

        this.pendingInstances.sort((a, b) => b.depth - a.depth)

        const totalFloats = this.pendingInstances.length * 32
        const instanceArray = new Float32Array(totalFloats)
        let offset = 0
        for(const inst of this.pendingInstances) {
            instanceArray.set(inst.data, offset)
            offset += 32
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
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.6, 0.6, 0.65)

        const atlasTexture = this.atlas.getTexture(gl)
        gl.activeTexture(gl.TEXTURE0 + this.textureUnit)
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture)
        gl.uniform1i(this.shader.uniforms.texture, this.textureUnit)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 8 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 3, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.normal)
        gl.vertexAttribPointer(this.shader.attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, stride, 6 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        this.instanceBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, instanceArray, gl.DYNAMIC_DRAW)

        const modelLoc = this.shader.attribs.instanceModel
        const normalMatrixLoc = this.shader.attribs.instanceNormalMatrix
        const instanceStride = 32 * 4
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

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.CULL_FACE)
        gl.drawElementsInstanced(gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0, this.pendingInstances.length)

        this.glDrawnThisFrame = true

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

        const ctx = this.canvas.getContext("2d")
        if(ctx) {
            ctx.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
        }
    }

    init() {
        if(!this.engine) {
            throw new Error("WebGL not available")
        }

        this.glCanvas = this.engine.getCanvas("webgl2") as HTMLCanvasElement
        this.canvas = this.engine.getCanvas("2d") as HTMLCanvasElement

        this.gl = this.glCanvas.getContext("webgl2")

        if(!this.gl) {
            throw new Error("WebGL not supported")
        }

        this.shader = createShaderProgram(this.gl)

        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = this.glCanvas.width
        this.glCanvas.height = this.glCanvas.height
        this.glCanvas.style.pointerEvents = "none"
        this.atlas = new WebGLTextureAtlas()

        this.initBuffers()
        this.initInstanceBuffer()

        this.gl.disable(this.gl.DEPTH_TEST)
    }

    private initInstanceBuffer() {
        if(!this.gl) {
            return
        }

        this.instanceBuffer = this.gl.createBuffer()
    }

    private findStarEntity(): Entity | undefined {
        return this.engine?.getAllEntities().find(e => {
            const color = e.getComponent(ColorComponent)
            return color?.emitLight
        })
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

    protected updateNode(node: WebGLSphereNode, _dT?: number, ctx?: CanvasRenderingContext2D): void {
        if(ctx) {
            return
        }

        if(!this.engine || !this.atlas) {
            return
        }

        const camera = this.viewportSystem.viewport.camera

        if(!node.texture.texture) {
            return
        }

        if(!this.atlas.getEntry(node.entity.id)) {
            this.atlas.addTexture(node.entity.id, node.texture.texture)
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

        const atlasEntry = this.atlas.getEntry(node.entity.id)
        if(!atlasEntry) {
            return
        }

        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }

        const starPos = this.getWorldPosition2(starEntity)

        const lightDirRaw: Vec3 = [
            starPos[0] - worldPos[0],
            starPos[1] - worldPos[1],
            starPos[2] - worldPos[2],
        ]
        const lightDirLength = Math.hypot(lightDirRaw[0], lightDirRaw[1], lightDirRaw[2])
        const lightDir: Vec3 = lightDirLength > 0
            ? [lightDirRaw[0] / lightDirLength, lightDirRaw[1] / lightDirLength, lightDirRaw[2] / lightDirLength]
            : [0, 0, 1]

        const model = mat4.create()
        mat4.identity(model)
        mat4.translate(model, model, [worldPos[0], worldPos[1], worldPos[2]])
        const scale = node.radius.radius
        mat4.scale(model, model, [scale, scale, scale])

        const normalMatrix = new Float32Array(9)
        normalMatrix[0] = model[0]
        normalMatrix[1] = model[4]
        normalMatrix[2] = model[8]
        normalMatrix[3] = model[1]
        normalMatrix[4] = model[5]
        normalMatrix[5] = model[9]
        normalMatrix[6] = model[2]
        normalMatrix[7] = model[6]
        normalMatrix[8] = model[10]

        const instanceData = new Float32Array(32)
        instanceData.set(model, 0)
        instanceData.set(normalMatrix, 16)
        instanceData.set(lightDir, 25)
        instanceData.set([atlasEntry.u0, atlasEntry.v0], 28)
        instanceData.set([atlasEntry.u1 - atlasEntry.u0, atlasEntry.v1 - atlasEntry.v0], 30)

        this.pendingInstances.push({
            depth: projected.depth,
            data: instanceData
        })
    }

    constructor(viewport: ViewportSystem) {
        super(viewport, [PositionComponent, RadiusComponent, TextureComponent, ColorComponent], (entity) => {
            const pos = entity.getComponent(PositionComponent)!
            const radius = entity.getComponent(RadiusComponent)!
            const texture = entity.getComponent(TextureComponent)!
            const color = entity.getComponent(ColorComponent)!

            console.log("not called", entity, pos)

            return new WebGLSphereNode(entity, pos, radius, texture, color)
        })
    }

    private initBuffers() {
        if(!this.gl) {
            return
        }

        const { indices, normals, positions, uvs } = createSphereMesh(SPHERE_SEGMENTS, Math.round(SPHERE_SEGMENTS * 0.66))

        const vertexCount = positions.length / 3
        const interleaved = new Float32Array(vertexCount * 8)
        for(let i = 0; i < vertexCount; i++) {
            const base = i * 8
            const posBase = i * 3
            const uvBase = i * 2

            interleaved[base + 0] = positions[posBase + 0]
            interleaved[base + 1] = positions[posBase + 1]
            interleaved[base + 2] = positions[posBase + 2]
            interleaved[base + 3] = normals[posBase + 0]
            interleaved[base + 4] = normals[posBase + 1]
            interleaved[base + 5] = normals[posBase + 2]
            interleaved[base + 6] = uvs[uvBase + 0]
            interleaved[base + 7] = uvs[uvBase + 1]
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

    resize(width: number, height: number) {
        if(!this.gl) {
            return
        }

        this.gl.viewport(0, 0, width, height)
    }

    get glContext(): WebGL2RenderingContext | null {
        return this.gl
    }

    private model = mat4.create()
    private view = mat4.create()
    private projection = mat4.create()
    private normalMatrix = new Float32Array(9)

    removeFromEngine(): this {
        if(this.gl) {
            if(this.sphereVao) this.gl.deleteBuffer(this.sphereVao)
            if(this.sphereIndexBuffer) this.gl.deleteBuffer(this.sphereIndexBuffer)
            if(this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer)
            if(this.shader?.program) this.gl.deleteProgram(this.shader.program)
        }
        return super.removeFromEngine()
    }
}
