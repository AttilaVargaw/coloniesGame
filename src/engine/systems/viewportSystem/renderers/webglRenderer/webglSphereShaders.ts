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
in float aInstanceCloudPage;

uniform mat4 uView;
uniform mat4 uProjection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uRoughness;
uniform sampler2D uCloudTexture;
uniform float uTime;

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
out float vCloudPage;

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
    vCloudPage = aInstanceCloudPage;
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
in float vCloudPage;

uniform sampler2D uTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uRoughness;
uniform sampler2D uCloudTexture;
uniform sampler2D uNormalMap;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uCameraPosition;
uniform vec3 uTintColor;
uniform vec3 uPaletteColor;
uniform float uTintAlpha;
uniform float uTime;

layout(location = 0) out vec4 fragColor;

vec2 rotateUV(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 centered = uv - 0.5;
    return vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + 0.5;
}

void main() {
    vec3 geometricNormal = normalize(vNormal);
    float u = 0.5 + atan(geometricNormal.z, geometricNormal.x) / (2.0 * PI);
    float v = 0.5 + asin(geometricNormal.y) / PI;
    vec2 texCoord = vec2(u, v) * vTexScale + vTexOffset;
    vec2 nightTexCoord = vec2(u, v) * vNightTexScale + vNightTexOffset;
    vec2 roughnessTexCoord = vec2(u, v) * vRoughnessTexScale + vRoughnessTexOffset;

    vec3 T = normalize(cross(geometricNormal, vec3(0.0, 1.0, 0.0)));
    if(length(T) < 0.001) T = normalize(cross(geometricNormal, vec3(1.0, 0.0, 0.0)));
    vec3 B = cross(geometricNormal, T);
    mat3 tBN = mat3(T, B, geometricNormal);
    vec3 mappedNormal = normalize(tBN * (texture(uNormalMap, texCoord).rgb * 2.0 - 1.0));
    float NdotL = dot(geometricNormal, vLightDir);
    float cosTheta = smoothstep(-0.05, 0.05, NdotL);
    vec3 normal = normalize(mix(geometricNormal, mappedNormal, cosTheta));
    vec3 viewDir = normalize(uCameraPosition - vWorldPos);
    float NdotV = abs(dot(normal, viewDir));

    float fresnel = pow(1.0 - NdotV, 3.0) * 0.25;

    vec3 dayColor = texture(uTexture, texCoord).rgb;
    vec3 nightColor = texture(uNightTexture, nightTexCoord).rgb * 0.3;
    float roughness = texture(uRoughness, roughnessTexCoord).r;
    vec3 rim = uLightColor * fresnel * dayColor * cosTheta;

    if(vEmissive > 0.5) {
        vec3 color = dayColor + rim;
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));
        fragColor = vec4(mix(color, color * uTintColor, uTintAlpha), 1.0);
    } else {
        float diff = max(NdotL, 0.0);

        vec3 halfVec = normalize(vLightDir + viewDir);
        float NdotH = dot(normal, halfVec);
        float specPower = mix(8.0, 128.0, 1.0 - roughness);
        vec3 specular = uLightColor * pow(max(NdotH, 0.0), specPower) * (0.5 + 0.5 * (1.0 - roughness));

        vec3 lit = dayColor * uLightColor * diff + specular * cosTheta;
        vec3 ambient = dayColor * uAmbientColor;

        vec3 color = mix(ambient + rim, lit + rim, diff);
        color = mix(color, nightColor, 1.0 - diff);

        if(vCloudPage > -0.5) {
            vec2 cloudUV = rotateUV(texCoord, uTime * 0.02);
            float cloudAlpha = texture(uCloudTexture, cloudUV).a;
            float cloudLight = smoothstep(-0.1, 0.2, NdotL);
            vec3 cloudColor = mix(ambient + rim, lit + rim, cloudLight);
            color = mix(color, cloudColor, cloudAlpha * 0.7 * cosTheta);
        }

        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0 / 2.2));

        float atmosphere = pow(1.0 - NdotV, 4.0) * 0.25;
        vec3 atmColor = mix(vec3(0.3, 0.6, 1.0), uPaletteColor, 0.5);
        fragColor = vec4(color + atmColor * atmosphere * (1.0 - vEmissive) * cosTheta, 1.0);
        fragColor = vec4(mix(fragColor.rgb, fragColor.rgb * uTintColor, uTintAlpha), 1.0);
    }
}`;