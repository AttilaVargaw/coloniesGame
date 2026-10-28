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
import type { ProjectedPoint } from "@/lib/camera"
import { mat4, type vec3 } from "gl-matrix"

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

        mat4.ortho(this.projection, 0, cssWidth, cssHeight, 0, -1, 1)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniform4f(this.shader.uniforms.color, 0.39, 0.58, 0.92, 0.2)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 2, gl.FLOAT, false, 0, 0)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.disable(gl.DEPTH_TEST)

        for(const { node } of this.getProjectedCacheEntries()) {
            if(node.orbit.hideOrbitInDebugDrawing) {
                continue
            }

            const sceneNode = this.engine.getSceneNode(node.entity)
            const parentEntity = sceneNode?.parent?.entity
            if(!parentEntity) {
                continue
            }

            const c = getAbsolute(parentEntity, this.engine!)
            const orbit = node.orbit

            const center = camera.project(c)
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
                const projectedPoint = camera.project([c[0] + x1, c[1] + ry * sinI, c[2] + y1])
                if(projectedPoint) {
                    points[i * 2] = projectedPoint.x
                    points[i * 2 + 1] = projectedPoint.y
                }
            }

            gl.bufferData(gl.ARRAY_BUFFER, points, gl.STREAM_DRAW)
            gl.drawArrays(gl.LINE_STRIP, 0, segments + 1)
        }

        gl.disable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
        gl.disableVertexAttribArray(this.shader.attribs.position)
    }

    protected getCullMargin(_node: WebGLOrbitNode): number {
        return 0
    }

    protected shouldCullNode(node: WebGLOrbitNode, _projected: ProjectedPoint, _worldPos: vec3): boolean {
        if(!this.engine || !this.viewportSystem.camera) {
            return false
        }

        const sceneNode = this.engine.getSceneNode(node.entity)
        const parentEntity = sceneNode?.parent?.entity
        if(!parentEntity) {
            return true
        }

        const c = getAbsolute(parentEntity, this.engine)
        const orbit = node.orbit
        const camera = this.viewportSystem.camera
        const cssWidth = camera.cssWidth
        const cssHeight = camera.cssHeight

        const center = camera.project(getAbsolute(parentEntity, this.engine))
        if(!center) {
            return true
        }

        const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)
        const b = orbit.semiMinorAxis
        const focusOffset = orbit.radius * orbit.eccentricity

        const testAngles = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2]
        for(const angle of testAngles) {
            const x = orbit.radius * Math.cos(angle) - focusOffset
            const y = b * Math.sin(angle)
            const rx = x * cosA - y * sinA
            const ry = x * sinA + y * cosA
            const x1 = rx * cosL - ry * cosI * sinL
            const y1 = rx * sinL + ry * cosI * cosL
            const projected = camera.project([c[0] + x1, c[1] + ry * sinI, c[2] + y1])
            if(projected) {
                const margin = 10
                if(
                    projected.x >= -margin &&
                    projected.x <= cssWidth + margin &&
                    projected.y >= -margin &&
                    projected.y <= cssHeight + margin
                ) {
                    return false
                }
            }
        }

        return true
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
