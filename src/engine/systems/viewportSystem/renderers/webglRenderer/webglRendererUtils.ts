export function setupInstancedAttrib(
    gl: WebGL2RenderingContext,
    loc: number,
    size: number,
    offset: number,
    stride: number
): void {
    if(loc < 0) return
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset)
    gl.vertexAttribDivisor(loc, 1)
}

export function resetInstancedAttrib(gl: WebGL2RenderingContext, loc: number): void {
    if(loc >= 0) {
        gl.disableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 0)
    }
}

export function bindPageTexture(
    gl: WebGL2RenderingContext,
    textures: WebGLTexture[],
    page: number,
    unit: number,
    uniform: WebGLUniformLocation | null,
    lastPage: number
): number {
    if(page !== lastPage) {
        const texture = textures[page] ?? textures[0]
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        if(uniform) gl.uniform1i(uniform, unit)
    }
    return page
}

export function growFloatPool(
    pool: Float32Array | null,
    needed: number,
    minGrow: number
): Float32Array {
    if(pool && pool.length >= needed) return pool
    const newSize = Math.max(needed, (pool?.length ?? 0) * 2, minGrow)
    const newPool = new Float32Array(newSize)
    if(pool) newPool.set(pool)
    return newPool
}

export function uploadInstanceBatch(
    gl: WebGL2RenderingContext,
    buffer: WebGLBuffer | null,
    batch: Float32Array,
    capacity: number
): { buffer: WebGLBuffer; capacity: number } {
    let buf = buffer
    if(!buf) buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const byteLength = batch.length * 4
    let cap = capacity
    if(byteLength > cap) {
        gl.bufferData(gl.ARRAY_BUFFER, batch, gl.STREAM_DRAW)
        cap = byteLength
    } else {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch)
    }
    return { buffer: buf, capacity: cap }
}

export function groupInstancesByPage<K>(
    instances: Array<{ page: K; depth: number; offset: number }>
): Map<K, Array<{ depth: number; offset: number }>> {
    const groups = new Map<K, Array<{ depth: number; offset: number }>>()
    for(const inst of instances) {
        let group = groups.get(inst.page)
        if(!group) {
            group = []
            groups.set(inst.page, group)
        }
        group.push({ depth: inst.depth, offset: inst.offset })
    }
    for(const group of groups.values()) {
        group.sort((a, b) => b.depth - a.depth)
    }
    return groups
}
