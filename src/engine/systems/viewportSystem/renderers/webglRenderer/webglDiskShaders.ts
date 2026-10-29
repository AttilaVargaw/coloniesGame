import { ShaderProgram } from "./ShaderProgram"
import { buildShaderProgram } from "./webglSphereShaders"

export const DISK_VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
in vec2 aTexCoord;
in mat4 aInstanceModel;
in vec3 aInstanceColor;
in vec4 aInstanceUV;
uniform mat4 uView;
uniform mat4 uProjection;
out vec2 vTexCoord;
out vec4 vInstanceUV;
out vec3 vInstanceColor;

void main() {
    vTexCoord = aTexCoord;
    vInstanceUV = aInstanceUV;
    vInstanceColor = aInstanceColor;
    vec4 pos = uProjection * uView * aInstanceModel * vec4(aPosition, 0.0, 1.0);
    gl_Position = pos;
}`;

export const DISK_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
in vec2 vTexCoord;
in vec4 vInstanceUV;
in vec3 vInstanceColor;
uniform sampler2D uRingTexture;
uniform float uInnerRadiusRatio;
out vec4 fragColor;

void main() {
    float dist = length(vTexCoord - 0.5) * 2.0;
    if(dist > 1.0 || dist < uInnerRadiusRatio) {
        discard;
    }

    vec2 atlasCoord = vInstanceUV.xy + vTexCoord * (vInstanceUV.zw - vInstanceUV.xy);
    vec4 tex = texture(uRingTexture, atlasCoord);
    vec3 color = tex.rgb * vInstanceColor;
    float alpha = tex.a * 0.9;

    fragColor = vec4(color, alpha);
}`;

interface DiskAttribs {
    position: number;
    texCoord: number;
    instanceModel: number;
    instanceColor: number;
    instanceUV: number;
    [key: string]: number;
}

interface DiskUniforms {
    view: WebGLUniformLocation | null;
    projection: WebGLUniformLocation | null;
    ringTexture: WebGLUniformLocation | null;
    innerRadiusRatio: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export type { DiskAttribs, DiskUniforms }

export function createDiskShaderProgram(gl: WebGL2RenderingContext): ShaderProgram<DiskAttribs, DiskUniforms> {
    return buildShaderProgram(gl, DISK_VERTEX_SHADER_SOURCE, DISK_FRAGMENT_SHADER_SOURCE, [
        ["position", "aPosition"],
        ["texCoord", "aTexCoord"],
        ["instanceModel", "aInstanceModel"],
        ["instanceColor", "aInstanceColor"],
        ["instanceUV", "aInstanceUV"],
    ], [
        ["view", "uView"],
        ["projection", "uProjection"],
        ["ringTexture", "uRingTexture"],
        ["innerRadiusRatio", "uInnerRadiusRatio"],
    ])
}
