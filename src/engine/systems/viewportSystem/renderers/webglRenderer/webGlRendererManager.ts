import { ViewportSystem } from "../../viewportSystem";
import { WebGLRectRenderer } from "./webglRectRenderer";
import { WebGLSphereRenderer } from "./webglSphereRenderer";

export class WebglRenderManager {
    readonly sphereRenderer: WebGLSphereRenderer
    readonly rectRenderer: WebGLRectRenderer

    constructor(private viewport: ViewportSystem) {
        this.sphereRenderer = new WebGLSphereRenderer(this.viewport)
        this.rectRenderer = new WebGLRectRenderer(this.viewport)
    }
}
