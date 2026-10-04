import { PositionComponent } from "@/engine/components/position"
import { OrbitComponent } from "@/engine/components/orbitComponent"
import { ColorComponent } from "@/engine/components/colorComponent"
import { WebGLBaseRenderer } from "./webglBaseRenderer"
import { createOrbitShaderProgram, type OrbitShaderProgram } from "./webglOrbitShaders"
import { getAbsolute } from "@/engine/lib/getAbsolute"
import { TWO_PI } from "@/engine/lib/cameraConstants"
import { precomputeOrbitalTrig } from "../../../orbitSystem/orbitalTrig"
import { Entity } from "@/engine/entities/entity"
import { ViewportSystem } from "../../viewportSystem"
import { RenderableNode } from "../renderableNode"

export class WebGLOrbitNode extends RenderableNode {
    constructor(
        entity: Entity,
        public position: PositionComponent,
        public orbit: OrbitComponent,
        color: ColorComponent,
    ) {
        super(color, entity)
    }
}

export class WebGLOrbitRenderer extends WebGLBaseRenderer<WebGLOrbitNode> {
    private shader: OrbitShaderProgram | null = null
    private vertexBuffer: WebGLBuffer | null = null
    private projection = new Float32Array(16)

    beginFrame(): void {
    }

    init() {
        if(!this.engine) {
            return
        }

        this.initCanvases()
        const gl = this.initContext()

        this.shader = createOrbitShaderProgram(gl)

        this.vertexBuffer = gl.createBuffer()

        gl.clearColor(0, 0, 0, 0)
    }

    drawNodes(): void {
        if(!this.engine || !this.gl || !this.shader || !this.viewportSystem.camera) {
            return
        }

        const debugManager = this.engine.getDebugManager()
        if(!debugManager.debugflags.drawOrbits) {
            return
        }

        const { camera } = this.viewportSystem
        const cssWidth = camera.cssWidth
        const cssHeight = camera.cssHeight

        const gl = this.gl
        this.resetGLState(gl)

        gl.useProgram(this.shader.program)

        WebGLOrbitRenderer.ortho(this.projection, 0, cssWidth, cssHeight, 0, -1, 1)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniform4f(this.shader.uniforms.color, 0.39, 0.58, 0.92, 0.2)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 2, gl.FLOAT, false, 0, 0)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.disable(gl.DEPTH_TEST)

        for(const node of this.nodes) {
            if(node.orbit.hideOrbitInDebugDrawing) {
                continue
            }

            const sceneNode = this.engine.getSceneNode(node.entity)
            const parentEntity = sceneNode?.parent?.entity
            if(!parentEntity) {
                continue
            }

            const [cx, cy, cz] = getAbsolute(parentEntity, this.engine!)
            const orbit = node.orbit

            const center = camera.project(cx, cy, cz)
            if(!center) {
                continue
            }

            const boundingRadius = orbit.radius * (1 + orbit.eccentricity)
            const screenRadius = boundingRadius * center.scale

            if(
                center.x + screenRadius < 0 ||
                center.x - screenRadius > cssWidth ||
                center.y + screenRadius < 0 ||
                center.y - screenRadius > cssHeight
            ) {
                continue
            }

            const segments = Math.max(24, Math.round(screenRadius / 4))
            const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)
            const b = orbit.semiMinorAxis
            const focusOffset = orbit.radius * orbit.eccentricity

            const points = new Float32Array((segments + 1) * 2)
            for(let i = 0; i <= segments; i++) {
                const angle = (i / segments) * TWO_PI
                const x = orbit.radius * Math.cos(angle) - focusOffset
                const y = b * Math.sin(angle)
                const rx = x * cosA - y * sinA
                const ry = x * sinA + y * cosA
                const x1 = rx * cosL - ry * cosI * sinL
                const y1 = rx * sinL + ry * cosI * cosL
                const projected = camera.project(cx + x1, cy + y1, cz + ry * sinI)
                if(projected) {
                    points[i * 2] = projected.x
                    points[i * 2 + 1] = projected.y
                }
            }

            gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW)
            gl.drawArrays(gl.LINE_STRIP, 0, segments + 1)
        }

        gl.disable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
        gl.disableVertexAttribArray(this.shader.attribs.position)
    }

    private static ortho(out: Float32Array, left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
        const w = right - left
        const h = top - bottom
        const d = far - near
        out[0] = 2 / w
        out[1] = 0
        out[2] = 0
        out[3] = 0
        out[4] = 0
        out[5] = 2 / h
        out[6] = 0
        out[7] = 0
        out[8] = 0
        out[9] = 0
        out[10] = -2 / d
        out[11] = 0
        out[12] = -(right + left) / w
        out[13] = -(top + bottom) / h
        out[14] = -(far + near) / d
        out[15] = 1
        return out
    }

    protected getCullMargin(_node: WebGLOrbitNode): number {
        return 0
    }

    protected shouldCullNode(_node: WebGLOrbitNode, _projected: any, _worldPos: any): boolean {
        return false
    }

    protected shouldSkipProjection(_node: WebGLOrbitNode, _cameraDistance: number, _cameraScale: number): boolean {
        return false
    }

    constructor(viewport: ViewportSystem) {
        super(
            viewport,
            [PositionComponent, OrbitComponent],
            (entity) => {
                const pos = entity.getComponent(PositionComponent)!
                const orbit = entity.getComponent(OrbitComponent)!
                const color = entity.getComponent(ColorComponent) ?? new ColorComponent()
                return new WebGLOrbitNode(entity, pos, orbit, color)
            },
        )
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.vertexBuffer) {
                this.gl.deleteBuffer(this.vertexBuffer)
                this.vertexBuffer = null
            }
        }
        return super.removeFromEngine()
    }
}
