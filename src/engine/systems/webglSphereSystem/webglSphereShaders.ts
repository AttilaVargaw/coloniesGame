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