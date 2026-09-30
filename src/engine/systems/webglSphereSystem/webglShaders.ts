export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

in mat4 aInstanceModel;
in mat3 aInstanceNormalMatrix;
in vec3 aInstanceLightDir;
in vec2 aInstanceTexOffset;
in vec2 aInstanceTexScale;
in vec2 aInstanceNightTexOffset;
in vec2 aInstanceNightTexScale;
in float aInstanceEmissive;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform sampler2D uTexture;
uniform sampler2D uNightTexture;

out vec3 vNormal;
out vec3 vLightDir;
out float vEmissive;
out vec3 vWorldPos;
out vec2 vTexOffset;
out vec2 vTexScale;
out vec2 vNightTexOffset;
out vec2 vNightTexScale;

#define PI 3.14159265359

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vLightDir = normalize(aInstanceLightDir);
    vEmissive = aInstanceEmissive;
    vWorldPos = worldPos.xyz;
    vTexOffset = aInstanceTexOffset;
    vTexScale = aInstanceTexScale;
    vNightTexOffset = aInstanceNightTexOffset;
    vNightTexScale = aInstanceNightTexScale;
    gl_Position = uProjection * uView * worldPos;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

#define PI 3.14159265359

in vec3 vNormal;
in vec3 vLightDir;
in float vEmissive;
in vec3 vWorldPos;
in vec2 vTexOffset;
in vec2 vTexScale;
in vec2 vNightTexOffset;
in vec2 vNightTexScale;

uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPosition - vWorldPos);
    float NdotL = dot(normal, vLightDir);
    float NdotV = abs(dot(normal, viewDir));

    float fresnel = pow(1.0 - NdotV, 3.0) * 0.25;

    float u = 0.5 + atan(normal.z, normal.x) / (2.0 * PI);
    float v = 0.5 + asin(normal.y) / PI;
    vec2 texCoord = vec2(u, v) * vTexScale + vTexOffset;
    vec2 nightTexCoord = vec2(u, v) * vNightTexScale + vNightTexOffset;

    vec3 dayColor = texture(uTexture, texCoord).rgb;
    vec3 nightColor = texture(uNightTexture, nightTexCoord).rgb * 1.8;
    vec3 rim = uLightColor * fresnel * dayColor;

    if(vEmissive > 0.5) {
        vec3 color = dayColor + rim;
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));
        fragColor = vec4(color, 1.0);
    } else {
        float diffuse = max(NdotL, 0.0);
        float terminator = smoothstep(-0.05, 0.15, NdotL);

        vec3 lit = dayColor * uLightColor * diffuse;
        vec3 ambient = dayColor * uAmbientColor;

        vec3 color = mix(ambient + rim, lit + rim, terminator);
        color = mix(color, nightColor, 1.0 - terminator);

        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));

        fragColor = vec4(color, 1.0);
    }
}
`;

export interface ShaderProgram {
    program: WebGLProgram
    attribs: {
        position: number
        normal: number
        instanceModel: number
        instanceNormalMatrix: number
        instanceLightDir: number
        instanceTexOffset: number
        instanceTexScale: number
        instanceNightTexOffset: number
        instanceNightTexScale: number
        instanceEmissive: number
    }
    uniforms: {
        view: WebGLUniformLocation | null
        projection: WebGLUniformLocation | null
        lightColor: WebGLUniformLocation | null
        ambientColor: WebGLUniformLocation | null
        cameraPosition: WebGLUniformLocation | null
        texture: WebGLUniformLocation | null
        nightTexture: WebGLUniformLocation | null
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
    }

    return { program, attribs, uniforms }
}
