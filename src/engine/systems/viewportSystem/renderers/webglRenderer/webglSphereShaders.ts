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
uniform sampler2D uRoughness;

out vec3 vNormal;
out vec3 vLightDir;
out float vEmissive;
out vec3 vWorldPos;
out vec2 vTexOffset;
out vec2 vTexScale;
out vec2 vNightTexOffset;
out vec2 vNightTexScale;
out vec2 vRoughnessTexOffset;
out vec2 vRoughnessTexScale;

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
    vRoughnessTexOffset = aInstanceTexOffset;
    vRoughnessTexScale = aInstanceTexScale;
    gl_Position = uProjection * uView * worldPos;
}`;

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
in vec2 vRoughnessTexOffset;
in vec2 vRoughnessTexScale;

uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uRoughness;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform vec3 uTintColor;
uniform float uTintAlpha;

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
    vec2 roughnessTexCoord = vec2(u, v) * vRoughnessTexScale + vRoughnessTexOffset;

    vec3 dayColor = texture(uTexture, texCoord).rgb;
    vec3 nightColor = texture(uNightTexture, nightTexCoord).rgb * 0.3;
    float roughness = texture(uRoughness, roughnessTexCoord).r;
    vec3 rim = uLightColor * fresnel * dayColor;

    if(vEmissive > 0.5) {
        vec3 color = dayColor + rim;
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));
        fragColor = vec4(mix(color, color * uTintColor, uTintAlpha), 1.0);
    } else {
        float diffuse = max(NdotL, 0.0);
        float terminator = smoothstep(-0.05, 0.15, NdotL);

        vec3 halfVec = normalize(vLightDir + viewDir);
        float NdotH = dot(normal, halfVec);
        float specPower = mix(8.0, 128.0, 1.0 - roughness);
        vec3 specular = uLightColor * pow(max(NdotH, 0.0), specPower) * (0.5 + 0.5 * (1.0 - roughness));

        vec3 lit = dayColor * uLightColor * diffuse + specular;
        vec3 ambient = dayColor * uAmbientColor;

        vec3 color = mix(ambient + rim, lit + rim, terminator);
        color = mix(color, nightColor, 1.0 - terminator);

        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));

        fragColor = vec4(mix(color, color * uTintColor, uTintAlpha), 1.0);
    }
}`;