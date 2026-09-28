import { SphereMesh, createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram, type ShaderProgram } from "./webglShaders"
import { mat4 } from "@/engine/lib/mat4"
import { vec3, type Vec3 } from "@/engine/lib/vec3"
import { ProjectedPoint } from "@/lib/camera"
import Camera from "@/lib/camera"

const SPHERE_SEGMENTS = 48

export class WebGLSphereRenderer {
    private gl: WebGLRenderingContext
    private shader: ShaderProgram
    private mesh: SphereMesh
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private textureUnit = 0

    constructor(canvas: HTMLCanvasElement) {
        if(typeof document === "undefined") {
            throw new Error("WebGL not available")
        }
        const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false })!
        if(!gl) {
            throw new Error("WebGL not supported")
        }
        this.gl = gl
        this.shader = createShaderProgram(gl)
        this.mesh = createSphereMesh(SPHERE_SEGMENTS, Math.round(SPHERE_SEGMENTS * 0.66))

        this.initBuffers()
    }

    private initBuffers() {
        const gl = this.gl

        this.sphereVao = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            ...this.mesh.positions,
            ...this.mesh.normals,
            ...this.mesh.uvs,
        ]), gl.STATIC_DRAW)

        this.sphereIndexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW)
        this.sphereIndexCount = this.mesh.indices.length
    }

    resize(width: number, height: number) {
        this.gl.viewport(0, 0, width, height)
    }

    get glContext(): WebGLRenderingContext {
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

        const lightDir = vec3.normalize([0, 0, 0], lightDirectionWorld)
        gl.uniform3fv(this.shader.uniforms.lightDirection, lightDir)
        gl.uniform3f(this.shader.uniforms.lightColor, 1, 1, 1)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.15, 0.15, 0.18)

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.CULL_FACE)
        gl.drawElements(gl.TRIANGLES, this.sphereIndexCount, gl.UNSIGNED_SHORT, 0)
    }
}
