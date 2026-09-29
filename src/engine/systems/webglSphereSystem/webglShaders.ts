export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

in mat4 aInstanceModel;
in mat3 aInstanceNormalMatrix;
in vec3 aInstanceLightDir;
in vec2 aInstanceTexOffset;
in vec2 aInstanceTexScale;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform sampler2D uTexture;

out vec3 vNormal;
out vec2 vTexCoord;
out vec3 vLightDir;

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vTexCoord = vec2(aTexCoord.x, 1.0 - aTexCoord.y) * aInstanceTexScale + aInstanceTexOffset;
    vLightDir = normalize(aInstanceLightDir);
    gl_Position = uProjection * uView * worldPos;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec3 vNormal;
in vec2 vTexCoord;
in vec3 vLightDir;

uniform sampler2D uTexture;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    float NdotL = dot(normal, vLightDir);
    float diffuse = max(NdotL, 0.0) * 0.85 + 0.15;

    vec3 texColor = texture(uTexture, vTexCoord).rgb;
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
        instanceModel: number
        instanceNormalMatrix: number
        instanceLightDir: number
        instanceTexOffset: number
        instanceTexScale: number
    }
    uniforms: {
        view: WebGLUniformLocation | null
        projection: WebGLUniformLocation | null
        lightColor: WebGLUniformLocation | null
        ambientColor: WebGLUniformLocation | null
        texture: WebGLUniformLocation | null
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
        instanceModel: gl.getAttribLocation(program, "aInstanceModel"),
        instanceNormalMatrix: gl.getAttribLocation(program, "aInstanceNormalMatrix"),
        instanceLightDir: gl.getAttribLocation(program, "aInstanceLightDir"),
        instanceTexOffset: gl.getAttribLocation(program, "aInstanceTexOffset"),
        instanceTexScale: gl.getAttribLocation(program, "aInstanceTexScale"),
    }

    const uniforms = {
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        lightColor: gl.getUniformLocation(program, "uLightColor"),
        ambientColor: gl.getUniformLocation(program, "uAmbientColor"),
        texture: gl.getUniformLocation(program, "uTexture"),
    }

    return { program, attribs, uniforms }
}
