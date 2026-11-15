import { buildShaderProgram } from "./webglSphereShaders"
import type { ShaderProgram } from "./ShaderProgram"

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
in vec2 aTexCoord;

in vec2 aInstanceTranslation;
in vec2 aInstanceScale;
in float aInstanceRotation;
in vec2 aInstanceTexOffset;
in vec2 aInstanceTexScale;
in vec4 aInstanceColor;
in vec3 aInstanceTintColor;
in float aInstanceTintAlpha;
in vec3 aInstanceLightDir;
in vec3 aInstanceLightColor;

uniform mat4 uProjection;
uniform sampler2D uTexture;
uniform vec3 uAmbientColor;

out vec2 vAtlasUV;
out vec4 vColor;
out vec3 vTintColor;
out float vTintAlpha;
out vec3 vLightDir;
out vec3 vLightColor;
out vec3 vAmbientColor;

void main() {
    float cosR = cos(aInstanceRotation);
    float sinR = sin(aInstanceRotation);
    vec2 rotatedPos = vec2(
        aPosition.x * cosR - aPosition.y * sinR,
        aPosition.x * sinR + aPosition.y * cosR
    );
    vec2 worldPos = rotatedPos * aInstanceScale + aInstanceTranslation;
    gl_Position = uProjection * vec4(worldPos, 0.0, 1.0);
    vAtlasUV = vec2(aTexCoord.x, aTexCoord.y) * aInstanceTexScale + aInstanceTexOffset;
    vColor = aInstanceColor;
    vTintColor = aInstanceTintColor;
    vTintAlpha = aInstanceTintAlpha;
    vLightDir = aInstanceLightDir;
    vLightColor = aInstanceLightColor;
    vAmbientColor = uAmbientColor;
}`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 vAtlasUV;
in vec4 vColor;
in vec3 vTintColor;
in float vTintAlpha;
in vec3 vLightDir;
in vec3 vLightColor;
in vec3 vAmbientColor;

uniform sampler2D uTexture;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 texColor = texture(uTexture, vAtlasUV);
    vec3 tinted = texColor.rgb * vColor.rgb;
    tinted = mix(tinted, tinted * vTintColor, vTintAlpha);

    float diff = max(0.0, dot(vec3(0.0, 0.0, 1.0), vLightDir)) * 0.7 + 0.3;
    vec3 lit = tinted * vLightColor * diff + tinted * vAmbientColor * 0.6;

    fragColor = vec4(lit, texColor.a * vColor.a);
}`;

interface RectAttribs {
    position: number;
    texCoord: number;
    instanceTranslation: number;
    instanceScale: number;
    instanceRotation: number;
    instanceTexOffset: number;
    instanceTexScale: number;
    instanceColor: number;
    instanceTintColor: number;
    instanceTintAlpha: number;
    instanceLightDir: number;
    instanceLightColor: number;
    [key: string]: number;
}

interface RectUniforms {
    projection: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    ambientColor: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export type RectShaderProgram = ShaderProgram<RectAttribs, RectUniforms>

export type { RectAttribs, RectUniforms }

export function createRectShaderProgram(gl: WebGL2RenderingContext): RectShaderProgram {
    return buildShaderProgram<RectAttribs, RectUniforms>(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
        ["instanceTranslation", "aInstanceTranslation"],
        ["instanceScale", "aInstanceScale"],
        ["instanceRotation", "aInstanceRotation"],
        ["instanceTexOffset", "aInstanceTexOffset"],
        ["instanceTexScale", "aInstanceTexScale"],
        ["instanceColor", "aInstanceColor"],
        ["instanceTintColor", "aInstanceTintColor"],
        ["instanceTintAlpha", "aInstanceTintAlpha"],
        ["instanceLightDir", "aInstanceLightDir"],
        ["instanceLightColor", "aInstanceLightColor"],
    ], [
        ["projection", "uProjection"],
        ["texture", "uTexture"],
        ["ambientColor", "uAmbientColor"],
    ])
}
