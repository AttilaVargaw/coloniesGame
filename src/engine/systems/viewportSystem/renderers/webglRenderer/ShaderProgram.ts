

export interface ShaderProgramAttribs {
    position: number;
    normal: number;
    instanceModel: number;
    instanceNormalMatrix: number;
    instanceLightDir: number;
    instanceLightColor: number;
    instanceTexOffset: number;
    instanceTexScale: number;
    instanceEmissiveCloud: number;
    [key: string]: number;
}

export interface ShaderProgramUniforms {
    view: WebGLUniformLocation | null;
    projection: WebGLUniformLocation | null;
    ambientColor: WebGLUniformLocation | null;
    cameraPosition: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    nightTexture: WebGLUniformLocation | null;
    roughness: WebGLUniformLocation | null;
    cloudTexture: WebGLUniformLocation | null;
    normalMap: WebGLUniformLocation | null;
    tintColor: WebGLUniformLocation | null;
    tintAlpha: WebGLUniformLocation | null;
    hdrMode: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export interface ShaderProgram<A extends Record<string, number> = ShaderProgramAttribs, U extends Record<string, WebGLUniformLocation | null> = ShaderProgramUniforms> {
    program: WebGLProgram;
    attribs: A;
    uniforms: U;
}
