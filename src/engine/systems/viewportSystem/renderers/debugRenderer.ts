import { System } from "../../system"
import { drawCameraGizmo, drawCameraTarget } from "../drawCameraGizmo"
import { drawOrbits } from "../renderOrbits"
import { drawJumpGraph } from "./drawJumpGraph"
import { ViewportSystem } from "../viewportSystem"
import Camera from "@/lib/camera"

import { WebGLRectRenderer } from "./webglRenderer/webglRectRenderer"
import { DebugManager } from "@/engine/lib/debugManager"
import { Engine } from "@/engine/core/engine"

export class DebugRenderer extends System {
    private fpsFrameCount = 0
    private fpsLastTime = performance.now()
    private currentFps = 0
    private frameTimeSamples: number[] = []
    private camera: Camera
    private rectRenderer: WebGLRectRenderer
    private debugManager: DebugManager 

    constructor(private viewport: ViewportSystem) {
        super()

        this.camera = viewport.camera
        this.rectRenderer = viewport.webglManager.getRectRenderer()
        this.debugManager = viewport.engineRef?.getDebugManager()!
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine)
        this.debugManager = engine.getDebugManager()

        return this
    }

    update(_dt: number) {
        this.fpsFrameCount++
        const now = performance.now()
        const elapsed = now - this.fpsLastTime
        if(elapsed >= 500) {
            this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed)
            this.fpsFrameCount = 0
            this.fpsLastTime = now
        }
    }

    private drawFpsCounter(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.font = "16px monospace"
        ctx.fillStyle = "#0f0"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        ctx.fillText(`FPS: ${this.currentFps}`, 10, 10)
        ctx.restore()
    }

    private drawFrameTime(ctx: CanvasRenderingContext2D) {
        if(!this.frameTimeSamples.length) {
            return
        }

        const avg = this.frameTimeSamples.reduce((a, b) => a + b, 0) / this.frameTimeSamples.length
        const max = Math.max(...this.frameTimeSamples)
        ctx.save()
        ctx.font = "14px monospace"
        ctx.fillStyle = "#0ff"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"
        const y = this.debugManager.debugflags.showFpsCounter ? 32 : 10
        ctx.fillText(`Frame: ${avg.toFixed(1)}ms (${(1000 / Math.max(1, avg)).toFixed(0)}fps) max ${max.toFixed(1)}ms`, 64, y)
        ctx.restore()
    }

    private drawCullingOverlay(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.font = "14px monospace"
        ctx.fillStyle = "#0f0"
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        const lines = [
            `Distance: ${this.camera?.distance.toFixed(0)}`,
            `Rect projected: ${this.rectRenderer.projectedCount}`,
            `Rect culled: ${this.rectRenderer.culledCount}`,
        ] as const

        let y = 30
        for(const line of lines) {
            ctx.fillText(line, 10, y)
            y += 18
        }

        ctx.restore()
    }

    render() {
        const {
            debugflags: {
                drawOrbits: isDrawOrbit,
                showCameraGizmo,
                showCameraTarget,
                showFpsCounter,
                showJumpGraph,
                showCullingOverlay,
                showFrameTime }
        } = this.debugManager

        const { context } = this.camera

        if(showCameraGizmo) {
            drawCameraGizmo(context, this.camera)
        }

        if(showCameraTarget) {
            drawCameraTarget(context, this.camera)
        }

        if(isDrawOrbit) {
            drawOrbits(context, this.viewport.engineRef!, this.camera)
        }

        if(showJumpGraph) {
            drawJumpGraph(context, this.viewport.engineRef!, this.camera)
        }

        if(showFpsCounter) {
            this.drawFpsCounter(context)
        }

        if(showFrameTime) {
            this.drawFrameTime(this.camera.context)
        }

        if(showCullingOverlay) {
            this.drawCullingOverlay(context)
        }
    }
}