

export interface ShaderProgram {
    program: WebGLProgram;
    attribs: {
        position: number;
        normal: number;
        instanceModel: number;
        instanceNormalMatrix: number;
        instanceLightDir: number;
        instanceTexOffset: number;
        instanceTexScale: number;
        instanceNightTexOffset: number;
        instanceNightTexScale: number;
        instanceEmissive: number;
        instanceCloudPage: number;
    };
    uniforms: {
        view: WebGLUniformLocation | null;
        projection: WebGLUniformLocation | null;
        lightColor: WebGLUniformLocation | null;
        ambientColor: WebGLUniformLocation | null;
        cameraPosition: WebGLUniformLocation | null;
        texture: WebGLUniformLocation | null;
        nightTexture: WebGLUniformLocation | null;
        roughness: WebGLUniformLocation | null;
        cloudTexture: WebGLUniformLocation | null;
        normalMap: WebGLUniformLocation | null;
        tintColor: WebGLUniformLocation | null;
        tintAlpha: WebGLUniformLocation | null;
        time: WebGLUniformLocation | null;
    };
}
