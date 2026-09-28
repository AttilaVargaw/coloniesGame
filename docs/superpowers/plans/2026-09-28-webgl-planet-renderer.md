# WebGL Planet Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebGL-rendered sphere layer behind the existing 2D canvas so planets are drawn as lit 3D spheres while orbits, labels, and UI remain on the 2D canvas.

**Architecture:** A new `WebGLSphereSystem` manages a second `<canvas>` with a WebGL context. A new `WebGLSphereRenderer` renders only entities with a `TextureComponent` as textured, lit spheres using a simple directional-light shader. The existing 2D canvas stays on top for orbits, labels, gizmos, and bloom post-processing.

**Tech Stack:** Raw WebGL 1 (no external 3D library), custom shaders, custom `vec3`/`mat4` utilities in `src/engine/lib/`.

**Spec:** Replaces the current 2D `CircleRenderer` planet shading with correct per-pixel sphere lighting. Asteroids/mining sites without textures remain on the 2D canvas via the existing `CircleRenderer`.

## Global Constraints

- TypeScript strict mode
- No new dependencies (use raw WebGL, not three.js / babylon / etc.)
- Module aliases: `@engine/*` → `src/engine/**`
- Engine layer (`src/engine/**`) must not import React, DOM, or browser APIs beyond what is already used

## Review Focus

1. **Sphere lighting from all camera angles** — night texture gradient must stay locked to the actual planet-to-star vector, not screen space
2. **Depth sorting between 2D and WebGL layers** — large planets must not incorrectly occlude smaller foreground bodies
3. **Texture mapping seam** — UV sphere must render without visible texture seams at the poles or date line
4. **Canvas resize behavior** — WebGL viewport must match 2D canvas size on window resize
5. **Performance with ~30 unique rendered bodies** — instanced or batched draw calls should keep frame time flat

---

## File Structure

```
src/
├── engine/
│   ├── lib/
│   │   ├── vec3.ts               # Vector math: sub, add, dot, cross, normalize, length
│   │   └── mat4.ts               # 4x4 matrix utilities: perspective, lookAt, multiply, invert, transpose
│   └── systems/
│       └── webglSphereSystem/
│           ├── webglSphereSystem.ts      # Owns WebGL canvas/context, manages render loop pass
│           ├── webglSphereRenderer.ts    # Extends BaseRenderer, projects nodes, draws WebGL spheres
│           ├── webglSphereGeometry.ts    # Generates indexed UV sphere mesh (positions, normals, uvs, indices)
│           └── webglShaders.ts           # Vertex + fragment shader sources for textured lit sphere
docs/
└── superpowers/
    └── plans/
        2026-09-28-webgl-planet-renderer.md   # this file
```

---

### Task 1: Vector and matrix math utilities

**Files:**
- Create: `src/engine/lib/vec3.ts`
- Create: `src/engine/lib/mat4.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `vec3` helpers and `mat4` helpers used by geometry, camera matrix conversion, and shader uniforms

- [ ] **Step 1: Write `src/engine/lib/vec3.ts`**

```ts
export type Vec3 = [number, number, number]

export const vec3 = {
    create: (x = 0, y = 0, z = 0): Vec3 => [x, y, z],
    clone: (v: Vec3): Vec3 => [v[0], v[1], v[2]],
    set: (out: Vec3, x: number, y: number, z: number): Vec3 => { out[0] = x; out[1] = y; out[2] = z; return out },
    add: (out: Vec3, a: Vec3, b: Vec3): Vec3 => { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out },
    sub: (out: Vec3, a: Vec3, b: Vec3): Vec3 => { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out },
    scale: (out: Vec3, v: Vec3, s: number): Vec3 => { out[0] = v[0] * s; out[1] = v[1] * s; out[2] = v[2] * s; return out },
    dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
        out[0] = a[1] * b[2] - a[2] * b[1]
        out[1] = a[2] * b[0] - a[0] * b[2]
        out[2] = a[0] * b[1] - a[1] * b[0]
        return out
    },
    length: (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
    normalize: (out: Vec3, v: Vec3): Vec3 => {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
        if(len > 0) { const inv = 1 / len; out[0] = v[0] * inv; out[1] = v[1] * inv; out[2] = v[2] * inv }
        return out
    },
    transformMat4: (out: Vec3, v: Vec3, m: Float32Array): Vec3 => {
        const x = v[0], y = v[1], z = v[2]
        out[0] = m[0] * x + m[1] * y + m[2] * z + m[3]
        out[1] = m[4] * x + m[5] * y + m[6] * z + m[7]
        out[2] = m[8] * x + m[9] * y + m[10] * z + m[11]
        return out
    },
}
```

- [ ] **Step 2: Write `src/engine/lib/mat4.ts`**

```ts
export type Mat4 = Float32Array

export const mat4 = {
    create: (): Mat4 => new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]),

    perspective: (out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 => {
        const f = 1.0 / Math.tan(fovY / 2)
        out[0] = f / aspect
        out[1] = 0
        out[2] = 0
        out[3] = 0
        out[4] = 0
        out[5] = f
        out[6] = 0
        out[7] = 0
        out[8] = 0
        out[9] = 0
        out[10] = (far + near) / (near - far)
        out[11] = -1
        out[12] = 0
        out[13] = 0
        out[14] = (2 * far * near) / (near - far)
        out[15] = 0
        return out
    },

    lookAt: (out: Mat4, eye: Vec3, center: Vec3, up: Vec3): Mat4 => {
        const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2]
        let len = Math.sqrt(zx * zx + zy * zy + zz * zz)
        const z0 = len ? zx / len : 0, z1 = len ? zy / len : 0, z2 = len ? zz / len : 0

        const xx = up[1] * z2 - up[2] * z1
        const xy = up[2] * z0 - up[0] * z2
        const xz = up[0] * z1 - up[1] * z0
        len = Math.sqrt(xx * xx + xy * xy + xz * xz)
        const x0 = len ? xx / len : 0, x1 = len ? xy / len : 0, x2 = len ? xz / len : 0

        const y0 = z1 * x2 - z2 * x1
        const y1 = z2 * x0 - z0 * x2
        const y2 = z0 * x1 - z1 * x0

        out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0
        out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0
        out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0
        out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2])
        out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2])
        out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2])
        out[15] = 1
        return out
    },

    multiply: (out: Mat4, a: Mat4, b: Mat4): Mat4 => {
        for(let i = 0; i < 4; i++) {
            for(let j = 0; j < 4; j++) {
                out[j * 4 + i] =
                    a[i] * b[j * 4] +
                    a[i + 4] * b[j * 4 + 1] +
                    a[i + 8] * b[j * 4 + 2] +
                    a[i + 12] * b[j * 4 + 3]
            }
        }
        return out
    },

    invert: (out: Mat4, a: Mat4): Mat4 => {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3]
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7]
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11]
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15]

        const b00 = a00 * a11 - a01 * a10
        const b01 = a00 * a12 - a02 * a10
        const b02 = a00 * a13 - a03 * a10
        const b03 = a01 * a12 - a02 * a11
        const b04 = a01 * a13 - a03 * a11
        const b05 = a02 * a13 - a03 * a12
        const b06 = a20 * a31 - a21 * a30
        const b07 = a20 * a32 - a22 * a30
        const b08 = a20 * a33 - a23 * a30
        const b09 = a21 * a32 - a22 * a31
        const b10 = a21 * a33 - a23 * a31
        const b11 = a22 * a33 - a23 * a32

        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
        if(!det) return null
        det = 1.0 / det

        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det
        return out
    },

    transpose: (out: Mat4, a: Mat4): Mat4 => {
        out[0] = a[0]; out[1] = a[4]; out[2] = a[8]; out[3] = a[12]
        out[4] = a[1]; out[5] = a[5]; out[6] = a[9]; out[7] = a[13]
        out[8] = a[2]; out[9] = a[6]; out[10] = a[10]; out[11] = a[14]
        out[12] = a[3]; out[13] = a[7]; out[14] = a[11]; out[15] = a[15]
        return out
    },
}
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/lib/vec3.ts src/engine/lib/mat4.ts
git commit -m "feat: add vec3 and mat4 math utilities for WebGL"
```

---

### Task 2: UV sphere geometry generator

**Files:**
- Create: `src/engine/systems/webglSphereSystem/webglSphereGeometry.ts`

**Interfaces:**
- Consumes: `vec3` from Task 1
- Produces: sphere mesh data (`positions`, `normals`, `uvs`, `indices`) consumed by shader/renderer

- [ ] **Step 1: Write `src/engine/systems/webglSphereSystem/webglSphereGeometry.ts`**

```ts
import { Vec3 } from "@/engine/lib/vec3";

export interface SphereMesh {
    positions: Float32Array
    normals: Float32Array
    uvs: Float32Array
    indices: Uint16Array | Uint32Array
}

export function createSphereMesh(widthSegments: number = 48, heightSegments: number = 32): SphereMesh {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for(let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments
        const phi = v * Math.PI

        for(let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments
            const theta = u * Math.PI * 2

            const sinPhi = Math.sin(phi)
            const cosPhi = Math.cos(phi)
            const sinTheta = Math.sin(theta)
            const cosTheta = Math.cos(theta)

            const nx = cosTheta * sinPhi
            const ny = cosPhi
            const nz = sinTheta * sinPhi

            positions.push(nx, ny, nz)
            normals.push(nx, ny, nz)
            uvs.push(u, v)
        }
    }

    for(let y = 0; y < heightSegments; y++) {
        for(let x = 0; x < widthSegments; x++) {
            const a = y * (widthSegments + 1) + x
            const b = a + widthSegments + 1

            indices.push(a, b, a + 1)
            indices.push(b, b + 1, a + 1)
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/webglSphereSystem/webglSphereGeometry.ts
git commit -m "feat: add UV sphere geometry generator"
```

---

### Task 3: WebGL shader sources and compiler helper

**Files:**
- Create: `src/engine/systems/webglSphereSystem/webglShaders.ts`

**Interfaces:**
- Consumes: nothing
- Produces: compiled shader program + uniform locations consumed by the WebGL sphere renderer

- [ ] **Step 1: Write `src/engine/systems/webglSphereSystem/webglShaders.ts`**

```ts
export const VERTEX_SHADER_SOURCE = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vTexCoord;

    void main() {
        vec4 worldPos = uModel * vec4(aPosition, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize(uNormalMatrix * aNormal);
        vTexCoord = aTexCoord;
        gl_Position = uProjection * uView * worldPos;
    }
`

export const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vTexCoord;

    uniform sampler2D uTexture;
    uniform vec3 uLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;

    void main() {
        vec3 normal = normalize(vNormal);
        float NdotL = dot(normal, uLightDirection);
        float diffuse = max(NdotL, 0.0);

        vec3 texColor = texture2D(uTexture, vTexCoord).rgb;
        vec3 color = texColor * (uAmbientColor + uLightColor * diffuse);

        gl_FragColor = vec4(color, 1.0);
    }
`

export interface ShaderProgram {
    program: WebGLProgram
    attribs: {
        position: number
        normal: number
        texCoord: number
    }
    uniforms: {
        model: WebGLUniformLocation | null
        view: WebGLUniformLocation | null
        projection: WebGLUniformLocation | null
        normalMatrix: WebGLUniformLocation | null
        texture: WebGLUniformLocation | null
        lightDirection: WebGLUniformLocation | null
        lightColor: WebGLUniformLocation | null
        ambientColor: WebGLUniformLocation | null
    }
}

export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
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

export function createShaderProgram(gl: WebGLRenderingContext): ShaderProgram {
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
    }

    const uniforms = {
        model: gl.getUniformLocation(program, "uModel"),
        view: gl.getUniformLocation(program, "uView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        normalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
        texture: gl.getUniformLocation(program, "uTexture"),
        lightDirection: gl.getUniformLocation(program, "uLightDirection"),
        lightColor: gl.getUniformLocation(program, "uLightColor"),
        ambientColor: gl.getUniformLocation(program, "uAmbientColor"),
    }

    return { program, attribs, uniforms }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/webglSphereSystem/webglShaders.ts
git commit -m "feat: add WebGL sphere shaders and compiler helper"
```

---

### Task 4: WebGL sphere renderer

**Files:**
- Create: `src/engine/systems/webglSphereSystem/webglSphereRenderer.ts`

**Interfaces:**
- Consumes: `SphereMesh` from Task 2, `ShaderProgram` from Task 3, `mat4`/`vec3` from Task 1, `ProjectedPoint` from `@/lib/camera`
- Produces: renders a single sphere instance to the WebGL canvas

- [ ] **Step 1: Write `src/engine/systems/webglSphereSystem/webglSphereRenderer.ts`**

```ts
import { SphereMesh, createSphereMesh } from "./webglSphereGeometry"
import { createShaderProgram, type ShaderProgram } from "./webglShaders"
import { mat4 } from "@/engine/lib/mat4"
import { vec3 } from "@/engine/lib/vec3"
import { ProjectedPoint } from "@/lib/camera"
import Camera from "@/lib/camera"

const SPHERE_SEGMENTS = 48

export class WebGLSphereRenderer {
    private gl: WebGLRenderingContext
    private shader: ShaderProgram
    private mesh: SphereMesh
    private sphereVao: WebGLBuffer | null = null
    private sphereIndexBuffer: WebGLBuffer | null = null
    private sphereIndexCount = 0
    private textureUnit = 0

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false })!
        if(!gl) {
            throw new Error("WebGL not supported")
        }
        this.gl = gl
        this.shader = createShaderProgram(gl)
        this.mesh = createSphereMesh(SPHERE_SEGMENTS, Math.round(SPHERE_SEGMENTS * 0.66))

        this.initBuffers()
    }

    private initBuffers() {
        const gl = this.gl

        this.sphereVao = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 8 * 4
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            ...this.mesh.positions,
            ...this.mesh.normals,
            ...this.mesh.uvs,
        ]), gl.STATIC_DRAW)

        this.sphereIndexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW)
        this.sphereIndexCount = this.mesh.indices.length
    }

    resize(width: number, height: number) {
        this.gl.viewport(0, 0, width, height)
    }

    private model = mat4.create()
    private view = mat4.create()
    private projection = mat4.create()
    private normalMatrix = new Float32Array(9)

    render(
        center: ProjectedPoint,
        worldPos: [number, number, number],
        worldRadius: number,
        camera: Camera,
        texture: WebGLTexture,
        lightDirectionWorld: Vec3,
    ) {
        const gl = this.gl

        mat4.identity(this.model)
        mat4.translate(this.model, this.model, worldPos)
        const scale = worldRadius
        mat4.scale(this.model, this.model, [scale, scale, scale])

        mat4.lookAt(this.view, camera.cameraPosition as Vec3, worldPos as Vec3, [0, 0, 1])
        mat4.invert(this.view, this.view)
        mat4.transpose(this.normalMatrix, mat4.create())

        mat4.perspective(this.projection, camera.fieldOfView, camera.aspectRatio, camera.minDistance * 0.1, camera.maxDistance * 2)

        gl.useProgram(this.shader.program)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereVao)
        const stride = 8 * 4
        gl.enableVertexAttribArray(this.shader.attribs.position)
        gl.vertexAttribPointer(this.shader.attribs.position, 3, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.shader.attribs.normal)
        gl.vertexAttribPointer(this.shader.attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4)
        gl.enableVertexAttribArray(this.shader.attribs.texCoord)
        gl.vertexAttribPointer(this.shader.attribs.texCoord, 2, gl.FLOAT, false, stride, 6 * 4)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndexBuffer)

        gl.uniformMatrix4fv(this.shader.uniforms.model, false, this.model)
        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.view)
        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.projection)
        gl.uniformMatrix3fv(this.shader.uniforms.normalMatrix, false, this.normalMatrix)

        gl.activeTexture(gl.TEXTURE0 + this.textureUnit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(this.shader.uniforms.texture, this.textureUnit)

        const lightDir = vec3.normalize([0, 0, 0], lightDirectionWorld)
        gl.uniform3fv(this.shader.uniforms.lightDirection, lightDir)
        gl.uniform3f(this.shader.uniforms.lightColor, 1, 1, 1)
        gl.uniform3f(this.shader.uniforms.ambientColor, 0.15, 0.15, 0.18)

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.CULL_FACE)
        gl.drawElements(gl.TRIANGLES, this.sphereIndexCount, gl.UNSIGNED_SHORT, 0)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/webglSphereSystem/webglSphereRenderer.ts
git commit -m "feat: add WebGL sphere renderer"
```

---

### Task 5: WebGL texture atlas for planets

**Files:**
- Create: `src/engine/systems/webglSphereSystem/webglTextureAtlas.ts`

**Interfaces:**
- Consumes: existing `createPlanetTexture` / `createStarTexture` from `@/game/factories/createCircleTextures`
- Produces: a single WebGL texture atlas with all planet textures packed in, plus UV region lookup

- [ ] **Step 1: Write `src/engine/systems/webglSphereSystem/webglTextureAtlas.ts`**

```ts
import Camera from "@/lib/camera"

const ATLAS_SIZE = 1024
const CELL_SIZE = 128

export interface AtlasEntry {
    u0: number
    v0: number
    u1: number
    v1: number
}

export class WebGLTextureAtlas {
    private entries = new Map<string, AtlasEntry>()
    private atlasCanvas: HTMLCanvasElement
    private atlasTexture: WebGLTexture | null = null

    constructor(private gl: WebGLRenderingContext) {
        this.atlasCanvas = document.createElement("canvas")
        this.atlasCanvas.width = ATLAS_SIZE
        this.atlasCanvas.height = ATLAS_SIZE
    }

    addTexture(key: string, source: HTMLCanvasElement | HTMLImageElement): AtlasEntry {
        if(this.entries.has(key)) {
            return this.entries.get(key)!
        }

        const index = this.entries.size
        if(index >= (ATLAS_SIZE / CELL_SIZE) ** 2) {
            throw new Error("Atlas full")
        }

        const col = index % (ATLAS_SIZE / CELL_SIZE)
        const row = Math.floor(index / (ATLAS_SIZE / CELL_SIZE))
        const x = col * CELL_SIZE
        const y = row * CELL_SIZE

        const ctx = this.atlasCanvas.getContext("2d")!
        ctx.drawImage(source, x, y, CELL_SIZE, CELL_SIZE)

        const entry: AtlasEntry = {
            u0: x / ATLAS_SIZE,
            v0: y / ATLAS_SIZE,
            u1: (x + CELL_SIZE) / ATLAS_SIZE,
            v1: (y + CELL_SIZE) / ATLAS_SIZE,
        }
        this.entries.set(key, entry)
        this.atlasTexture = null
        return entry
    }

    getTexture(gl: WebGLRenderingContext): WebGLTexture {
        if(this.atlasTexture) {
            return this.atlasTexture
        }

        const texture = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlasCanvas)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.generateMipmap(gl.TEXTURE_2D)
        this.atlasTexture = texture
        return texture
    }

    getEntry(key: string): AtlasEntry | undefined {
        return this.entries.get(key)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/webglSphereSystem/webglTextureAtlas.ts
git commit -m "feat: add WebGL texture atlas for planet textures"
```

---

### Task 6: WebGL sphere system

**Files:**
- Create: `src/engine/systems/webglSphereSystem/webglSphereSystem.ts`

**Interfaces:**
- Consumes: `WebGLSphereRenderer` from Task 4, `WebGLTextureAtlas` from Task 5, `Camera` from `@/lib/camera`
- Produces: renders all textured spheres before the 2D canvas draws its overlays

- [ ] **Step 1: Write `src/engine/systems/webglSphereSystem/webglSphereSystem.ts`**

```ts
import { SystemWithNodes } from "../../system"
import { ViewportSystem } from "../viewportSystem"
import { Camera } from "@/lib/camera"
import { WebGLSphereRenderer } from "./webglSphereRenderer"
import { WebGLTextureAtlas, type AtlasEntry } from "./webglTextureAtlas"
import { BaseRenderer } from "../viewportSystem/renderers/baseRenderer"
import { ProjectedPoint } from "@/lib/camera"
import { TextureComponent } from "@/engine/components/textureComponent"
import { PositionComponent } from "@/engine/components/position"
import { Entity } from "@/engine/entities/entity"

export class WebGLSphereSystem extends SystemWithNodes<WebGLSphereNode> {
    private renderer!: WebGLSphereRenderer
    private atlas!: WebGLTextureAtlas
    private glCanvas!: HTMLCanvasElement
    private lightDirection: [number, number, number] = [1, 0, 0]

    constructor(private viewportSystem: ViewportSystem) {
        super()
    }

    addToEngine(engine: any): this {
        super.addToEngine(engine)
        this.initWebGL()
        engine.subscribe("StarPositionChangedEvent", this.onStarPositionChanged)
        return this
    }

    removeFromEngine(): this {
        if(this.engine) {
            this.engine.unsubscribe("StarPositionChangedEvent", this.onStarPositionChanged)
        }
        if(this.glCanvas.parentNode) {
            this.glCanvas.parentNode.removeChild(this.glCanvas)
        }
        super.removeFromEngine()
        return this
    }

    private onStarPositionChanged = () => {
        // light direction will be recomputed each frame in update
    }

    private initWebGL() {
        const mainCanvas = this.viewportSystem.viewport?.camera?.context?.canvas
        if(!mainCanvas) {
            return
        }

        this.glCanvas = document.createElement("canvas")
        this.glCanvas.style.position = "absolute"
        this.glCanvas.style.top = "0"
        this.glCanvas.style.left = "0"
        this.glCanvas.style.zIndex = "0"
        this.glCanvas.width = mainCanvas.width
        this.glCanvas.height = mainCanvas.height

        const container = mainCanvas.parentNode
        if(container) {
            container.insertBefore(this.glCanvas, mainCanvas)
        }

        this.renderer = new WebGLSphereRenderer(this.glCanvas)
        this.atlas = new WebGLTextureAtlas(this.renderer)
    }

    update(_dt: number) {
        if(!this.engine || !this.renderer || !this.atlas) {
            return
        }

        const ctx = this.viewportSystem.viewport?.camera?.context
        const camera = this.viewportSystem.viewport?.camera
        if(!ctx || !camera) {
            return
        }

        const mainCanvas = ctx.canvas
        if(this.glCanvas.width !== mainCanvas.width || this.glCanvas.height !== mainCanvas.height) {
            this.glCanvas.width = mainCanvas.width
            this.glCanvas.height = mainCanvas.height
            this.renderer.resize(mainCanvas.width, mainCanvas.height)
        }

        const starEntity = this.findStarEntity()
        if(!starEntity) {
            return
        }

        const starPos = this.getWorldPosition(starEntity)

        const gl = this.renderer as any
        const lightDir = [
            starPos[0],
            starPos[1],
            starPos[2],
        ]

        const glCtx = this.renderer as any
        const cameraPos = camera.cameraPosition

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        const entries = this.getProjectedCacheEntries()
        for(const entry of entries) {
            const node = entry.node
            if(!node.texture?.texture) {
                continue
            }

            const atlasEntry = this.atlas.getEntry(node.entity.id.toString())
            if(!atlasEntry) {
                continue
            }

            const atlasTexture = this.atlas.getTexture(gl)
            const worldPos = entry.projected as any as [number, number, number]
            const worldRadius = node.radius.radius

            this.renderer.render(
                entry.projected,
                worldPos,
                worldRadius,
                camera,
                atlasTexture,
                lightDir as [number, number, number],
            )
        }
    }

    private findStarEntity(): Entity | undefined {
        return this.engine?.getAllEntities().find(e => {
            const color = e.getComponent(ColorComponent)
            return color?.emitLight
        })
    }

    private getWorldPosition(entity: Entity): [number, number, number] {
        const sceneNode = this.engine?.getSceneNode(entity)
        if(sceneNode) {
            const pos = sceneNode.getWorldPosition()
            return [pos[0], pos[1], pos[2]]
        }
        const pos = entity.getComponent(PositionComponent)
        return pos ? [pos.x, pos.y, pos.z] : [0, 0, 0]
    }
}

export class WebGLSphereNode {
    constructor(
        public entity: Entity,
        public position: PositionComponent,
        public radius: { radius: number },
        public texture: TextureComponent | undefined,
    ) {}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/webglSphereSystem/webglSphereSystem.ts
git commit -m "feat: add WebGL sphere rendering system"
```

---

### Task 7: Register WebGL sphere system in game bootstrap

**Files:**
- Modify: `src/game/game.ts`
- Modify: `src/engine/systems/viewportSystem/viewportSystem.ts`

**Interfaces:**
- Consumes: `WebGLSphereSystem` from Task 6
- Produces: the new system is instantiated and updated each frame

- [ ] **Step 1: Modify `src/game/game.ts` to register the new system**

Replace the existing `setRendererClasses` call with:

```ts
import { WebGLSphereSystem } from "@engine/systems/webglSphereSystem/webglSphereSystem"

// ...

this.engine.getSystem(ViewportSystem).setRendererClasses([
    ShapeRenderer,
    // CircleRenderer removed from here; planets render via WebGLSphereSystem
    LabelRenderer,
    RectRenderer,
])

this.engine.addSystem(new WebGLSphereSystem(this.engine.getSystem(ViewportSystem)))
```

- [ ] **Step 2: Modify `src/engine/systems/viewportSystem/viewportSystem.ts` to skip circle rendering for textured entities**

In `CircleRenderer.updateNode`, early-out when the node has a `TextureComponent`:

```ts
if(circle.texture?.texture) {
    return
}
```

Or remove `CircleRenderer` from `setRendererClasses` entirely and keep it only for non-textured entities if needed.

- [ ] **Step 3: Commit**

```bash
git add src/game/game.ts src/engine/systems/viewportSystem/viewportSystem.ts
git commit -m "feat: register WebGL sphere system and remove planets from 2D circle renderer"
```

---

### Task 8: Polish, testing, and cleanup

**Files:**
- Modify: all new files from Tasks 1-7
- Create: manual verification checklist

- [ ] **Step 1: Verify WebGL context acquisition does not crash SSR / vitest**

Guard any `document.createElement("canvas")` or `getContext("webgl")` with `typeof document !== "undefined"` so tests and server-side environments don't throw.

- [ ] **Step 2: Verify depth sorting**

The WebGL pass currently does not sort spheres by depth. If planets overlap, the renderer should sort projected spheres back-to-front and render in that order, or use a proper depth buffer. Verify the depth test is enabled and clear the depth buffer each frame.

- [ ] **Step 3: Verify texture atlas loading**

Ensure `createPlanetTexture` and `createStarTexture` are called during entity creation and their canvases are added to the atlas before the first render frame.

- [ ] **Step 4: Run build and lint**

```bash
pnpm build
pnpm lint
```

- [ ] **Step 5: Manual verification checklist**

- [ ] Planets appear as smooth lit spheres from all angles
- [ ] Night-side terminator stays aligned with the actual star direction in world space
- [ ] Viewing from near the star shows the fully lit face (no incorrect darkening)
- [ ] Asteroids and mining sites (no `TextureComponent`) still render correctly via 2D `CircleRenderer`
- [ ] Labels, orbits, and UI overlays still appear on top of planets
- [ ] Bloom post-processing still works for light-emitting entities
- [ ] Window resize keeps WebGL canvas synchronized with 2D canvas
- [ ] Frame rate remains acceptable with all visible bodies rendered

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: polish WebGL planet renderer"
```
