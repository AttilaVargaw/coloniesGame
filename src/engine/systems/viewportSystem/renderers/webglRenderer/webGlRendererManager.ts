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
    }

    removeFromEngine() {
        this.sphereRenderer.removeFromEngine()
        this.rectRenderer.removeFromEngine()
    }

    render() {
        // this.sphereRenderer.beginFrame()
        // this.rectRenderer.beginFrame()
        const mainCanvas = this.viewport.camera.context.canvas
        const glCanvas = this.engine?.getCanvas("webgl2")!
        const gl = this.sphereRenderer.gl!

        if(glCanvas.width !== mainCanvas.width || glCanvas.height !== mainCanvas.height) {
            glCanvas.width = mainCanvas.width
            glCanvas.height = mainCanvas.height
            gl.viewport(0, 0, mainCanvas.width, mainCanvas.height)
            glCanvas.style.width = mainCanvas.style.width
            glCanvas.style.height = mainCanvas.style.height
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        this.sphereRenderer.beginFrame()
        this.rectRenderer.beginFrame()
        this.projectNodes()


        this.sphereRenderer.drawNodes()
        this.rectRenderer.drawNodes()

        this.viewport.camera.context.drawImage(this.sphereRenderer.gl!.canvas, 0, 0)
    }

    projectNodes() {
        this.sphereRenderer.projectNodes()
        this.rectRenderer.projectNodes()
    }
}
