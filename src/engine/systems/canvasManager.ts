export class CanvasManager {
    private _canvas: HTMLCanvasElement | null = null
    private _webglCanvas: HTMLCanvasElement | null = null

    get canvas() {
        if (!this._canvas && typeof document !== "undefined") {
            this._canvas = document.getElementById("2dCanvas") as HTMLCanvasElement
        }
        if (!this._canvas) {
            throw new Error("Canvas not found")
        }
        return this._canvas
    }

    get webglCanvas() {
        if (!this._webglCanvas && typeof document !== "undefined") {
            this._webglCanvas = document.createElement("canvas")
        }
        if (!this._webglCanvas) {
            throw new Error("WebGL canvas not found")
        }
        return this._webglCanvas
    }

    constructor() {
        if (typeof document !== "undefined") {
            this._canvas = document.getElementById("2dCanvas") as HTMLCanvasElement
            this._webglCanvas = document.createElement("canvas")
        }
    }
}