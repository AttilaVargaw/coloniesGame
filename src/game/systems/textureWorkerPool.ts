export interface TextureWorkerMessage {
    type: "texture"
    textureType: "planet" | "star" | "normal" | "roughness" | "cloud" | "night"
    baseColor: string
    archetype?: string
    seedKey?: string
    id: number
}

export interface TextureWorkerResult {
    type: "result"
    id: number
    bitmap: ImageBitmap
}

export interface TextureWorkerPoolOptions {
    workerCount?: number
    onResult: (result: TextureWorkerResult) => void
    onError?: (message: string) => void
}

export class TextureWorkerPool {
    private workers: Worker[] = []
    private pending = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void }>()
    private nextId = 0
    private workerCount: number
    private onResult: (result: TextureWorkerResult) => void
    private onError?: (message: string) => void

    constructor(options: TextureWorkerPoolOptions) {
        this.workerCount = options.workerCount || Math.min(navigator.hardwareConcurrency || 4, 8)
        this.onResult = options.onResult
        this.onError = options.onError
    }

    start() {
        if(this.workers.length > 0) return

        const workerUrl = new URL("../workers/textureWorker.ts", import.meta.url)
        for(let i = 0; i < this.workerCount; i++) {
            const worker = new Worker(workerUrl, { type: "module" })
            worker.onmessage = (event) => this.handleMessage(event)
            worker.onerror = (event) => {
                console.error("Texture worker error:", event.message)
                this.onError?.(event.message)
            }
            this.workers.push(worker)
        }
    }

    generate(textureType: TextureWorkerMessage["textureType"], baseColor: string, archetype?: string, seedKey?: string): Promise<ImageBitmap> {
        if(!this.workers.length) this.start()

        const id = this.nextId++
        
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject })
            
            const workerIndex = id % this.workers.length
            this.workers[workerIndex].postMessage({
                type: "texture",
                textureType,
                baseColor,
                archetype,
                seedKey,
                id,
            })
        })
    }

    private handleMessage(event: MessageEvent<TextureWorkerResult>) {
        const { id, bitmap } = event.data
        
        const pending = this.pending.get(id)
        if(pending) {
            pending.resolve(bitmap)
            this.pending.delete(id)
        }
        
        this.onResult(event.data)
    }

    terminate() {
        for(const worker of this.workers) {
            worker.terminate()
        }
        this.workers = []
        this.pending.clear()
    }
}
