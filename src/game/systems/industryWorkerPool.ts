import type { IndustryTickPatch } from "../workers/IndustryTickPatch";
import type { IndustryTickInput } from "../workers/IndustryTickInput";
import Worker from "../workers/industryTick.worker.ts?worker";

export interface WorkerPoolMessage {
    type: string;
    tick: number;
    patches: IndustryTickPatch[];
}

interface PendingBatch {
    tick: number;
    expectedResponses: number;
    receivedPatches: IndustryTickPatch[];
    resolved: boolean;
}

export class IndustryWorkerPool {
    private workers: Worker[] = [];
    private batches: IndustryTickInput[][] = [];
    private pendingBatches: Map<number, PendingBatch> = new Map();
    private onMessage: (event: WorkerPoolMessage) => void;
    private onError?: (message: string) => void;
    private workerCount: number;
    private started = false;
    private nextTickId = 1;

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
        
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker();
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
        
        const tick = this.nextTickId++;
        
        this.batches = Array.from({ length: this.workerCount }, () => []);
        const pendingBatch: PendingBatch = {
            tick,
            expectedResponses: this.workerCount,
            receivedPatches: [],
            resolved: false,
        };
        this.pendingBatches.set(tick, pendingBatch);

        for (const industry of industries) {
            const hash = IndustryWorkerPool.hashString(industry.entityId);
            const workerIndex = ((hash % this.workerCount) + this.workerCount) % this.workerCount;
            this.batches[workerIndex].push(industry);
        }

        for (let i = 0; i < this.workerCount; i++) {
            this.workers[i].postMessage({ type: "tick", industries: this.batches[i], tick });
        }
    }

    private handleMessage(_workerIndex: number, event: MessageEvent<WorkerPoolMessage>) {
        if (event.data.type !== "result") return;
        
        const { tick, patches } = event.data;
        const batch = this.pendingBatches.get(tick);
        
        if (!batch) {
            console.warn(`Received result for unknown tick ${tick}`);
            return;
        }
        
        if (batch.resolved) {
            console.warn(`Batch ${tick} already resolved, ignoring duplicate response`);
            return;
        }

        batch.receivedPatches.push(...patches);
        batch.expectedResponses--;

        if (batch.expectedResponses === 0) {
            batch.resolved = true;
            this.pendingBatches.delete(tick);
            this.onMessage({ type: "result", tick, patches: batch.receivedPatches });
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
        this.pendingBatches.clear();
    }
}
