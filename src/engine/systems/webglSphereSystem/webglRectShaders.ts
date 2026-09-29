import { compileShader } from "./webglShaders";

export const VERTEX_SHADER_SOURCE = `
    attribute vec2 aPosition;
    attribute vec2 aTexCoord;

    uniform mat4 uProjection;
    uniform vec2 uTranslation;
    uniform vec2 uScale;
    uniform float uRotation;

    varying vec2 vTexCoord;

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
    }
`;

export const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;

    varying vec2 vTexCoord;

    uniform sampler2D uTexture;
    uniform vec2 uTextureOffset;
    uniform vec2 uTextureScale;
    uniform vec4 uColor;

    void main() {
        vec2 atlasUV = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * uTextureScale + uTextureOffset;
        vec4 texColor = texture2D(uTexture, atlasUV);
        gl_FragColor = vec4(texColor.rgb * uColor.rgb, texColor.a * uColor.a);
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
        translation: WebGLUniformLocation | null;
        scale: WebGLUniformLocation | null;
        rotation: WebGLUniformLocation | null;
        texture: WebGLUniformLocation | null;
        textureOffset: WebGLUniformLocation | null;
        textureScale: WebGLUniformLocation | null;
        color: WebGLUniformLocation | null;
    };
}

export function createRectShaderProgram(gl: WebGLRenderingContext): RectShaderProgram {
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
        translation: gl.getUniformLocation(program, "uTranslation"),
        scale: gl.getUniformLocation(program, "uScale"),
        rotation: gl.getUniformLocation(program, "uRotation"),
        texture: gl.getUniformLocation(program, "uTexture"),
        textureOffset: gl.getUniformLocation(program, "uTextureOffset"),
        textureScale: gl.getUniformLocation(program, "uTextureScale"),
        color: gl.getUniformLocation(program, "uColor"),
    };

    return { program, attribs, uniforms };
}
