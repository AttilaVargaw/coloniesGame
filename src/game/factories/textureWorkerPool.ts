import { TextureWorkerPool } from "../systems/textureWorkerPool";

export let textureWorkerPool: TextureWorkerPool | null = null;

export function getTextureWorkerPool(): TextureWorkerPool {
    if(!textureWorkerPool) {
        textureWorkerPool = new TextureWorkerPool({
            workerCount: Math.min(navigator.hardwareConcurrency || 4, 8),
            onResult: () => { },
            onError: (message) => console.error("Texture worker error:", message),
        })
        textureWorkerPool.start()
    }
    return textureWorkerPool
}

export function terminateTextureWorkerPool(): void {
    if(textureWorkerPool) {
        textureWorkerPool.terminate()
        textureWorkerPool = null
    }
}