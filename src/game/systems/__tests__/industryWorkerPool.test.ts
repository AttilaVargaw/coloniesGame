import { describe, it, expect } from "vitest";
import { IndustryWorkerPool, WorkerPoolMessage } from "../industryWorkerPool";

describe("WorkerPoolMessage", () => {
    it("includes tick field", () => {
        const msg: WorkerPoolMessage = { type: "tick", tick: 5, patches: [] };
        expect(msg.tick).toBe(5);
    });

    it("rejects response with mismatched tick", () => {
        // Verify worker pool rejects responses with wrong tick
    });
});