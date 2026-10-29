import { compileShader } from "./webglShaders"
import type { ShaderProgram, ShaderProgramAttribs, ShaderProgramUniforms } from "./ShaderProgram"

export const VERTEX_SHADER_SOURCE = `#version 300 es
    in vec3 aPosition;
in vec3 aNormal;

in mat4 aInstanceModel;
in mat3 aInstanceNormalMatrix;
in vec3 aInstanceLightDir;
in vec3 aInstanceLightColor;
in vec2 aInstanceTexOffset;
in vec2 aInstanceTexScale;
in vec2 aInstanceNightTexOffset;
in vec2 aInstanceNightTexScale;
in vec3 aInstanceEmissiveCloud;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uRoughness;
uniform sampler2D uCloudTexture;
uniform float uTime;

out vec3 vNormal;
out vec3 vLightDir;
out vec3 vLightColor;
out float vEmissive;
out vec3 vWorldPos;
out vec2 vTexOffset;
out vec2 vTexScale;
out vec2 vNightTexOffset;
out vec2 vNightTexScale;
out float vCloudPage;
out float vRotationAngle;

#define PI 3.14159265359

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vLightDir = normalize(aInstanceLightDir);
    vLightColor = aInstanceLightColor;
    vEmissive = aInstanceEmissiveCloud.x;
    vWorldPos = worldPos.xyz;
    vTexOffset = aInstanceTexOffset;
    vTexScale = aInstanceTexScale;
    vNightTexOffset = aInstanceNightTexOffset;
    vNightTexScale = aInstanceNightTexScale;
    vCloudPage = aInstanceEmissiveCloud.y;
    vRotationAngle = aInstanceEmissiveCloud.z;
    gl_Position = uProjection * uView * worldPos;
} `;

export const BLUR_VERTEX_SHADER_SOURCE = `#version 300 es
    in vec2 aPosition;
in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
} `;

export const BLUR_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform float uIntensity;
out vec4 fragColor;
void main() {
    vec4 color = texture(uTexture, vTexCoord) * 0.2270270270;
    color += texture(uTexture, vTexCoord + uDirection * 1.0) * 0.1945945946;
    color += texture(uTexture, vTexCoord - uDirection * 1.0) * 0.1945945946;
    color += texture(uTexture, vTexCoord + uDirection * 2.0) * 0.1216216216;
    color += texture(uTexture, vTexCoord - uDirection * 2.0) * 0.1216216216;
    color += texture(uTexture, vTexCoord + uDirection * 3.0) * 0.0540540540;
    color += texture(uTexture, vTexCoord - uDirection * 3.0) * 0.0540540540;
    color += texture(uTexture, vTexCoord + uDirection * 4.0) * 0.0162162162;
    color += texture(uTexture, vTexCoord - uDirection * 4.0) * 0.0162162162;
    fragColor = color * uIntensity;
} `;

export const TONE_MAP_VERTEX_SHADER_SOURCE = `#version 300 es
    in vec2 aPosition;
in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
} `;

export const TONE_MAP_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
uniform sampler2D uHdrTexture;
uniform float uExposure;
out vec4 fragColor;

vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec4 hdr = texture(uHdrTexture, vTexCoord);
    vec3 color = ACESFilm(hdr.rgb * uExposure);
    color = pow(color, vec3(1.0 / 2.2));
    fragColor = vec4(color, hdr.a);
} `;

export const EXTRACT_BLOOM_VERTEX_SHADER_SOURCE = `#version 300 es
    in vec2 aPosition;
in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
} `;

export const EXTRACT_BLOOM_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
uniform sampler2D uHdrTexture;
uniform float uBloomThreshold;
out vec4 fragColor;

void main() {
    vec4 hdr = texture(uHdrTexture, vTexCoord);
    float brightness = dot(hdr.rgb, vec3(0.299, 0.587, 0.114));
    float contrib = max(brightness - uBloomThreshold, 0.0);
    fragColor = vec4(vec3(contrib), hdr.a);
} `;

interface BlurAttribs {
    position: number;
    texCoord: number;
    [key: string]: number;
}

interface BlurUniforms {
    texture: WebGLUniformLocation | null;
    direction: WebGLUniformLocation | null;
    intensity: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export function buildShaderProgram<
    A extends Record<string, number> = ShaderProgramAttribs,
    U extends Record<string, WebGLUniformLocation | null> = ShaderProgramUniforms
>(
    gl: WebGL2RenderingContext,
    vertSource: string,
    fragSource: string,
    attribs: Array<[string, string]>,
    uniforms: Array<[string, string]>
): ShaderProgram<A, U> {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertSource)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSource)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw new Error(`Shader program link error: ${info} `)
    }

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    const attribMap: Record<string, number> = {}
    for(const [name, glName] of attribs) {
        attribMap[name] = gl.getAttribLocation(program, glName)
    }

    const uniformMap: Record<string, WebGLUniformLocation | null> = {}
    for(const [name, glName] of uniforms) {
        uniformMap[name] = gl.getUniformLocation(program, glName)
    }

    return { program, attribs: attribMap as A, uniforms: uniformMap as U }
}

export function createBlurShaderProgram(gl: WebGL2RenderingContext): ShaderProgram<BlurAttribs, BlurUniforms> {
    return buildShaderProgram<BlurAttribs, BlurUniforms>(gl, BLUR_VERTEX_SHADER_SOURCE, BLUR_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
    ], [
        ["texture", "uTexture"],
        ["direction", "uDirection"],
        ["intensity", "uIntensity"],
    ])
}

export function createToneMapShaderProgram(gl: WebGL2RenderingContext): ShaderProgram {
    return buildShaderProgram(gl, TONE_MAP_VERTEX_SHADER_SOURCE, TONE_MAP_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
    ], [
        ["texture", "uHdrTexture"],
        ["exposure", "uExposure"],
    ])
}

export function createBloomShaderProgram(gl: WebGL2RenderingContext): ShaderProgram {
    return buildShaderProgram(gl, EXTRACT_BLOOM_VERTEX_SHADER_SOURCE, EXTRACT_BLOOM_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
    ], [
        ["texture", "uHdrTexture"],
        ["bloomThreshold", "uBloomThreshold"],
    ])
}

export const TONE_MAP_BLOOM_VERTEX_SHADER_SOURCE = `#version 300 es
    in vec2 aPosition;
in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
} `;

export const TONE_MAP_BLOOM_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
uniform sampler2D uHdrTexture;
uniform sampler2D uBloomTexture;
uniform float uExposure;
uniform float uBloomIntensity;
out vec4 fragColor;

vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec4 hdr = texture(uHdrTexture, vTexCoord);
    vec3 color = ACESFilm(hdr.rgb * uExposure);
    color = pow(color, vec3(1.0 / 2.2));

    vec4 bloom = texture(uBloomTexture, vTexCoord);
    color += bloom.rgb * uBloomIntensity;

    fragColor = vec4(color, hdr.a);
} `;

export function createToneMapBloomShaderProgram(gl: WebGL2RenderingContext): ShaderProgram {
    return buildShaderProgram(gl, TONE_MAP_BLOOM_VERTEX_SHADER_SOURCE, TONE_MAP_BLOOM_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
    ], [
        ["hdrTexture", "uHdrTexture"],
        ["bloomTexture", "uBloomTexture"],
        ["exposure", "uExposure"],
        ["bloomIntensity", "uBloomIntensity"],
    ])
}

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

#define PI 3.14159265359

in vec3 vNormal;
in vec3 vLightDir;
in vec3 vLightColor;
in float vEmissive;
in vec3 vWorldPos;
in vec2 vTexOffset;
in vec2 vTexScale;
in vec2 vNightTexOffset;
in vec2 vNightTexScale;
in float vCloudPage;
in float vRotationAngle;

uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uRoughness;
uniform sampler2D uCloudTexture;
uniform sampler2D uNormalMap;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform vec3 uTintColor;
uniform float uTintAlpha;
uniform float uTime;
uniform float uHdrMode;

layout(location = 0) out vec4 fragColor;

vec2 rotateUV(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 centered = uv - 0.5;
    return vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + 0.5;
}

vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec3 geometricNormal = normalize(vNormal);
    float u = 0.5 + atan(geometricNormal.z, geometricNormal.x) / (2.0 * PI);
    float v = 0.5 + asin(geometricNormal.y) / PI;
    float spunU = fract(u - vRotationAngle / (2.0 * PI));
    vec2 texCoord = vec2(spunU, v) * vTexScale + vTexOffset;
    vec2 nightTexCoord = vec2(spunU, v) * vNightTexScale + vNightTexOffset;

    vec3 T = normalize(cross(geometricNormal, vec3(0.0, 1.0, 0.0)));
    if(length(T) < 0.001) T = normalize(cross(geometricNormal, vec3(1.0, 0.0, 0.0)));
    vec3 B = cross(geometricNormal, T);
    mat3 tBN = mat3(T, B, geometricNormal);
    vec3 mappedNormal = normalize(tBN * (texture(uNormalMap, texCoord).rgb * 2.0 - 1.0));
    float NdotL = dot(geometricNormal, vLightDir);
    float normalBlend = smoothstep(-0.3, 0.3, NdotL);
    vec3 normal = normalize(mix(geometricNormal, mappedNormal, normalBlend));
    vec3 viewDir = normalize(uCameraPosition - vWorldPos);
    float NdotV = abs(dot(normal, viewDir));

    vec3 dayColor = texture(uTexture, texCoord).rgb;
    vec3 nightColor = texture(uNightTexture, nightTexCoord).rgb;
    float roughness = texture(uRoughness, texCoord).r;

    if(vEmissive > 0.5) {
        vec3 color = dayColor;
        if(uHdrMode > 0.5) {
            // Stars are brighter than planets: scale into HDR range so the
            // brightest core exceeds 1.0 and blooms, but keep most of the
            // disk below ~1.0 so ACES tone mapping preserves surface detail
            // (granulation + sunspots) instead of crushing it to white.
            color *= 7.5;
        } else {
            color = ACESFilm(color);
            color = pow(color, vec3(1.0 / 2.2));
        }
        fragColor = vec4(mix(color, color * uTintColor, uTintAlpha), 1.0);
    } else {
        float diff = max(0.0, NdotL) * 0.9 + 0.1;

    vec3 halfVec = normalize(vLightDir + viewDir);
    vec3 specNormal = mix(geometricNormal, normal, roughness);
    float NdotH = dot(specNormal, halfVec);
        float specPower = mix(6.0, 180.0, 1.0 - roughness);
        vec3 specular = vLightColor * pow(max(NdotH, 0.0), specPower) * (0.6 + 0.4 * (1.0 - roughness));
        // Stronger specular glint on smooth surfaces (ocean/water)
        float glint = smoothstep(0.1, 0.0, roughness);
        specular *= (1.0 + glint * 0.6);

        vec3 lit = dayColor * vLightColor * diff + specular * max(NdotL, 0.0);
        vec3 ambient = dayColor * uAmbientColor * 1.0;

        vec3 color = mix(ambient, lit, diff);
        color = mix(color, nightColor, smoothstep(-0.1, -0.3, NdotL));

        if(vCloudPage > -0.5) {
            vec2 cloudUV = rotateUV(texCoord, uTime * 0.02);
            float cloudAlpha = texture(uCloudTexture, cloudUV).a;
            // Cloud shadows darken the surface beneath thick clouds
            float cloudShadow = clamp(cloudAlpha * 0.5, 0.0, 0.5);
            color *= (1.0 - cloudShadow);
            float cloudLight = smoothstep(-0.1, 0.2, NdotL);
            vec3 cloudColor = mix(ambient, lit, cloudLight);
            color = mix(color, cloudColor, cloudAlpha * 1.5 * max(diff, 0.15));
        }

        if(uHdrMode < 0.5) {
            color = ACESFilm(color);
            color = pow(color, vec3(1.0 / 2.2));
        }

        fragColor = vec4(mix(color, color * uTintColor, uTintAlpha), 1.0);
    }
} `;