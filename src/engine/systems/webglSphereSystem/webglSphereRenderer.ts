import { createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram, type ShaderProgram } from "./webglShaders"
import { mat4 } from "@/engine/lib/mat4"
import { vec3, type Vec3 } from "@/engine/lib/vec3"
import Camera from "@/lib/camera"
import { BaseRenderer } from "../viewportSystem/renderers/baseRenderer"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { WebGLTextureAtlas, type AtlasEntry } from "./webglTextureAtlas"
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
    private gl: WebGLRenderingContext | null = null
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

    beginFrame() {
        this.glDrawnThisFrame = false
    }

    init() {
        if(!this.engine) {
            throw new Error("WebGL not available")
        }

        this.glCanvas = this.engine.getCanvas("webgl") as HTMLCanvasElement
        this.canvas = this.engine.getCanvas("2d") as HTMLCanvasElement

        this.gl = this.glCanvas.getContext("webgl")

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

        this.gl.disable(this.gl.DEPTH_TEST)
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

    protected updateNode(node: WebGLSphereNode, _dT?: number, _ctx?: CanvasRenderingContext2D): void {
        if(!this.engine || !this.atlas || this.glDrawnThisFrame) {
            return
        }

        //const ctx = this.viewportSystem.viewport.camera.context
        const camera = this.viewportSystem.viewport.camera

        const mainCanvas = this.canvas

        if(this.glCanvas.width !== mainCanvas.width || this.glCanvas.height !== mainCanvas.height) {
            this.glCanvas.width = mainCanvas.width
            this.glCanvas.height = mainCanvas.height
            this.resize(mainCanvas.width, mainCanvas.height)
            this.glCanvas.style.width = mainCanvas.style.width
            this.glCanvas.style.height = mainCanvas.style.height
        }

        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }

        const starPos = this.getWorldPosition2(starEntity)

        const gl = this.glContext

        if(!gl || this.glDrawnThisFrame) {
            return
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        const { fx, fy, fz } = camera.viewBasis
        const [camX, camY, camZ] = camera.cameraPosition

        mat4.lookAt(this.view, [camX, camY, camZ], [camX + fx, camY + fy, camZ + fz], [0, 0, 1])

        if(!node.texture.texture) {
            return
        }

        if(!this.atlas.getEntry(node.entity.id)) {
            this.atlas.addTexture(node.entity.id, node.texture.texture)
        }

        const worldPos = this.getWorldPosition2(node.entity)
        const projected = camera.project(worldPos[0], worldPos[1], worldPos[2])
        if(!projected) {
            return
        }

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

        const atlasTexture = this.atlas.getTexture(gl)

        const lightDirRaw: Vec3 = [
            starPos[0] - worldPos[0],
            starPos[1] - worldPos[1],
            starPos[2] - worldPos[2],
        ]
        const lightDirLength = Math.hypot(lightDirRaw[0], lightDirRaw[1], lightDirRaw[2])
        const lightDir: Vec3 = lightDirLength > 0
            ? [lightDirRaw[0] / lightDirLength, lightDirRaw[1] / lightDirLength, lightDirRaw[2] / lightDirLength]
            : [0, 0, 1]

        this.render(
            worldPos,
            node.radius.radius,
            camera,
            atlasEntry,
            atlasTexture,
            lightDir,
        )

        this.canvas.getContext("2d")!.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
        this.glDrawnThisFrame = true
    }

    constructor(viewport: ViewportSystem) {
        super(viewport, [PositionComponent, RadiusComponent, TextureComponent, ColorComponent], (entity) => {
            const pos = entity.getComponent(PositionComponent)!
            const radius = entity.getComponent(RadiusComponent)!
            const texture = entity.getComponent(TextureComponent)!
            const color = entity.getComponent(ColorComponent)!

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

    get glContext(): WebGLRenderingContext | null {
        return this.gl
    }

    private model = mat4.create()
    private view = mat4.create()
    private projection = mat4.create()
    private normalMatrix = new Float32Array(9)

    render(
        worldPos: [number, number, number],
        worldRadius: number,
        camera: Camera,
        atlasEntry: AtlasEntry,
        atlasTexture: WebGLTexture,
        lightDirectionWorld: Vec3,
    ) {
        if(
            !this.gl ||
            !this.shader ||
            !this.sphereVao ||
            !this.sphereIndexBuffer ||
            !this.sphereIndexCount
        ) {
            return
        }

        const lightDir = vec3.create()
        vec3.normalize(lightDir, lightDirectionWorld)

        mat4.identity(this.model)
        mat4.translate(this.model, this.model, worldPos)
        const scale = worldRadius
        mat4.scale(this.model, this.model, [scale, scale, scale])

        this.normalMatrix[0] = this.model[0]
        this.normalMatrix[1] = this.model[4]
        this.normalMatrix[2] = this.model[8]
        this.normalMatrix[3] = this.model[1]
        this.normalMatrix[4] = this.model[5]
        this.normalMatrix[5] = this.model[9]
        this.normalMatrix[6] = this.model[2]
        this.normalMatrix[7] = this.model[6]
        this.normalMatrix[8] = this.model[10]

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        this.gl.useProgram(this.shader.program)

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 8 * 4
        this.gl.enableVertexAttribArray(this.shader.attribs.position)
        this.gl.vertexAttribPointer(this.shader.attribs.position, 3, this.gl.FLOAT, false, stride, 0)
        this.gl.enableVertexAttribArray(this.shader.attribs.normal)
        this.gl.vertexAttribPointer(this.shader.attribs.normal, 3, this.gl.FLOAT, false, stride, 3 * 4)
        this.gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        this.gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, this.gl.FLOAT, false, stride, 6 * 4)

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        this.gl.uniformMatrix4fv(this.shader.uniforms.model, false, this.model)
        this.gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        this.gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        this.gl.uniformMatrix3fv(this.shader.uniforms.normalMatrix, false, this.normalMatrix)

        this.gl.activeTexture(this.gl.TEXTURE0 + this.textureUnit)
        this.gl.bindTexture(this.gl.TEXTURE_2D, atlasTexture)
        this.gl.uniform1i(this.shader.uniforms.texture, this.textureUnit)

        this.gl.uniform2fv(this.shader.uniforms.textureOffset, [atlasEntry.u0, atlasEntry.v0])
        this.gl.uniform2fv(this.shader.uniforms.textureScale, [atlasEntry.u1 - atlasEntry.u0, atlasEntry.v1 - atlasEntry.v0])

        //const lightDir = vec3.normalize([0, 0, 0], lightDirectionWorld)
        this.gl.uniform3fv(this.shader.uniforms.lightDirection, lightDir)
        this.gl.uniform3f(this.shader.uniforms.lightColor, 1, 0.95, 0.85)
        this.gl.uniform3f(this.shader.uniforms.ambientColor, 0.6, 0.6, 0.65)

        this.gl.enable(this.gl.DEPTH_TEST)
        this.gl.enable(this.gl.CULL_FACE)
        this.gl.drawElements(this.gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0)
    }
}
