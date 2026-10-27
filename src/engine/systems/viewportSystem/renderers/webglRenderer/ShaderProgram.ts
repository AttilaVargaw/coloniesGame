

export interface ShaderProgramAttribs {
    position: number;
    normal: number;
    instanceModel: number;
    instanceNormalMatrix: number;
    instanceLightDir: number;
    instanceLightColor: number;
    instanceTexOffset: number;
    instanceTexScale: number;
    instanceNightTexOffset: number;
    instanceNightTexScale: number;
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
    paletteColor: WebGLUniformLocation | null;
    tintColor: WebGLUniformLocation | null;
    tintAlpha: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    bloomBrightness: WebGLUniformLocation | null;
    bloomThreshold: WebGLUniformLocation | null;
    bloomThresholdStars: WebGLUniformLocation | null;
    [key: string]: WebGLUniformLocation | null;
}

export interface ShaderProgram<A extends Record<string, number> = ShaderProgramAttribs, U extends Record<string, WebGLUniformLocation | null> = ShaderProgramUniforms> {
    program: WebGLProgram;
    attribs: A;
    uniforms: U;
}
