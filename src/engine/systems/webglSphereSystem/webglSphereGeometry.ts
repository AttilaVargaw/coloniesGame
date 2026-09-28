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
