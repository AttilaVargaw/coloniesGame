import { Engine } from "@/engine/core/engine";
import { ViewportSystem } from "../../viewportSystem";
import { WebGLRectRenderer } from "./webglRectRenderer";
import { WebGLSphereRenderer } from "./webglSphereRenderer";

export class WebglRenderManager {
    private readonly sphereRenderer: WebGLSphereRenderer
    private readonly rectRenderer: WebGLRectRenderer
    private engine: Engine | null = null

    constructor(private viewport: ViewportSystem) {
        this.sphereRenderer = new WebGLSphereRenderer(this.viewport)
        this.rectRenderer = new WebGLRectRenderer(this.viewport)
    }

    addToEngine(engine: Engine) {
        this.sphereRenderer.addToEngine(engine).init()
        this.rectRenderer.addToEngine(engine).init()

        this.engine = engine

        const gl = this.engine.getCanvas("webgl2")!.getContext("webgl2")!
        gl.enable(gl.DEPTH_TEST)
    }

    removeFromEngine() {
        this.sphereRenderer.removeFromEngine()
        this.rectRenderer.removeFromEngine()
    }

    getRectRenderer(): WebGLRectRenderer {
        return this.rectRenderer
    }

    render() {
        const glCanvas = this.engine?.getCanvas("webgl2")!
        const canvas = this.engine!.getCanvas("2d")!

        const gl = glCanvas.getContext("webgl2")!
        const ctx = canvas.getContext("2d")!

        if(glCanvas.width !== canvas.width || glCanvas.height !== canvas.height) {
            glCanvas.width = canvas.width
            glCanvas.height = canvas.height
            gl.viewport(0, 0, canvas.width, canvas.height)
            glCanvas.style.width = canvas.style.width
            glCanvas.style.height = canvas.style.height
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        this.sphereRenderer.beginFrame()
        this.rectRenderer.beginFrame()
        this.projectNodes()

        this.sphereRenderer.drawNodes()
        this.rectRenderer.drawNodes()

        const camera = this.viewport.camera

        ctx.drawImage(glCanvas, 0, 0, camera.cssWidth, camera.cssHeight)
    }

    projectNodes() {
        this.sphereRenderer.projectNodes()
        this.rectRenderer.projectNodes()
    }
}
