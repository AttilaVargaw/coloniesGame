import type { IndustryTickPatch } from "../workers/IndustryTickPatch";
import type { IndustryTickInput } from "../workers/IndustryTickInput";

export interface WorkerPoolMessage {
    type: string;
    patches: IndustryTickPatch[];
}

export class IndustryWorkerPool {
    private workers: Worker[] = [];
    private batches: IndustryTickInput[][] = [];
    private pendingCount = 0;
    private allPatches: IndustryTickPatch[] = [];
    private onMessage: (event: WorkerPoolMessage) => void;
    private onError?: (message: string) => void;
    private workerCount: number;
    private started = false;

    constructor(options: {
        workerCount?: number;
        onMessage: (event: WorkerPoolMessage) => void;
        onError?: (message: string) => void;
    }) {
        this.onMessage = options.onMessage;
        this.onError = options.onError;
        this.workerCount = options.workerCount || Math.min(navigator.hardwareConcurrency || 4, 8);
    }

    start() {
        if (this.started) return;
        this.started = true;
        
        const workerUrl = new URL("../workers/industryTick.worker.ts", import.meta.url);
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker(workerUrl, { type: "module" });
            worker.onmessage = (event) => this.handleMessage(i, event);
            worker.onerror = (event) => {
                console.error(`Industry worker ${i} error:`, event.message);
                this.onError?.(event.message);
            };
            this.workers.push(worker);
        }
    }

    tick(industries: IndustryTickInput[]) {
        if (!this.started) this.start();
        
        this.batches = Array.from({ length: this.workerCount }, () => []);
        this.allPatches = [];
        this.pendingCount = this.workerCount;

        for (const industry of industries) {
            const hash = IndustryWorkerPool.hashString(industry.entityId);
            const workerIndex = ((hash % this.workerCount) + this.workerCount) % this.workerCount;
            this.batches[workerIndex].push(industry);
        }

        for (let i = 0; i < this.workerCount; i++) {
            this.workers[i].postMessage({ type: "tick", industries: this.batches[i] });
        }
    }

    private handleMessage(_workerIndex: number, event: MessageEvent<WorkerPoolMessage>) {
        if (event.data.type !== "result") return;
        
        this.allPatches.push(...event.data.patches);
        this.pendingCount--;

        if (this.pendingCount === 0) {
            this.onMessage({ type: "result", patches: this.allPatches });
        }
    }

    private static hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    terminate() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers.length = 0;
        this.started = false;
    }
}
