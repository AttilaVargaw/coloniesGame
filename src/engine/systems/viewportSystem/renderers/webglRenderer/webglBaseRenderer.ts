
import { BaseRenderer } from "../baseRenderer";
import { RenderableNode } from "../renderableNode";

export function sortGroupsByDepth<K, T extends { depth: number }>(groups: Map<K, T[]>): Array<[K, T[]]> {
    return Array.from(groups.entries()).sort((a, b) => {
        const avgA = a[1].reduce((s, i) => s + i.depth, 0) / a[1].length
        const avgB = b[1].reduce((s, i) => s + i.depth, 0) / b[1].length
        return avgB - avgA
    })
}

export abstract class WebGLBaseRenderer<N extends RenderableNode> extends BaseRenderer<N> {
    gl: WebGL2RenderingContext | null = null
    protected glCanvas!: HTMLCanvasElement
    protected canvas!: HTMLCanvasElement
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

    resize(width: number, height: number): void {
        if(!this.gl) return
        this.gl.viewport(0, 0, width, height)
    }

    protected endFrameFallback(): void {
        const ctx = this.canvas.getContext("2d")
        if(ctx) {
            const camera = this.viewportSystem.camera

            ctx.drawImage(this.glCanvas, 0, 0, camera!.cssWidth, camera!.cssHeight)
        }
    }

    protected get glContext(): WebGL2RenderingContext | null {
        return this.gl
    }

    protected resetGLState(gl: WebGL2RenderingContext): void {
        gl.disable(gl.CULL_FACE)
        gl.disable(gl.BLEND)
        gl.disable(gl.SCISSOR_TEST)
        gl.disable(gl.DEPTH_TEST)
        gl.depthMask(true)
        gl.colorMask(true, true, true, true)
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
}
