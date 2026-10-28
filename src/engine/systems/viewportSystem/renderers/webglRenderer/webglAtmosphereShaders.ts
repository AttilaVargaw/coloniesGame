export const ATMOSPHERE_VERTEX_SHADER_SOURCE = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

in mat4 aInstanceModel;
in mat3 aInstanceNormalMatrix;
in vec3 aInstanceLightDir;
in vec3 aInstanceLightColor;
in vec4 aInstanceAtmosParams; // thickness, planetRadius, rayleigh, scaleHeight
in vec3 aInstanceSkyColor;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uCameraPosition;

out vec3 vNormal;
out vec3 vLightDir;
out vec3 vLightColor;
out vec3 vWorldPos;
out vec4 vAtmosParams;
out vec3 vSkyColor;

void main() {
    vec4 worldPos = aInstanceModel * vec4(aPosition, 1.0);
    vNormal = normalize(aInstanceNormalMatrix * aNormal);
    vLightDir = normalize(aInstanceLightDir);
    vLightColor = aInstanceLightColor;
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
in vec3 vLightColor;
in vec3 vWorldPos;
in vec4 vAtmosParams; // thickness, planetRadius, rayleigh, scaleHeight
in vec3 vSkyColor;

uniform vec3 uCameraPosition;
uniform float uHdrMode;

layout(location = 0) out vec4 fragColor;

// Rayleigh scattering coefficients (wavelength dependent: blue scatters more)
vec3 rayleighCoefficients(vec3 skyColor) {
    // Blue channel scatters strongest, red weakest
    return vec3(0.2, 0.5, 0.8) * skyColor;
}

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
    float NdotL = dot(normal, vLightDir);

    float r = length(vWorldPos);
    float altitude = (r - planetRadius) / thickness;
    altitude = clamp(altitude, 0.0, 1.0);

    float sh = scaleHeight > 0.0 ? scaleHeight : thickness * 0.35;
    // Exponential density falloff with scale height
    float density = exp(-altitude * (thickness / sh));

    float fresnel = pow(1.0 - abs(NdotV), 5.0);

    float cosTheta = dot(-viewDir, vLightDir);

    // Rayleigh phase
    float phaseR = rayleighPhase(cosTheta);

    // Mie (Henyey-Greenstein) forward scattering - whitish halo toward the sun
    float g = 0.76;
    float denom = 1.0 + g * g - 2.0 * g * cosTheta;
    denom = max(denom, 0.001);
    float phaseM = (1.0 - g * g) / pow(denom, 1.5);
    phaseM = clamp(phaseM, 0.0, 4.0);

    float slant = 1.0 / max(abs(NdotV), 0.02);

    // Wavelength-dependent Rayleigh: blue scatters more than red
    vec3 rayleighCoeff = rayleighCoefficients(vSkyColor);

    // Combined optical depth (Rayleigh + Mie)
    float opticalDepth = density * slant * (rayleigh * 0.6 + 0.15);
    float transmission = exp(-opticalDepth);

    // Night-side dimming: atmosphere above the unlit hemisphere glows much less
    float dayFactor = mix(0.05, 1.0, pow(max(NdotL, 0.0), 0.4));

    // Sunset shift: when viewing through more atmosphere (grazing), light reddens
    float sunset = pow(1.0 - max(NdotL, 0.0), 2.0);
    vec3 sunsetTint = vec3(1.0, 0.7, 0.3); // warm orange/red
    vec3 lightColorTinted = mix(vLightColor, vLightColor * sunsetTint, sunset * 0.5);

    vec3 scatteredR = rayleighCoeff * lightColorTinted * phaseR * density * rayleigh * 1.8 * (1.0 - transmission) * fresnel;
    vec3 scatteredM = vec3(0.95, 0.95, 1.0) * lightColorTinted * phaseM * density * 0.30 * (1.0 - transmission) * fresnel;
    vec3 scattered = (scatteredR + scatteredM) * dayFactor;

    float rim = pow(1.0 - abs(NdotV), 3.0) * 0.5;
    vec3 color = scattered + vSkyColor * rim * 0.35 * dayFactor;

    float scatter = dot(scattered, vec3(0.333));
    float alpha = clamp(rim * 1.6 + scatter * 0.5, 0.0, 1.0);

    if(uHdrMode > 0.5) {
        color *= 2.0;
        fragColor = vec4(color, alpha);
    } else {
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));
        fragColor = vec4(color, alpha);
    }
}`;

import { buildShaderProgram } from "./webglSphereShaders"
import type { ShaderProgram, ShaderProgramAttribs, ShaderProgramUniforms } from "./ShaderProgram"

export interface AtmosphereShaderAttribs extends ShaderProgramAttribs {
    instanceAtmosParams: number;
    instanceSkyColor: number;
    instanceLightColor: number;
    instanceLightDir: number;
}

export interface AtmosphereShaderUniforms extends ShaderProgramUniforms {
    cameraPosition: WebGLUniformLocation | null;
    hdrMode: WebGLUniformLocation | null;
}

export function createAtmosphereShaderProgram(gl: WebGL2RenderingContext): ShaderProgram<AtmosphereShaderAttribs, AtmosphereShaderUniforms> {
    return buildShaderProgram<AtmosphereShaderAttribs, AtmosphereShaderUniforms>(gl, ATMOSPHERE_VERTEX_SHADER_SOURCE, ATMOSPHERE_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["normal", "aNormal"],
        ["instanceModel", "aInstanceModel"],
        ["instanceNormalMatrix", "aInstanceNormalMatrix"],
        ["instanceLightDir", "aInstanceLightDir"],
        ["instanceLightColor", "aInstanceLightColor"],
        ["instanceAtmosParams", "aInstanceAtmosParams"],
        ["instanceSkyColor", "aInstanceSkyColor"],
    ], [
        ["view", "uView"],
        ["projection", "uProjection"],
        ["cameraPosition", "uCameraPosition"],
        ["hdrMode", "uHdrMode"],
    ])
}
