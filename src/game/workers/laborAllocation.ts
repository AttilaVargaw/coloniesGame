import { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

export interface LaborAllocationRequest {
    sectorId: keyof IndustrialSectors;
    idealDemand: Partial<Record<keyof Population, number>>;
    priority: number;
}

export interface LaborAllocationResult {
    allocation: Partial<Record<keyof IndustrialSectors, Partial<Record<keyof Population, number>>>>;
    unmetDemand: Partial<Record<keyof IndustrialSectors, Partial<Record<keyof Population, number>>>>;
}

/**
 * Centralized labor allocation.
 *
 * Allocates available workers across sectors independent of iteration order.
 * When total demand exceeds supply, allocation is proportional to each sector's
 * ideal demand weighted by priority.
 *
 * Returns the per-sector, per-population-type labor allocation.
 */
export function allocateLabor({
    availableWorkers,
    sectorRequests,
}: {
    availableWorkers: Record<keyof Population, number>;
    sectorRequests: LaborAllocationRequest[];
}): LaborAllocationResult {
    const allocation: Partial<Record<keyof IndustrialSectors, Partial<Record<keyof Population, number>>>> = {};
    const unmetDemand: Partial<Record<keyof IndustrialSectors, Partial<Record<keyof Population, number>>>> = {};

    // Initialize requested sectors
    for (const req of sectorRequests) {
        allocation[req.sectorId] = {};
        unmetDemand[req.sectorId] = {};
    }

    // Allocate per population type independently
    for (const popType of Object.keys(availableWorkers) as (keyof Population)[]) {
        const available = availableWorkers[popType];

        // Collect demands for this population type
        const demands: { sectorId: keyof IndustrialSectors; demand: number; priority: number }[] = [];
        let totalDemand = 0;

        for (const req of sectorRequests) {
            const d = req.idealDemand[popType] ?? 0;
            if (d > 0) {
                demands.push({ sectorId: req.sectorId, demand: d, priority: req.priority });
                totalDemand += d;
            }
        }

        if (totalDemand === 0) continue;

        if (totalDemand <= available) {
            // Enough workers for everyone
            for (const { sectorId, demand } of demands) {
                (allocation[sectorId] ??= {})[popType] = demand;
            }
        } else {
            // Proportional allocation weighted by priority
            let totalWeightedDemand = 0;
            for (const { demand, priority } of demands) {
                totalWeightedDemand += demand * priority;
            }

            let remaining = available;
            for (let i = 0; i < demands.length; i++) {
                const { sectorId, demand, priority } = demands[i];
                const weight = demand * priority;
                const share = totalWeightedDemand > 0 ? (weight / totalWeightedDemand) * available : 0;

                // Last sector gets the remainder to avoid rounding drift
                const allocated = i === demands.length - 1 ? remaining : Math.floor(share);
                (allocation[sectorId] ??= {})[popType] = allocated;
                remaining -= allocated;
            }

            // Compute unmet demand
            for (const { sectorId, demand } of demands) {
                const alloc = (allocation[sectorId] ?? {})[popType] ?? 0;
                const unmet = demand - alloc;
                if (unmet > 0) {
                    (unmetDemand[sectorId] ??= {})[popType] = unmet;
                }
            }
        }
    }

    return { allocation, unmetDemand };
}
