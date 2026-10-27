export const ATMOSPHERE_VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

in mat4 aInstanceModel;
in mat3 aInstanceNormalMatrix;
in vec3 aInstanceLightDir;
in vec4 aInstanceAtmosParams; // thickness, planetRadius, rayleigh, scaleHeight
in vec3 aInstanceSkyColor;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uCameraPosition;
uniform vec3 uLightColor;

out vec3 vNormal;
out vec3 vLightDir;
out vec3 vWorldPos;
out vec4 vAtmosParams;
out vec3 vSkyColor;

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vLightDir = normalize(aInstanceLightDir);
    vWorldPos = worldPos.xyz;
    vAtmosParams = aInstanceAtmosParams;
    vSkyColor = aInstanceSkyColor;
    gl_Position = uProjection * uView * worldPos;
}`;

export const ATMOSPHERE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

#define PI 3.14159265359

in vec3 vNormal;
in vec3 vLightDir;
in vec3 vWorldPos;
in vec4 vAtmosParams; // thickness, planetRadius, rayleigh, scaleHeight
in vec3 vSkyColor;

uniform vec3 uCameraPosition;
uniform vec3 uLightColor;
uniform float uHdrMode;

layout(location = 0) out vec4 fragColor;

float rayleighPhase(float cosTheta) {
    return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
}

void main() {
    if(vAtmosParams.x <= 0.0) {
        discard;
    }

    float thickness = vAtmosParams.x;
    float planetRadius = vAtmosParams.y;
    float rayleigh = vAtmosParams.z;
    float scaleHeight = vAtmosParams.w;

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPosition - vWorldPos);
    float NdotV = dot(normal, viewDir);

    float r = length(vWorldPos);
    float altitude = (r - planetRadius) / thickness;
    altitude = clamp(altitude, 0.0, 1.0);

    float sh = scaleHeight > 0.0 ? scaleHeight : thickness * 0.35;
    float density = exp(-altitude * (thickness / sh));

    float fresnel = pow(1.0 - abs(NdotV), 5.0);

    float cosTheta = dot(-viewDir, vLightDir);
    float phase = rayleighPhase(cosTheta);

    float slant = 1.0 / max(abs(NdotV), 0.02);
    float opticalDepth = density * slant * rayleigh * 0.6;
    float transmission = exp(-opticalDepth);

    vec3 scattered = vSkyColor * uLightColor * phase * density * rayleigh * 1.8 * (1.0 - transmission);
    scattered *= fresnel;

    float rim = pow(1.0 - abs(NdotV), 3.0) * 0.5;
    float scatter = dot(scattered, vec3(0.333));
    vec3 color = scattered + vSkyColor * rim * 0.35;

    if(uHdrMode > 0.5) {
        color *= 2.0;
        fragColor = vec4(color, clamp(rim * 1.5 + scatter * 0.5, 0.0, 1.0));
    } else {
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));
        fragColor = vec4(color, clamp(rim * 1.5 + scatter * 0.5, 0.0, 1.0));
    }
}`;

import { buildShaderProgram } from "./webglSphereShaders"
import type { ShaderProgram, ShaderProgramAttribs, ShaderProgramUniforms } from "./ShaderProgram"

export interface AtmosphereShaderAttribs extends ShaderProgramAttribs {
    instanceAtmosParams: number;
    instanceSkyColor: number;
}

export interface AtmosphereShaderUniforms extends ShaderProgramUniforms {
    cameraPosition: WebGLUniformLocation | null;
    lightColor: WebGLUniformLocation | null;
    hdrMode: WebGLUniformLocation | null;
}

export function createAtmosphereShaderProgram(gl: WebGL2RenderingContext): ShaderProgram<AtmosphereShaderAttribs, AtmosphereShaderUniforms> {
    return buildShaderProgram<AtmosphereShaderAttribs, AtmosphereShaderUniforms>(gl, ATMOSPHERE_VERTEX_SHADER_SOURCE, ATMOSPHERE_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["normal", "aNormal"],
        ["instanceModel", "aInstanceModel"],
        ["instanceNormalMatrix", "aInstanceNormalMatrix"],
        ["instanceLightDir", "aInstanceLightDir"],
        ["instanceAtmosParams", "aInstanceAtmosParams"],
        ["instanceSkyColor", "aInstanceSkyColor"],
    ], [
        ["view", "uView"],
        ["projection", "uProjection"],
        ["cameraPosition", "uCameraPosition"],
        ["lightColor", "uLightColor"],
        ["hdrMode", "uHdrMode"],
    ])
}
