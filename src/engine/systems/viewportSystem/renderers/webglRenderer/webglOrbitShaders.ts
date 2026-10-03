import { compileShader } from "./webglShaders";

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

export interface OrbitShaderProgram {
    program: WebGLProgram;
    attribs: {
        position: number;
    };
    uniforms: {
        projection: WebGLUniformLocation | null;
        color: WebGLUniformLocation | null;
    };
}

export function createOrbitShaderProgram(gl: WebGL2RenderingContext): OrbitShaderProgram {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Shader program link error: ${info}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const attribs = {
        position: gl.getAttribLocation(program, "aPosition"),
    };

    const uniforms = {
        projection: gl.getUniformLocation(program, "uProjection"),
        color: gl.getUniformLocation(program, "uColor"),
    };

    return { program, attribs, uniforms };
}
