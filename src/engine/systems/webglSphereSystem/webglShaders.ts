export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

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
out vec2 vTexCoord;
out vec3 vLightDir;
out float vEmissive;
out vec3 vWorldPos;
out vec2 vNightTexCoord;

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vTexCoord = vec2(aTexCoord.x, aTexCoord.y) * aInstanceTexScale + aInstanceTexOffset;
    vLightDir = normalize(aInstanceLightDir);
    vEmissive = aInstanceEmissive;
    vWorldPos = worldPos.xyz;
    vNightTexCoord = vec2(aTexCoord.x, aTexCoord.y) * aInstanceNightTexScale + aInstanceNightTexOffset;
    gl_Position = uProjection * uView * worldPos;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec3 vNormal;
in vec2 vTexCoord;
in vec3 vLightDir;
in float vEmissive;
in vec3 vWorldPos;
in vec2 vNightTexCoord;

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

    float diffuse = max(NdotL, 0.0);
    float terminator = smoothstep(-0.05, 0.15, NdotL);

    float fresnel = pow(1.0 - NdotV, 3.0) * 0.25;

    vec3 dayColor = texture(uTexture, vTexCoord).rgb;
    vec3 nightColor = texture(uNightTexture, vNightTexCoord).rgb * 1.8;
    vec3 lit = dayColor * uLightColor * diffuse;
    vec3 ambient = dayColor * uAmbientColor;
    vec3 rim = uLightColor * fresnel * dayColor;

    vec3 color = mix(ambient + rim, lit + rim, terminator);
    color = mix(color, nightColor, 1.0 - terminator);
    color += dayColor * vEmissive;

    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

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
        texCoord: gl.getAttribLocation(program, "aTexCoord"),
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
