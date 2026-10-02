import { compileShader } from "./webgShaders";

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
in vec2 aTexCoord;

in vec2 aInstanceTranslation;
in vec2 aInstanceScale;
in float aInstanceRotation;
in vec2 aInstanceTexOffset;
in vec2 aInstanceTexScale;
in vec4 aInstanceColor;

uniform mat4 uProjection;
uniform sampler2D uTexture;

out vec2 vAtlasUV;
out vec4 vColor;

void main() {
    float cosR = cos(aInstanceRotation);
    float sinR = sin(aInstanceRotation);
    vec2 rotatedPos = vec2(
        aPosition.x * cosR - aPosition.y * sinR,
        aPosition.x * sinR + aPosition.y * cosR
    );
    vec2 worldPos = rotatedPos * aInstanceScale + aInstanceTranslation;
    gl_Position = uProjection * vec4(worldPos, 0.0, 1.0);
    vAtlasUV = vec2(aTexCoord.x, 1.0 - aTexCoord.y) * aInstanceTexScale + aInstanceTexOffset;
    vColor = aInstanceColor;
}`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 vAtlasUV;
in vec4 vColor;

uniform sampler2D uTexture;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 texColor = texture(uTexture, vAtlasUV);
    fragColor = vec4(texColor.rgb * vColor.rgb, texColor.a * vColor.a);
}`;

export interface RectShaderProgram {
    program: WebGLProgram;
    attribs: {
        position: number;
        texCoord: number;
        instanceTranslation: number;
        instanceScale: number;
        instanceRotation: number;
        instanceTexOffset: number;
        instanceTexScale: number;
        instanceColor: number;
    };
    uniforms: {
        projection: WebGLUniformLocation | null;
        texture: WebGLUniformLocation | null;
    };
}

export function createRectShaderProgram(gl: WebGL2RenderingContext): RectShaderProgram {
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
        texCoord: gl.getAttribLocation(program, "aTexCoord"),
        instanceTranslation: gl.getAttribLocation(program, "aInstanceTranslation"),
        instanceScale: gl.getAttribLocation(program, "aInstanceScale"),
        instanceRotation: gl.getAttribLocation(program, "aInstanceRotation"),
        instanceTexOffset: gl.getAttribLocation(program, "aInstanceTexOffset"),
        instanceTexScale: gl.getAttribLocation(program, "aInstanceTexScale"),
        instanceColor: gl.getAttribLocation(program, "aInstanceColor"),
    };

    const uniforms = {
        projection: gl.getUniformLocation(program, "uProjection"),
        texture: gl.getUniformLocation(program, "uTexture"),
    };

    return { program, attribs, uniforms };
}
