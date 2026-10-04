import { ShaderProgram } from "./ShaderProgram"
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE, buildShaderProgram } from "./webglSphereShaders"

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
    return buildShaderProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["normal", "aNormal"],
        ["instanceModel", "aInstanceModel"],
        ["instanceNormalMatrix", "aInstanceNormalMatrix"],
        ["instanceLightDir", "aInstanceLightDir"],
        ["instanceLightColor", "aInstanceLightColor"],
        ["instanceTexOffset", "aInstanceTexOffset"],
        ["instanceTexScale", "aInstanceTexScale"],
        ["instanceNightTexOffset", "aInstanceNightTexOffset"],
        ["instanceNightTexScale", "aInstanceNightTexScale"],
        ["instanceEmissiveCloud", "aInstanceEmissiveCloud"],
    ], [
        ["view", "uView"],
        ["projection", "uProjection"],
        ["ambientColor", "uAmbientColor"],
        ["cameraPosition", "uCameraPosition"],
        ["texture", "uTexture"],
        ["nightTexture", "uNightTexture"],
        ["roughness", "uRoughness"],
        ["cloudTexture", "uCloudTexture"],
        ["normalMap", "uNormalMap"],
        ["paletteColor", "uPaletteColor"],
        ["tintColor", "uTintColor"],
        ["tintAlpha", "uTintAlpha"],
        ["time", "uTime"],
        ["bloomBrightness", "uBloomBrightness"],
        ["bloomThreshold", "uBloomThreshold"],
    ])
}
