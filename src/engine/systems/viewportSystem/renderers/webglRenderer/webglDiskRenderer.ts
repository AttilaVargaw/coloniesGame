import { createDiskShaderProgram, type DiskAttribs, type DiskUniforms } from "./webglDiskShaders"
import type { ShaderProgram } from "./ShaderProgram"
import { PositionComponent } from "@/engine/components/position"
import { ColorComponent } from "@/engine/components/colorComponent"
import { TextureComponent } from "@/engine/components/textureComponent"
import { RingComponent } from "@/engine/components/ringComponent"
import { OrbitComponent } from "@engine/components/orbitComponent"
import { WebGLBaseRenderer } from "./webglBaseRenderer"
import { WebGLTextureAtlas, createCheckerPatternCanvas } from "./webglTextureAtlas"
import { Entity } from "@/engine/entities/entity"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { ViewportSystem } from "../../viewportSystem"
import { RenderableNode } from "../renderableNode"
import Camera from "@/lib/camera"
import { mat4, vec3 } from "gl-matrix"
import chroma from "chroma-js"
import {
    setupInstancedAttrib,
    resetInstancedAttrib,
    bindPageTexture,
    uploadInstanceBatch,
} from "./webglRendererUtils"

type UVRect = { u0: number; v0: number; u1: number; v1: number }

type RingInstance = {
    model: Float32Array
    ringColor: { r: number; g: number; b: number }
    uv: UVRect
    depth: number
    page: number
    entityId: string
    innerRadius: number
    outerRadius: number
}

export class WebGLRingNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public ring: RingComponent,
        public texture: TextureComponent,
        public color: ColorComponent
    ) {
        super(color, entity)
    }
}

export class WebGLDiskRenderer extends WebGLBaseRenderer<WebGLRingNode> {
    private shader: ShaderProgram<DiskAttribs, DiskUniforms> | null = null
    private quadBuffer: WebGLBuffer | null = null
    private indexBuffer: WebGLBuffer | null = null
    private indexCount = 0
    private atlas!: WebGLTextureAtlas
    protected instanceBuffer: WebGLBuffer | null = null
    private instanceBufferCapacity = 0

    drawNodes(): void {
        if(!this.engine || !this.atlas || !this.gl || !this.shader || !this.viewportSystem.camera) {
            return
        }

        const { camera } = this.viewportSystem

        const gl = this.gl
        this.resetGLState(gl)

        gl.useProgram(this.shader.program)
        gl.enable(gl.DEPTH_TEST)
        gl.depthMask(false)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer!)
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 2, gl.FLOAT, false, 16, 0)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, 16, 8)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer!)

        const { fx, fy, fz } = camera.viewBasis
        const cam = camera.cameraPosition
        const view = mat4.create()
        mat4.lookAt(view, cam, [cam[0] + fx, cam[1] + fy, cam[2] + fz], [0, 1, 0])

        const aspectRatio = camera.context.canvas.width / camera.context.canvas.height
        const projection = mat4.create()
        mat4.perspective(projection, camera.fieldOfView, aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, projection)

        // Compute light direction from star to view space
        const starEntity = this.engine!.getAllEntities().find(e => e.getComponent(ColorComponent)?.emitLight)
        let lightDir = [0.5, 1.0, 0.5]
        if(starEntity) {
            const starPos = getAbsolute(starEntity, this.engine!)
            const cam = camera.cameraPosition
            const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), starPos, cam))
            const viewDir = vec3.transformMat4(vec3.create(), dir, view)
            lightDir = [viewDir[0], viewDir[1], viewDir[2]]
        }
        gl.uniform3f(this.shader.uniforms.lightDir!, lightDir[0], lightDir[1], lightDir[2])

        const instances = this.collectInstances(camera)

        // Group by texture page
        const pageGroups = new Map<number, RingInstance[]>()
        for(const inst of instances) {
            if(!pageGroups.has(inst.page)) {
                pageGroups.set(inst.page, [])
            }
            pageGroups.get(inst.page)!.push(inst)
        }

        const sortedPages = Array.from(pageGroups.entries()).sort((a, b) => {
            const avgA = a[1].reduce((s, i) => s + i.depth, 0) / a[1].length
            const avgB = b[1].reduce((s, i) => s + i.depth, 0) / b[1].length
            return avgB - avgA
        })

        const floatsPerInstance = 16 + 3 + 4

        const textures = this.atlas.getTextures(gl)

        let lastPage = -1
        for(const [page, items] of sortedPages) {
            const texture = textures[page]
            if(!texture) continue

            const totalFloats = items.length * floatsPerInstance
            const pool = new Float32Array(totalFloats)

            let floatOffset = 0
            for(const inst of items) {
                pool.set(inst.model, floatOffset)
                floatOffset += 16
                pool[floatOffset] = inst.ringColor.r / 255
                pool[floatOffset + 1] = inst.ringColor.g / 255
                pool[floatOffset + 2] = inst.ringColor.b / 255
                floatOffset += 3
                pool[floatOffset] = inst.uv.u0
                pool[floatOffset + 1] = inst.uv.v0
                pool[floatOffset + 2] = inst.uv.u1
                pool[floatOffset + 3] = inst.uv.v1
                floatOffset += 4
            }

            const upload = uploadInstanceBatch(gl, this.instanceBuffer, pool, this.instanceBufferCapacity)
            this.instanceBuffer = upload.buffer
            this.instanceBufferCapacity = upload.capacity

            const stride = floatsPerInstance * 4
            setupInstancedAttrib(gl, this.shader.attribs.instanceModel, 4, 0, stride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceModel + 1, 4, 4 * 4, stride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceModel + 2, 4, 8 * 4, stride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceModel + 3, 4, 12 * 4, stride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceColor, 3, 16 * 4, stride)
            setupInstancedAttrib(gl, this.shader.attribs.instanceUV, 4, 19 * 4, stride)

            lastPage = bindPageTexture(gl, textures, page, 0, this.shader.uniforms.ringTexture, lastPage)
            gl.uniform1f(this.shader.uniforms.innerRadiusRatio, items[0].innerRadius / items[0].outerRadius)

            gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, items.length)
        }

        gl.disable(gl.DEPTH_TEST)
        gl.depthMask(true)
        gl.disable(gl.BLEND)

        resetInstancedAttrib(gl, this.shader.attribs.instanceModel)
        resetInstancedAttrib(gl, this.shader.attribs.instanceModel + 1)
        resetInstancedAttrib(gl, this.shader.attribs.instanceModel + 2)
        resetInstancedAttrib(gl, this.shader.attribs.instanceModel + 3)
        resetInstancedAttrib(gl, this.shader.attribs.instanceColor)
        resetInstancedAttrib(gl, this.shader.attribs.instanceUV)
        gl.disableVertexAttribArray(this.shader.attribs.position)
        gl.disableVertexAttribArray(this.shader.attribs.texCoord)
    }

    private collectInstances(camera: Camera): RingInstance[] {
        const instances: RingInstance[] = []

        for(const { node, projected } of this.getProjectedCacheEntries()) {
            const screenRadius = node.ring.outerRadius * projected.scale
            if(
                projected.x + screenRadius < 0 ||
                projected.x - screenRadius > camera.cssWidth ||
                projected.y + screenRadius < 0 ||
                projected.y - screenRadius > camera.cssHeight
            ) {
                continue
            }

            const worldPos = getAbsolute(node.entity, this.engine!)
            const model = mat4.create()
            mat4.identity(model)
            mat4.translate(model, model, worldPos)

            // Orient ring plane to match the parent body's orbital plane
            const sceneNode = this.engine!.getSceneNode(node.entity)
            const parentEntity = sceneNode?.parent?.entity
            const orbit = parentEntity?.getComponent(OrbitComponent)
            if(orbit) {
                // mat4.rotate(model, model, orbit.longitudeOfAscendingNode, [0, 0, 1])
                mat4.rotate(model, model, 0.5 * Math.PI, [1, 0, 0])
            }

            const scale = node.ring.outerRadius * 2
            mat4.scale(model, model, [scale, scale, scale])

            const textureSource = node.texture.day
            if(!textureSource) continue

            const showCheckerPattern = this.engine!.getDebugManager().debugflags.showCheckerPattern
            const atlasEntry = showCheckerPattern
                ? this.atlas.getOrCreateEntry("__checker__", createCheckerPatternCanvas())
                : this.atlas.getOrCreateEntry(node.entity.id, textureSource)

            const [rr, rg, rb] = chroma(node.ring.color || "#d4bc7e").rgb()
            const ringColor = { r: rr, g: rg, b: rb }

            instances.push({
                model: new Float32Array(model),
                ringColor: ringColor,
                uv: atlasEntry,
                depth: projected.depth,
                page: atlasEntry.page,
                entityId: node.entity.id,
                innerRadius: node.ring.innerRadius,
                outerRadius: node.ring.outerRadius
            })
        }

        return instances
    }

    init() {
        if(!this.engine) {
            throw new Error("WebGL not available")
        }

        this.initCanvases()
        const gl = this.initContext()

        this.shader = createDiskShaderProgram(gl)
        this.atlas = new WebGLTextureAtlas(2048, 2048)

        const vertices = new Float32Array([
            -1, -1, 0, 0,
            1, -1, 1, 0,
            -1, 1, 0, 1,
            1, 1, 1, 1,
        ])
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3])

        this.quadBuffer = gl.createBuffer()!
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        this.indexBuffer = gl.createBuffer()!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

        this.indexCount = indices.length

        this.instanceBuffer = gl.createBuffer()!
        this.instanceBufferCapacity = 0
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.shader) this.gl.deleteProgram(this.shader.program)
            if(this.quadBuffer) {
                this.gl.deleteBuffer(this.quadBuffer)
                this.quadBuffer = null
            }
            if(this.indexBuffer) {
                this.gl.deleteBuffer(this.indexBuffer)
                this.indexBuffer = null
            }
            if(this.instanceBuffer) {
                this.gl.deleteBuffer(this.instanceBuffer)
                this.instanceBuffer = null
            }
        }
        return super.removeFromEngine()
    }

    constructor(viewport: ViewportSystem) {
        super(
            viewport,
            [PositionComponent, RingComponent, TextureComponent, ColorComponent],
            (entity) => {
                const pos = entity.getComponent(PositionComponent)!
                const ring = entity.getComponent(RingComponent)!
                const texture = entity.getComponent(TextureComponent)!
                const color = entity.getComponent(ColorComponent)!
                return new WebGLRingNode(entity, pos, ring, texture, color)
            },
        )
    }
}
