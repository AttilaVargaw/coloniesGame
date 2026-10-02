
import { Entity } from "@/engine/entities/entity";
import { PositionComponent } from "@/engine/components/position";
import { BaseRenderer } from "../baseRenderer";
import { RenderableNode } from "../renderableNode";

export abstract class WebGLBaseRenderer<N extends RenderableNode> extends BaseRenderer<N> {
    gl: WebGL2RenderingContext | null = null
    protected glCanvas!: HTMLCanvasElement
    protected canvas!: HTMLCanvasElement
    protected glDrawnThisFrame = false
    protected instanceBuffer: WebGLBuffer | null = null

    protected initCanvases(): void {
        if(!this.engine) return
        this.glCanvas = this.engine.getCanvas("webgl2") as HTMLCanvasElement
        this.canvas = this.engine.getCanvas("2d") as HTMLCanvasElement
    }

    protected initContext(): WebGL2RenderingContext {
        if(!this.glCanvas) {
            throw new Error("WebGL not available")
        }
        const gl = this.glCanvas.getContext("webgl2", { alpha: true })
        if(!gl) {
            throw new Error("WebGL not supported")
        }
        this.gl = gl
        return gl
    }

    beginFrame(): void {
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

        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }

    endFrame(): void {
        const ctx = this.canvas.getContext("2d")
        if(ctx && this.glCanvas.width > 0 && this.glCanvas.height > 0) {
            const camera = this.viewportSystem.camera
            ctx.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
        }
    }

    protected endFrameFallback(): void {
        const ctx = this.canvas.getContext("2d")
        if(ctx) {
            const camera = this.viewportSystem.camera

            ctx.drawImage(this.glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
        }
    }

    resize(width: number, height: number): void {
        if(!this.gl) return
        this.gl.viewport(0, 0, width, height)
    }

    protected resetGLState(gl: WebGL2RenderingContext): void {
        // gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.CULL_FACE)
        gl.disable(gl.BLEND)
        gl.disable(gl.SCISSOR_TEST)
        gl.colorMask(true, true, true, true)
        // gl.depthMask(true)
    }

    removeFromEngine(): this {
        if(this.gl) {
            if(this.instanceBuffer) {
                this.gl.deleteBuffer(this.instanceBuffer)
                this.instanceBuffer = null
            }
        }
        return super.removeFromEngine()
    }

    protected getWorldPosition2(entity: Entity): [number, number, number] {
        const sceneNode = this.engine?.getSceneNode(entity)
        if(sceneNode) {
            const pos = sceneNode.getWorldPosition()
            return [pos[0], pos[1], pos[2]]
        }
        const pos = entity.getComponent(PositionComponent)
        return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
    }

    protected get glContext(): WebGL2RenderingContext | null {
        return this.gl
    }
}
