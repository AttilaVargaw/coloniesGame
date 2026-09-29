import { compileShader } from "./webglShaders";

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
in vec2 aTexCoord;

uniform vec2 uTranslation;
uniform vec2 uScale;
uniform float uRotation;
uniform vec2 uTextureOffset;
uniform vec2 uTextureScale;
uniform vec4 uColor;

out vec2 vTexCoord;
out vec2 vTextureOffset;
out vec2 vTextureScale;
out vec4 vColor;

uniform mat4 uProjection;

void main() {
    float cosR = cos(uRotation);
    float sinR = sin(uRotation);
    vec2 rotatedPos = vec2(
        aPosition.x * cosR - aPosition.y * sinR,
        aPosition.x * sinR + aPosition.y * cosR
    );
    vec2 worldPos = rotatedPos * uScale + uTranslation;
    gl_Position = uProjection * vec4(worldPos, 0.0, 1.0);
    vTexCoord = aTexCoord;
    vTextureOffset = uTextureOffset;
    vTextureScale = uTextureScale;
    vColor = uColor;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 vTexCoord;
in vec2 vTextureOffset;
in vec2 vTextureScale;
in vec4 vColor;

uniform sampler2D uTexture;

layout(location = 0) out vec4 fragColor;

void main() {
    vec2 atlasUV = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * vTextureScale + vTextureOffset;
    vec4 texColor = texture(uTexture, atlasUV);
    fragColor = vec4(texColor.rgb * vColor.rgb, texColor.a * vColor.a);
}
`;

export interface RectShaderProgram {
    program: WebGLProgram;
    attribs: {
        position: number;
        texCoord: number;
    };
    uniforms: {
        projection: WebGLUniformLocation | null;
        texture: WebGLUniformLocation | null;
        translation: WebGLUniformLocation | null;
        scale: WebGLUniformLocation | null;
        rotation: WebGLUniformLocation | null;
        textureOffset: WebGLUniformLocation | null;
        textureScale: WebGLUniformLocation | null;
        color: WebGLUniformLocation | null;
    };
}

export function createRectShaderProgram(gl: WebGL2RenderingContext): RectShaderProgram {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Shader program link error: ${info}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const attribs = {
        position: gl.getAttribLocation(program, "aPosition"),
        texCoord: gl.getAttribLocation(program, "aTexCoord"),
    };

    const uniforms = {
        projection: gl.getUniformLocation(program, "uProjection"),
        texture: gl.getUniformLocation(program, "uTexture"),
        translation: gl.getUniformLocation(program, "uTranslation"),
        scale: gl.getUniformLocation(program, "uScale"),
        rotation: gl.getUniformLocation(program, "uRotation"),
        textureOffset: gl.getUniformLocation(program, "uTextureOffset"),
        textureScale: gl.getUniformLocation(program, "uTextureScale"),
        color: gl.getUniformLocation(program, "uColor"),
    };

    return { program, attribs, uniforms };
}
