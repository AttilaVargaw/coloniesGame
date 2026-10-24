import { Engine } from "@/engine/core/engine";
import { ViewportSystem } from "../../viewportSystem";
import { WebGLRectRenderer } from "./webglRectRenderer";
import { WebGLSphereRenderer } from "./webglSphereRenderer";
import { WebGLOrbitRenderer } from "./webglOrbitRenderer";
import { createToneMapShaderProgram } from "./webglSphereShaders";

export class WebglRenderManager {
    private readonly sphereRenderer: WebGLSphereRenderer
    private readonly rectRenderer: WebGLRectRenderer
    private readonly orbitRenderer: WebGLOrbitRenderer
    private engine: Engine | null = null

    private hdrFramebuffer: WebGLFramebuffer | null = null
    private hdrTexture: WebGLTexture | null = null
    private hdrDepthBuffer: WebGLRenderbuffer | null = null
    private hdrWidth = 0
    private hdrHeight = 0
    private hdrSupported = false
    private toneMapShader: ReturnType<typeof createToneMapShaderProgram> | null = null
    private toneMapQuadBuffer: WebGLBuffer | null = null
    private toneMapQuadIndexBuffer: WebGLBuffer | null = null
    private toneMapQuadIndexCount = 0

    constructor(private viewport: ViewportSystem) {
        this.sphereRenderer = new WebGLSphereRenderer(this.viewport)
        this.rectRenderer = new WebGLRectRenderer(this.viewport)
        this.orbitRenderer = new WebGLOrbitRenderer(this.viewport)
    }

    addToEngine(engine: Engine) {
        this.sphereRenderer.addToEngine(engine).init()
        this.rectRenderer.addToEngine(engine).init()
        this.orbitRenderer.addToEngine(engine).init()

        this.engine = engine

        const gl = this.engine.getCanvas("webgl2")!.getContext("webgl2")!
        gl.enable(gl.DEPTH_TEST)

        this.hdrSupported = !!gl.getExtension("EXT_color_buffer_float")
        if(this.hdrSupported) {
            this.toneMapShader = createToneMapShaderProgram(gl)
            this.initToneMapQuad(gl)
        }

        this.sphereRenderer.setHdr(this.hdrSupported)
        this.sphereRenderer.setHdrFramebuffer(null)
    }

    removeFromEngine() {
        this.sphereRenderer.removeFromEngine()
        this.rectRenderer.removeFromEngine()
        this.orbitRenderer.removeFromEngine()

        const gl = this.engine?.getCanvas("webgl2")?.getContext("webgl2")
        if(gl) {
            if(this.hdrFramebuffer) gl.deleteFramebuffer(this.hdrFramebuffer)
            if(this.hdrTexture) gl.deleteTexture(this.hdrTexture)
            if(this.hdrDepthBuffer) gl.deleteRenderbuffer(this.hdrDepthBuffer)
            if(this.toneMapQuadBuffer) gl.deleteBuffer(this.toneMapQuadBuffer)
            if(this.toneMapQuadIndexBuffer) gl.deleteBuffer(this.toneMapQuadIndexBuffer)
        }

        this.engine = null
    }

    getRectRenderer(): WebGLRectRenderer {
        return this.rectRenderer
    }

    setShowBloom(value: boolean) {
        this.sphereRenderer.setShowBloom(value)
    }

    render() {
        const glCanvas = this.engine?.getCanvas("webgl2")!
        const canvas = this.engine!.getCanvas("2d")!

        const gl = glCanvas.getContext("webgl2")!
        const ctx = canvas.getContext("2d")!

        if(glCanvas.width !== canvas.width || glCanvas.height !== canvas.height) {
            glCanvas.width = canvas.width
            glCanvas.height = canvas.height
            glCanvas.style.width = canvas.style.width
            glCanvas.style.height = canvas.style.height
        }

        const debugManager = this.engine?.getDebugManager()
        const hdrEnabled = this.hdrSupported && (debugManager?.debugflags.showHDR ?? true)

        this.sphereRenderer.setHdr(hdrEnabled)

        if(hdrEnabled) {
            this.ensureHdrFramebuffer(gl)
            this.sphereRenderer.setHdrFramebuffer(this.hdrFramebuffer)
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFramebuffer)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        } else {
            this.sphereRenderer.setHdrFramebuffer(null)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        }

        this.sphereRenderer.beginFrame()
        this.rectRenderer.beginFrame()
        this.orbitRenderer.beginFrame()
        this.projectNodes()

        this.orbitRenderer.drawNodes()
        if(hdrEnabled) {
            // Everything renders into the same HDR depth buffer so spheres
            // (drawn last) correctly occlude rects/orbits where they overlap,
            // matching the LDR draw order: orbit → rect → sphere.
        this.rectRenderer.drawNodes()
        this.sphereRenderer.drawNodes()

            // Tone-map the HDR scene to the canvas. The fullscreen tone-map
            // quad covers every pixel, so no clear is needed.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
            this.toneMapPass(gl)
        } else {
            this.rectRenderer.drawNodes()
            this.sphereRenderer.drawNodes()
        }

        const { cssHeight, cssWidth } = this.viewport.camera!

        ctx.drawImage(glCanvas, 0, 0, cssWidth, cssHeight)
    }

    private initToneMapQuad(gl: WebGL2RenderingContext): void {
        const vertices = new Float32Array([
            -1, -1, 0, 0,
            1, -1, 1, 0,
            -1, 1, 0, 1,
            1, 1, 1, 1,
        ])
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3])

        this.toneMapQuadBuffer = gl.createBuffer()!
        gl.bindBuffer(gl.ARRAY_BUFFER, this.toneMapQuadBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        this.toneMapQuadIndexBuffer = gl.createBuffer()!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.toneMapQuadIndexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

        this.toneMapQuadIndexCount = indices.length
    }

    private ensureHdrFramebuffer(gl: WebGL2RenderingContext): void {
        const width = gl.canvas.width
        const height = gl.canvas.height
        if(this.hdrFramebuffer && this.hdrWidth === width && this.hdrHeight === height) {
            return
        }
        if(this.hdrFramebuffer) {
            gl.deleteFramebuffer(this.hdrFramebuffer)
            this.hdrFramebuffer = null
        }
        if(this.hdrTexture) {
            gl.deleteTexture(this.hdrTexture)
            this.hdrTexture = null
        }
        if(this.hdrDepthBuffer) {
            gl.deleteRenderbuffer(this.hdrDepthBuffer)
            this.hdrDepthBuffer = null
        }

        this.hdrFramebuffer = gl.createFramebuffer()!
        this.hdrTexture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, this.hdrTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        this.hdrDepthBuffer = gl.createRenderbuffer()!
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.hdrDepthBuffer)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFramebuffer)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.hdrTexture, 0)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.hdrDepthBuffer)

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
        if(status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`HDR framebuffer incomplete: ${status}`)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        this.hdrWidth = width
        this.hdrHeight = height
    }

    private toneMapPass(gl: WebGL2RenderingContext): void {
        if(!this.toneMapShader || !this.hdrTexture || !this.toneMapQuadBuffer || !this.toneMapQuadIndexBuffer) {
            return
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)

        gl.useProgram(this.toneMapShader.program)
        gl.uniform1i(this.toneMapShader.uniforms.texture, 0)
        gl.uniform1f(this.toneMapShader.uniforms.exposure, 1.0)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.hdrTexture)

        // Tone-mapped quad must not write depth, else it clobbers the blitted
        // sphere depth that rects/orbits depth-test against.
        gl.depthMask(false)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.toneMapQuadBuffer)
        gl.enableVertexAttribArray(this.toneMapShader.attribs.position)
        gl.vertexAttribPointer(this.toneMapShader.attribs.position, 2, gl.FLOAT, false, 16, 0)
        gl.enableVertexAttribArray(this.toneMapShader.attribs.texCoord)
        gl.vertexAttribPointer(this.toneMapShader.attribs.texCoord, 2, gl.FLOAT, false, 16, 8)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.toneMapQuadIndexBuffer)
        gl.drawElements(gl.TRIANGLES, this.toneMapQuadIndexCount, gl.UNSIGNED_SHORT, 0)
        gl.disableVertexAttribArray(this.toneMapShader.attribs.position)
        gl.disableVertexAttribArray(this.toneMapShader.attribs.texCoord)

        gl.depthMask(true)
    }

    projectNodes() {
        this.sphereRenderer.projectNodes()
        this.rectRenderer.projectNodes()
        this.orbitRenderer.projectNodes()
    }
}
