import { SphereMesh, createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram, type ShaderProgram } from "./webglShaders"
import { mat4 } from "@/engine/lib/mat4"
import { vec3, type Vec3 } from "@/engine/lib/vec3"
import { ProjectedPoint } from "@/lib/camera"
import Camera from "@/lib/camera"
import { BaseRenderer } from "../viewportSystem/renderers/baseRenderer"
import { WebGLSphereNode } from "./webglSphereSystem"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { ViewportSystem } from "../viewportSystem/viewportSystem"
import { WebGLTextureAtlas } from "./webglTextureAtlas"
import { Entity } from "@/engine/entities/entity"

const SPHERE_SEGMENTS = 48

export class WebGLSphereRenderer extends BaseRenderer<WebGLSphereNode> {
    private gl: WebGLRenderingContext | null = null
    private shader: ShaderProgram | null = null
    private mesh: SphereMesh | null = null
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private textureUnit = 0
    private atlas!: WebGLTextureAtlas
    private glCanvas!: HTMLCanvasElement

    init() {
        if(typeof document === "undefined") {
            throw new Error("WebGL not available")
        }

        this.glCanvas = document.getElementById("glCanvas")! as HTMLCanvasElement
        const gl = this.glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: false })!
        if(!gl) {
            throw new Error("WebGL not supported")
        }

        this.gl = gl
        this.shader = createShaderProgram(gl)
        this.mesh = createSphereMesh(SPHERE_SEGMENTS, Math.round(SPHERE_SEGMENTS * 0.66))

        this.initBuffers()

        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = this.glCanvas.width
        this.glCanvas.height = this.glCanvas.height
        this.glCanvas.style.pointerEvents = "none"

        this.atlas = new WebGLTextureAtlas(gl)
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

    protected updateNode(_node: WebGLSphereNode, _dT?: number, _ctx?: CanvasRenderingContext2D): void {
        console.log("asdf")

        if(!this.engine || !this.atlas) {
            return
        }

        const ctx = this.viewportSystem.viewport?.camera?.context
        const camera = this.viewportSystem.viewport?.camera
        if(!ctx || !camera) {
            return
        }

        const mainCanvas = ctx.canvas
        if(this.glCanvas.width !== mainCanvas.width || this.glCanvas.height !== mainCanvas.height) {
            this.glCanvas.width = mainCanvas.width
            this.glCanvas.height = mainCanvas.height
            this.resize(mainCanvas.width, mainCanvas.height)
        }

        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }


        const starPos = this.getWorldPosition2(starEntity)
        const lightDir: [number, number, number] = [starPos[0], starPos[1], starPos[2]]

        const gl = this.glContext

        if(!gl) {
            return
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        for(const node of this.nodes) {
            if(!node.texture?.texture) {
                continue
            }

            if(!this.atlas.getEntry(node.entity.id.toString())) {
                this.atlas.addTexture(node.entity.id.toString(), node.texture.texture)
            }

            const worldPos = this.getWorldPosition2(node.entity)
            const projected = camera.project(worldPos[0], worldPos[1], worldPos[2])
            if(!projected) {
                continue
            }

            const screenRadius = node.radius.radius * projected.scale
            if(
                projected.x + screenRadius < 0 ||
                projected.x - screenRadius > camera.cssWidth ||
                projected.y + screenRadius < 0 ||
                projected.y - screenRadius > camera.cssHeight
            ) {
                continue
            }

            const atlasEntry = this.atlas.getEntry(node.entity.id.toString())
            if(!atlasEntry) {
                continue
            }

            const atlasTexture = this.atlas.getTexture(gl)

            this.render(
                projected,
                worldPos,
                node.radius.radius,
                camera,
                atlasTexture,
                lightDir,
            )
        }
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

        this.mesh = createSphereMesh()

        const gl = this.gl

        this.sphereVao = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            ...this.mesh!.positions,
            ...this.mesh!.normals,
            ...this.mesh!.uvs,
        ]), gl.STATIC_DRAW)

        this.sphereIndexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh!.indices, gl.STATIC_DRAW)
        this.sphereIndexCount = this.mesh!.indices.length
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
        _center: ProjectedPoint,
        worldPos: [number, number, number],
        worldRadius: number,
        camera: Camera,
        texture: WebGLTexture,
        lightDirectionWorld: Vec3,
    ) {
        const gl = this.gl

        if(
            !gl ||
            !this.shader ||
            !this.sphereVao ||
            !this.sphereIndexBuffer ||
            !this.sphereIndexCount
        ) {
            return
        }

        let lightDir = vec3.create()
        vec3.normalize(lightDir, lightDirectionWorld)

        mat4.identity(this.model)
        mat4.translate(this.model, this.model, worldPos)
        const scale = worldRadius
        mat4.scale(this.model, this.model, [scale, scale, scale])

        mat4.lookAt(this.view, camera.cameraPosition as Vec3, worldPos as Vec3, [0, 0, 1])
        mat4.invert(this.view, this.view)

        this.normalMatrix[0] = this.model[0]
        this.normalMatrix[1] = this.model[1]
        this.normalMatrix[2] = this.model[2]
        this.normalMatrix[3] = this.model[4]
        this.normalMatrix[4] = this.model[5]
        this.normalMatrix[5] = this.model[6]
        this.normalMatrix[6] = this.model[8]
        this.normalMatrix[7] = this.model[9]
        this.normalMatrix[8] = this.model[10]

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        gl.useProgram(this.shader.program)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 8 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 3, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.normal)
        gl.vertexAttribPointer(this.shader.attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, stride, 6 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        gl.uniformMatrix4fv(this.shader.uniforms.model, false, this.model)
        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniformMatrix3fv(this.shader.uniforms.normalMatrix, false, this.normalMatrix)

        gl.activeTexture(gl.TEXTURE0 + this.textureUnit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(this.shader.uniforms.texture, this.textureUnit)

        lightDir = vec3.normalize([0, 0, 0], lightDirectionWorld)
        gl.uniform3fv(this.shader.uniforms.lightDirection, lightDir)
        gl.uniform3f(this.shader.uniforms.lightColor, 1, 1, 1)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.15, 0.15, 0.18)

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.CULL_FACE)
        gl.drawElements(gl.TRIANGLES, this.sphereIndexCount, gl.UNSIGNED_SHORT, 0)
    }
}
