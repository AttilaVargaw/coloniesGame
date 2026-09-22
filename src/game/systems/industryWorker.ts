export function createIndustryWorker(onMessage: (event: MessageEvent) => void) {
    const workerUrl = new URL("../workers/industryTick.worker.ts", import.meta.url);
    const worker = new Worker(workerUrl, { type: "module" });

    worker.onmessage = onMessage;
    worker.onerror = (event) => {
        console.error("Industry worker error:", event.message);
    };

    return worker;
}
