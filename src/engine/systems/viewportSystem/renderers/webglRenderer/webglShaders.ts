import { ShaderProgram } from "./ShaderProgram"
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from "./webglSphereShaders"

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(`Shader compile error: ${info}`)
    }
    return shader
}

export function createShaderProgram(gl: WebGL2RenderingContext): ShaderProgram {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw new Error(`Shader program link error: ${info}`)
    }

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    const attribs = {
        position: gl.getAttribLocation(program, "aPosition"),
        normal: gl.getAttribLocation(program, "aNormal"),
        instanceModel: gl.getAttribLocation(program, "aInstanceModel"),
        instanceNormalMatrix: gl.getAttribLocation(program, "aInstanceNormalMatrix"),
        instanceLightDir: gl.getAttribLocation(program, "aInstanceLightDir"),
        instanceTexOffset: gl.getAttribLocation(program, "aInstanceTexOffset"),
        instanceTexScale: gl.getAttribLocation(program, "aInstanceTexScale"),
        instanceNightTexOffset: gl.getAttribLocation(program, "aInstanceNightTexOffset"),
        instanceNightTexScale: gl.getAttribLocation(program, "aInstanceNightTexScale"),
        instanceEmissive: gl.getAttribLocation(program, "aInstanceEmissive"),
    }

    const uniforms = {
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        lightColor: gl.getUniformLocation(program, "uLightColor"),
        ambientColor: gl.getUniformLocation(program, "uAmbientColor"),
        cameraPosition: gl.getUniformLocation(program, "uCameraPosition"),
        texture: gl.getUniformLocation(program, "uTexture"),
        nightTexture: gl.getUniformLocation(program, "uNightTexture"),
        tintColor: gl.getUniformLocation(program, "uTintColor"),
        tintAlpha: gl.getUniformLocation(program, "uTintAlpha"),
    }

    return { program, attribs, uniforms }
}
