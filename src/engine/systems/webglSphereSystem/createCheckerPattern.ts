const CHECKER_SIZE = 16

let canvas: HTMLCanvasElement | null = null

export function createCheckerPatternCanvas(size = 128): HTMLCanvasElement {
    if(canvas) {
        return canvas
    }

    if(typeof document === "undefined") {
        throw new Error("Checker pattern not available")
    }

    canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext("2d")!
    const tileCount = size / CHECKER_SIZE

    for(let row = 0; row < tileCount; row++) {
        for(let col = 0; col < tileCount; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#ff00ff"
            ctx.fillRect(col * CHECKER_SIZE, row * CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE)
        }
    }

    return canvas
}
