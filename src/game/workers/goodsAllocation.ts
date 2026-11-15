import { Goods } from "../data/Goods.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

export interface GoodsAllocationRequest {
    sectorId: keyof IndustrialSectors;
    idealDemand: Partial<Record<keyof Goods, number>>;
    priority: number;
}

export interface GoodsAllocationResult {
    allocation: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>;
    unmetDemand: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>>;
}

/**
 * Centralized goods allocation.
 *
 * Allocates available colony goods across sectors independent of iteration order.
 * When total demand exceeds supply, allocation is proportional to each sector's
 * ideal demand weighted by priority.
 *
 * Returns the per-sector, per-good goods allocation.
 */
export function allocateGoods({
    availableGoods,
    sectorRequests,
}: {
    availableGoods: Record<keyof Goods, number>;
    sectorRequests: GoodsAllocationRequest[];
}): GoodsAllocationResult {
    const allocation: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>> = {};
    const unmetDemand: Record<keyof IndustrialSectors, Partial<Record<keyof Goods, number>>> = {};

    // Initialize
    for (const req of sectorRequests) {
        allocation[req.sectorId] = {};
        unmetDemand[req.sectorId] = {};
    }

    // Allocate per good independently
    for (const goodKey of Object.keys(availableGoods) as (keyof Goods)[]) {
        const available = availableGoods[goodKey];

        // Collect demands for this good
        const demands: { sectorId: keyof IndustrialSectors; demand: number; priority: number }[] = [];
        let totalDemand = 0;

        for (const req of sectorRequests) {
            const d = req.idealDemand[goodKey] ?? 0;
            if (d > 0) {
                demands.push({ sectorId: req.sectorId, demand: d, priority: req.priority });
                totalDemand += d;
            }
        }

        if (totalDemand === 0) continue;

        if (totalDemand <= available) {
            // Enough goods for everyone
            for (const { sectorId, demand } of demands) {
                allocation[sectorId][goodKey] = demand;
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
                allocation[sectorId][goodKey] = allocated;
                remaining -= allocated;
            }

            // Compute unmet demand
            for (const { sectorId, demand } of demands) {
                const alloc = allocation[sectorId][goodKey] ?? 0;
                const unmet = demand - alloc;
                if (unmet > 0) {
                    unmetDemand[sectorId][goodKey] = unmet;
                }
            }
        }
    }

    return { allocation, unmetDemand };
}
