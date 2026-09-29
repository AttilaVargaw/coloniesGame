export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec2 vTexCoord;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vNormal = normalize(uNormalMatrix * aNormal);
    vTexCoord = aTexCoord;
    gl_Position = uProjection * uView * worldPos;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec3 vNormal;
in vec2 vTexCoord;

uniform sampler2D uTexture;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec2 uTextureOffset;
uniform vec2 uTextureScale;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    float NdotL = dot(normal, uLightDirection);
    float diffuse = max(NdotL, 0.0) * 0.85 + 0.15;

    vec2 atlasUV = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * uTextureScale + uTextureOffset;
    vec3 texColor = texture(uTexture, atlasUV).rgb;
    vec3 color = texColor * (uAmbientColor + uLightColor * diffuse);

    fragColor = vec4(color, 1.0);
}
`;

export interface ShaderProgram {
    program: WebGLProgram
    attribs: {
        position: number
        normal: number
        texCoord: number
    }
    uniforms: {
        model: WebGLUniformLocation | null
        view: WebGLUniformLocation | null
        projection: WebGLUniformLocation | null
        normalMatrix: WebGLUniformLocation | null
        texture: WebGLUniformLocation | null
        lightDirection: WebGLUniformLocation | null
        lightColor: WebGLUniformLocation | null
        ambientColor: WebGLUniformLocation | null
        textureOffset: WebGLUniformLocation | null
        textureScale: WebGLUniformLocation | null
    }
}

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
        texCoord: gl.getAttribLocation(program, "aTexCoord"),
    }

    const uniforms = {
        model: gl.getUniformLocation(program, "uModel"),
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        normalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
        texture: gl.getUniformLocation(program, "uTexture"),
        lightDirection: gl.getUniformLocation(program, "uLightDirection"),
        lightColor: gl.getUniformLocation(program, "uLightColor"),
        ambientColor: gl.getUniformLocation(program, "uAmbientColor"),
        textureOffset: gl.getUniformLocation(program, "uTextureOffset"),
        textureScale: gl.getUniformLocation(program, "uTextureScale"),
    }

    return { program, attribs, uniforms }
}
