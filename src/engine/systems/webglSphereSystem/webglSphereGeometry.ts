export interface SphereMesh {
    positions: Float32Array
    normals: Float32Array
    uvs: Float32Array
    indices: Uint16Array | Uint32Array
}

export function createSphereMesh(widthSegments: number = 8, heightSegments: number = 8): SphereMesh {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    positions.push(0, 1, 0)
    normals.push(0, 1, 0)
    uvs.push(0.5, 1)

    for(let y = 1; y < heightSegments; y++) {
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

    positions.push(0, -1, 0)
    normals.push(0, -1, 0)
    uvs.push(0.5, 0)

    const stride = widthSegments + 1
    const ringStart = 1
    const lastRingStart = ringStart + (heightSegments - 2) * stride
    const bottomPoleIndex = ringStart + (heightSegments - 1) * stride

    for(let x = 0; x < widthSegments; x++) {
        indices.push(0, ringStart + x, ringStart + x + 1)
    }
    indices.push(0, ringStart + widthSegments, ringStart)

    for(let y = 0; y < heightSegments - 2; y++) {
        for(let x = 0; x < widthSegments; x++) {
            const a = ringStart + y * stride + x
            const b = a + stride

            indices.push(a, a + 1, b)
            indices.push(a + 1, b + 1, b)
        }
    }

    for(let x = 0; x < widthSegments; x++) {
        indices.push(bottomPoleIndex, lastRingStart + x, lastRingStart + x + 1)
    }
    indices.push(bottomPoleIndex, lastRingStart + widthSegments, lastRingStart)

    const vertexCount = positions.length / 3
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    }
}
