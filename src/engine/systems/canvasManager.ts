export class CanvasManager {
    private _canvas = document.getElementById("2dCanvas") as HTMLCanvasElement
    private _webglCanvas = document.createElement("canvas")

    get canvas() {
        return this._canvas
    }

    get webglCanvas() {
        return this._webglCanvas
    }

    constructor() {
        if(!this._canvas) {
            throw new Error("Canvas not found")
        }
    }
}