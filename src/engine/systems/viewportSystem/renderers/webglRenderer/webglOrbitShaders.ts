import { buildShaderProgram } from "./webglSphereShaders"
import type { ShaderProgram } from "./ShaderProgram"

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
uniform mat4 uProjection;
void main() {
    gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
uniform vec4 uColor;
layout(location = 0) out vec4 fragColor;
void main() {
    fragColor = uColor;
}`;

interface OrbitAttribs {
    position: number;
    [key: string]: number;
}

interface OrbitUniforms {
    projection: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export type OrbitShaderProgram = ShaderProgram<OrbitAttribs, OrbitUniforms>

export type { OrbitAttribs, OrbitUniforms }

export function createOrbitShaderProgram(gl: WebGL2RenderingContext): OrbitShaderProgram {
    return buildShaderProgram<OrbitAttribs, OrbitUniforms>(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
    ], [
        ["projection", "uProjection"],
        ["color", "uColor"],
    ])
}
