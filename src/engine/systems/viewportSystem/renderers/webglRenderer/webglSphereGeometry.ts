export interface SphereMesh {
    positions: Float32Array
    normals: Float32Array
    indices: Uint16Array | Uint32Array
}

export interface AsteroidMesh extends SphereMesh {
    meshIndex: number
}

function normalize(x: number, y: number, z: number) {
    const len = Math.sqrt(x * x + y * y + z * z)
    return [x / len, y / len, z / len]
}

function hash33(x: number, y: number, z: number): number {
    let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0
    h = (h ^ (h >>> 16)) >>> 0
    return (h / 4294967296) * 2 - 1
}

function seededFbm3d(x: number, y: number, z: number, seed: number, octaves = 4): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    for(let i = 0; i < octaves; i++) {
        value += hash33(x * frequency + seed * 1000, y * frequency + seed * 2000, z * frequency + seed * 3000) * amplitude
        maxValue += amplitude
        amplitude *= 0.5
        frequency *= 2
    }
    return value / maxValue
}

function subdivide(
    vertices: number[],
    indices: number[],
    subdivisions: number
): void {
    const midpointCache = new Map<string, number>()

    function getMidpoint(i1: number, i2: number): number {
        const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`
        if(midpointCache.has(key)) {
            return midpointCache.get(key)!
        }

        const x = (vertices[i1 * 3] + vertices[i2 * 3]) / 2
        const y = (vertices[i1 * 3 + 1] + vertices[i2 * 3 + 1]) / 2
        const z = (vertices[i1 * 3 + 2] + vertices[i2 * 3 + 2]) / 2

        const idx = vertices.length / 3
        vertices.push(...normalize(x, y, z))
        midpointCache.set(key, idx)
        return idx
    }

    for(let s = 0; s < subdivisions; s++) {
        const newIndices: number[] = []
        midpointCache.clear()

        for(let i = 0; i < indices.length; i += 3) {
            const a = indices[i]
            const b = indices[i + 1]
            const c = indices[i + 2]

            const ab = getMidpoint(a, b)
            const bc = getMidpoint(b, c)
            const ca = getMidpoint(c, a)

            newIndices.push(
                a, ab, ca,
                b, bc, ab,
                c, ca, bc,
                ab, bc, ca
            )
        }

        indices.length = 0
        indices.push(...newIndices)
    }
}

export function createSphereMesh(subdivisions: number): SphereMesh {
    const phi = (1 + Math.sqrt(5)) / 2

    const icoVertices = [
        0, 1, phi,
        0, 1, -phi,
        0, -1, phi,
        0, -1, -phi,
        1, phi, 0,
        1, -phi, 0,
        -1, phi, 0,
        -1, -phi, 0,
        phi, 0, 1,
        phi, 0, -1,
        -phi, 0, 1,
        -phi, 0, -1,
    ]

    const icoIndices = [
        0, 2, 8,
        0, 8, 9,
        0, 9, 4,
        0, 4, 6,
        0, 6, 10,
        0, 10, 2,
        2, 10, 11,
        2, 11, 3,
        2, 3, 5,
        2, 5, 8,
        8, 5, 1,
        8, 1, 9,
        9, 1, 3,
        9, 3, 4,
        4, 3, 11,
        4, 11, 6,
        6, 11, 10,
        10, 6, 4,
        3, 1, 5,
        3, 5, 11,
    ]

    subdivide(icoVertices, icoIndices, subdivisions)

    const positions: number[] = []
    const normals: number[] = []
    const finalIndices: number[] = []

    for(let i = 0; i < icoVertices.length; i += 3) {
        const [x, y, z] = normalize(icoVertices[i], icoVertices[i + 1], icoVertices[i + 2])
        positions.push(x, y, z)
        normals.push(x, y, z)
    }

    for(let i = 0; i < icoIndices.length; i++) {
        finalIndices.push(icoIndices[i])
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: finalIndices.length > 65535 ? new Uint32Array(finalIndices) : new Uint16Array(finalIndices),
    }
}

export function createAsteroidMesh(seed: number, subdivisions: number = 3, lumpiness = 0.18): AsteroidMesh {
    const base = createSphereMesh(subdivisions)
    const vertexCount = base.positions.length / 3

    const positions = new Float32Array(base.positions.length)
    const normals = new Float32Array(base.positions.length)

    for(let i = 0; i < vertexCount; i++) {
        const baseIdx = i * 3
        const x = base.positions[baseIdx]
        const y = base.positions[baseIdx + 1]
        const z = base.positions[baseIdx + 2]

        const n = seededFbm3d(x * 4.0 + seed * 7.0, y * 4.0 + seed * 13.0, z * 4.0 + seed * 19.0, seed, 3)
        const r = 1.0 + lumpiness * n

        positions[baseIdx] = x * r
        positions[baseIdx + 1] = y * r
        positions[baseIdx + 2] = z * r

        // Recompute normal from distorted position for correct lighting
        const len = Math.sqrt(x * x + y * y + z * z)
        normals[baseIdx] = x / len
        normals[baseIdx + 1] = y / len
        normals[baseIdx + 2] = z / len
    }

    return {
        positions,
        normals,
        indices: base.indices,
        meshIndex: seed,
    }
}

export function createAsteroidMeshPool(count: number, subdivisions: number = 3): AsteroidMesh[] {
    const meshes: AsteroidMesh[] = []
    for(let i = 0; i < count; i++) {
        meshes.push(createAsteroidMesh(i + 1, subdivisions))
    }
    return meshes
}
