import { createSphereMesh } from "./webglSphereGeometry"
import { createAtmosphereShaderProgram } from "./webglAtmosphereShaders"
import type { ShaderProgram } from "./ShaderProgram"
import { PositionComponent } from "@/engine/components/position"
import { RadiusComponent } from "@/engine/components/radiusComponent"
import { AtmosphereComponent } from "@/engine/components/atmosphereComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { WebGLBaseRenderer } from "./webglBaseRenderer"
import { SOLAR_UNIT } from "@/game/constants"
import { Entity } from "@/engine/entities/entity"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { ViewportSystem } from "../../viewportSystem"
import { RenderableNode } from "../renderableNode"
import { ProjectedPoint } from "@/lib/camera"
import { vec3, mat4, mat3 } from "gl-matrix"

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 0.3, g: 0.6, b: 1.0 }
}

export class WebGLAtmosphereNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public radius: RadiusComponent,
        public atmosphere: AtmosphereComponent,
        public color: ColorComponent
    ) {
        super(color, entity)
    }
}

export class WebGLAtmosphereRenderer extends WebGLBaseRenderer<WebGLAtmosphereNode> {
    drawNodes(): void {
        if(!this.engine || !this.gl || !this.shader || !this.viewportSystem.camera) {
            return
        }

        const { camera } = this.viewportSystem
        const showAtmosphere = this.engine.getDebugManager().debugflags.showAtmosphere
        if(!showAtmosphere) {
            return
        }

        const gl = this.gl
        this.resetGLState(gl)

        const { fx, fy, fz } = camera.viewBasis
        const cam = camera.cameraPosition
        mat4.lookAt(this.view, cam, [cam[0] + fx, cam[1] + fy, cam[2] + fz], [0, 1, 0])

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        mat4.perspective(this.projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        const targetFramebuffer = this.hdrEnabled ? this.hdrFramebuffer : null
        const width = targetFramebuffer ? gl.canvas.width : gl.canvas.width
        const height = targetFramebuffer ? gl.canvas.height : gl.canvas.height

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer)
        if(targetFramebuffer) {
            gl.viewport(0, 0, width, height)
        } else {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        }

        gl.useProgram(this.shader.program)

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        const [camX, camY, camZ] = camera.cameraPosition
        gl.uniform3f(this.shader.uniforms.cameraPosition, camX, camY, camZ)
        gl.uniform1f(this.shader.uniforms.hdrMode, this.hdrEnabled ? 1.0 : 0.0)

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

        let poolOffset = 0
        for(const { node, projected } of this.getProjectedCacheEntries()) {
            const { worldPos } = this.getProjected(node)

            const model = mat4.create()
            mat4.identity(model)
            mat4.translate(model, model, worldPos)
            mat4.scale(model, model, [node.radius.radius + node.atmosphere.thickness, node.radius.radius + node.atmosphere.thickness, node.radius.radius + node.atmosphere.thickness])

            const normalMatrix = mat3.create()
            mat3.normalFromMat4(normalMatrix, model)

            const starEntity = this.findStarEntityForPlanet(node.entity)

            let lightDir = vec3.fromValues(0, 1, 0)
            let lightColor = vec3.fromValues(1.0, 1.0, 1.0)

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
                    lightColor = [parsed.r / 255 * attenuation, parsed.g / 255 * attenuation, parsed.b / 255 * attenuation]
                }
            }

            const paletteRgb = hexToRgb(node.color.fill || "#808080")

            const skyRgb = hexToRgb(node.atmosphere.skyColor)
            const skyColor = [
                skyRgb.r / 255 * (0.6 + 0.4 * paletteRgb.r / 255),
                skyRgb.g / 255 * (0.6 + 0.4 * paletteRgb.g / 255),
                skyRgb.b / 255 * (0.6 + 0.4 * paletteRgb.b / 255),
            ]

            const sh = node.atmosphere.scaleHeight > 0 ? node.atmosphere.scaleHeight : node.atmosphere.thickness * 0.35

            const pool = this.sphereInstancePool!
            pool.set(model, poolOffset)
            pool.set(normalMatrix, poolOffset + 16)
            pool.set(lightDir, poolOffset + 25)
            pool.set(lightColor, poolOffset + 28)
            pool.set([node.atmosphere.thickness, node.radius.radius, node.atmosphere.rayleigh, sh], poolOffset + 31)
            pool.set(skyColor, poolOffset + 35)

            this.pendingInstances.push({ depth: projected.depth, offset: poolOffset })
            poolOffset += 38
        }

        const totalFloats = this.pendingInstances.length * 38
        if(totalFloats === 0) {
            return
        }

        if(!this.sphereBatchBuffer || this.sphereBatchBuffer.length < totalFloats) {
            const newSize = Math.max(totalFloats, this.MAX_ATMOSPHERE_INSTANCES * 38)
            this.sphereBatchBuffer = new Float32Array(newSize)
        }
        const batch = this.sphereBatchBuffer!.subarray(0, totalFloats)
        for(let i = 0; i < this.pendingInstances.length; i++) {
            batch.set(this.sphereInstancePool!.subarray(this.pendingInstances[i].offset, this.pendingInstances[i].offset + 38), i * 38)
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
        const byteLength = totalFloats * 4
        if(byteLength > this.atmosphereInstanceBufferCapacity) {
            gl.bufferData(gl.ARRAY_BUFFER, batch, gl.STREAM_DRAW)
            this.atmosphereInstanceBufferCapacity = byteLength
        } else {
            gl.bufferData(gl.ARRAY_BUFFER, byteLength, gl.STREAM_DRAW)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch)
        }

        const instanceStride = 38 * 4

        const setupAttrib = (loc: number, size: number, offset: number) => {
            if(loc < 0) return
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, instanceStride, offset)
            gl.vertexAttribDivisor(loc, 1)
        }

        const modelLoc = this.shader.attribs.instanceModel
        const normalMatrixLoc = this.shader.attribs.instanceNormalMatrix

        setupAttrib(modelLoc, 4, 0)
        setupAttrib(modelLoc + 1, 4, 16)
        setupAttrib(modelLoc + 2, 4, 32)
        setupAttrib(modelLoc + 3, 4, 48)
        setupAttrib(normalMatrixLoc, 3, 16 * 4)
        setupAttrib(normalMatrixLoc + 1, 3, 19 * 4)
        setupAttrib(normalMatrixLoc + 2, 3, 22 * 4)
        setupAttrib(this.shader.attribs.instanceLightDir, 3, 25 * 4)
        setupAttrib(this.shader.attribs.instanceLightColor, 3, 28 * 4)
        setupAttrib(this.shader.attribs.instanceAtmosParams, 4, 31 * 4)
        setupAttrib(this.shader.attribs.instanceSkyColor, 3, 35 * 4)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.enable(gl.DEPTH_TEST)
        gl.depthMask(false)

        gl.drawElementsInstanced(gl.TRIANGLES, this.sphereIndexCount, this.sphereIndexType, 0, this.pendingInstances.length)

        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)
        const safeDisable = (loc: number) => { if(loc >= 0) gl.disableVertexAttribArray(loc) }
        safeDisable(modelLoc)
        safeDisable(modelLoc + 1)
        safeDisable(modelLoc + 2)
        safeDisable(modelLoc + 3)
        safeDisable(normalMatrixLoc)
        safeDisable(normalMatrixLoc + 1)
        safeDisable(normalMatrixLoc + 2)
        safeDisable(this.shader.attribs.instanceLightDir)
        safeDisable(this.shader.attribs.instanceLightColor)
        safeDisable(this.shader.attribs.instanceAtmosParams)
        safeDisable(this.shader.attribs.instanceSkyColor)
        safeDisable(this.shader.attribs.position)
        safeDisable(this.shader.attribs.normal)

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
        resetDivisor(this.shader.attribs.instanceLightDir)
        resetDivisor(this.shader.attribs.instanceLightColor)
        resetDivisor(this.shader.attribs.instanceAtmosParams)
        resetDivisor(this.shader.attribs.instanceSkyColor)
    }

    protected getCullMargin(node: WebGLAtmosphereNode): number {
        return node.radius.radius + node.atmosphere.thickness
    }
    protected shouldCullNode(_node: WebGLAtmosphereNode, _projected: ProjectedPoint, _worldPos: vec3): boolean {
        return false
    }
    protected shouldSkipProjection(_node: WebGLAtmosphereNode, _cameraDistance: number, _cameraScale: number): boolean {
        return false
    }

    private shader: ShaderProgram | null = null
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private sphereIndexType = 0
    private readonly MAX_ATMOSPHERE_INSTANCES = 256
    private sphereInstancePool: Float32Array | null = null
    private sphereBatchBuffer: Float32Array | null = null
    private atmosphereInstanceBufferCapacity = 0
    private pendingInstances: Array<{ depth: number; offset: number }> = []
    private _showBloom = false
    private hdrEnabled = false
    private hdrFramebuffer: WebGLFramebuffer | null = null

    private view = mat4.create()
    private projection = mat4.create()

    setHdr(enabled: boolean) {
        this.hdrEnabled = enabled
    }

    setHdrFramebuffer(framebuffer: WebGLFramebuffer | null) {
        this.hdrFramebuffer = framebuffer
    }

    beginFrame(): void {
        this.pendingInstances.length = 0
    }

    init() {
        if(!this.engine) {
            throw new Error("WebGL not available")
        }

        this.initCanvases()
        const gl = this.initContext()

        this.shader = createAtmosphereShaderProgram(gl)

        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = this.glCanvas.width
        this.glCanvas.height = this.glCanvas.height
        this.glCanvas.style.pointerEvents = "none"

        this.initBuffers()

        this.sphereInstancePool = new Float32Array(this.MAX_ATMOSPHERE_INSTANCES * 38)
        this.sphereBatchBuffer = new Float32Array(this.MAX_ATMOSPHERE_INSTANCES * 38)

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

    constructor(viewport: ViewportSystem) {
        super(
            viewport,
            [
                PositionComponent, RadiusComponent, AtmosphereComponent, ColorComponent
            ],
            (entity) => {
                const pos = entity.getComponent(PositionComponent)!
                const radius = entity.getComponent(RadiusComponent)!
                const atmosphere = entity.getComponent(AtmosphereComponent)!
                const color = entity.getComponent(ColorComponent)!

                return new WebGLAtmosphereNode(entity, pos, radius, atmosphere, color)
            })
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.sphereVao) this.gl.deleteBuffer(this.sphereVao)
            if(this.sphereIndexBuffer) this.gl.deleteBuffer(this.sphereIndexBuffer)
            if(this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer)
        }
        return super.removeFromEngine()
    }
}
