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

const orbitColor = new Float32Array([0.39, 0.58, 0.92, 0.05])

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
        gl.uniform4f(this.shader.uniforms.color, orbitColor[0], orbitColor[1], orbitColor[2], orbitColor[3])

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

            const c = getAbsolute(parentEntity, this.engine!)
            const orbit = node.orbit

            const center = camera.project(c)

            const boundingRadius = orbit.radius * (1 + orbit.eccentricity)
            const screenRadius = center ? boundingRadius * center.scale : boundingRadius

            if(center) {
                if(
                    center.x + screenRadius < 0 ||
                    center.x - screenRadius > cssWidth ||
                    center.y + screenRadius < 0 ||
                    center.y - screenRadius > cssHeight
                ) {
                    continue
                }
            }

            const segments = Math.max(24, Math.round(screenRadius / 4))
            const { cosI, sinI, cosA, sinA, cosL, sinL } = precomputeOrbitalTrig(orbit)
            const b = orbit.semiMinorAxis
            const focusOffset = orbit.radius * orbit.eccentricity

            const points = new Float32Array((segments + 1) * 2)
            let firstVisibleX = 0
            let firstVisibleY = 0
            let lastX = 0
            let lastY = 0
            let started = false

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
                    lastX = projectedPoint.x
                    lastY = projectedPoint.y
                    if(!started) {
                        firstVisibleX = projectedPoint.x
                        firstVisibleY = projectedPoint.y
                        started = true
                    }
                } else if(started) {
                    points[i * 2] = lastX
                    points[i * 2 + 1] = lastY
                } else {
                    points[i * 2] = firstVisibleX
                    points[i * 2 + 1] = firstVisibleY
                }
            }

            if(!started) {
                continue
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

    protected shouldCullNode(_node: WebGLOrbitNode, _projected: ProjectedPoint, _worldPos: vec3): boolean {
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
            if(this.shader) this.gl.deleteProgram(this.shader.program)
            if(this.vertexBuffer) {
                this.gl.deleteBuffer(this.vertexBuffer)
                this.vertexBuffer = null
            }
        }
        return super.removeFromEngine()
    }
}
