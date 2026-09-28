export const VERTEX_SHADER_SOURCE = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec2 vTexCoord;

    void main() {
        vec4 worldPos = uModel * vec4(aPosition, 1.0);
        vNormal = normalize(uNormalMatrix * aNormal);
        vTexCoord = aTexCoord;
        gl_Position = uProjection * uView * worldPos;
    }
`

export const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec2 vTexCoord;

    uniform sampler2D uTexture;
    uniform vec3 uLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;
    uniform vec2 uTextureOffset;
    uniform vec2 uTextureScale;

    void main() {
        vec3 normal = normalize(vNormal);
        float NdotL = dot(normal, uLightDirection);
        float diffuse = max(NdotL, 0.0) * 0.85 + 0.15;

        vec2 atlasUV = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * uTextureScale + uTextureOffset;
        vec3 texColor = texture2D(uTexture, atlasUV).rgb;
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
        textureOffset: WebGLUniformLocation | null
        textureScale: WebGLUniformLocation | null
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
        textureOffset: gl.getUniformLocation(program, "uTextureOffset"),
        textureScale: gl.getUniformLocation(program, "uTextureScale"),
    }

    return { program, attribs, uniforms }
}
