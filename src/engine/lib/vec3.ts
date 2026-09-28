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
