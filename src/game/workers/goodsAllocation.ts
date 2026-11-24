import { Goods } from "../data/Goods.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

export interface GoodsAllocationRequest {
    sectorId: keyof IndustrialSectors;
    idealDemand: Partial<Record<keyof Goods, number>>;
    priority: number;
}

export interface GoodsAllocationResult {
    allocation: Partial<
        Record<
            keyof IndustrialSectors,
            Partial<Record<keyof Goods, number>>
        >
    >;
    unmetDemand: Partial<
        Record<
            keyof IndustrialSectors,
            Partial<Record<keyof Goods, number>>
        >
    >;
}

const EPSILON = 1e-9;

/**
 * Centralized goods allocation.
 *
 * Allocates available colony goods across sectors independent of iteration order.
 * When total demand exceeds supply, allocation is proportional to each sector's
 * ideal demand weighted by priority, never exceeding a sector's requested demand.
 * Any excess from saturated sectors is redistributed to remaining sectors.
 *
 * Returns the per-sector, per-good goods allocation and unmet demand.
 */
export function allocateGoods({
    availableGoods,
    sectorRequests,
}: {
    availableGoods: Record<keyof Goods, number>;
    sectorRequests: GoodsAllocationRequest[];
}): GoodsAllocationResult {
    const allocation: GoodsAllocationResult["allocation"] = {};
    const unmetDemand: GoodsAllocationResult["unmetDemand"] = {};

    const seen = new Set<keyof IndustrialSectors>();

    for (const req of sectorRequests) {
        if (seen.has(req.sectorId)) {
            throw new Error(`Duplicate goods request for ${req.sectorId}`);
        }
        seen.add(req.sectorId);

        if (!Number.isFinite(req.priority) || req.priority <= 0) {
            throw new Error(
                `Invalid priority for ${req.sectorId}: ${req.priority}`,
            );
        }

        allocation[req.sectorId] = {};
        unmetDemand[req.sectorId] = {};

        for (const [key, demand] of Object.entries(req.idealDemand)) {
            if (!Object.hasOwn(availableGoods, key)) {
                throw new Error(`Unknown good in demand: ${key}`);
            }

            if (!Number.isFinite(demand) || demand < 0) {
                throw new Error(
                    `Invalid demand for ${req.sectorId}/${key}: ${demand}`,
                );
            }

            const goodKey = key as keyof Goods;
            allocation[req.sectorId]![goodKey] = 0;
        }
    }

    // Pre-compute available goods keys to avoid repeated Object.keys()
    const availableGoodsKeys = Object.keys(availableGoods) as (keyof Goods)[];

    for (const goodKey of availableGoodsKeys) {
        const available = availableGoods[goodKey];

        if (!Number.isFinite(available) || available < 0) {
            throw new Error(
                `Invalid available stock for ${String(goodKey)}: ${available}`,
            );
        }

        // Build demands array once - avoid repeated map/filter/sort
        const demands: Array<{ sectorId: keyof IndustrialSectors; originalDemand: number; remaining: number; priority: number }> = [];
        for (let i = 0; i < sectorRequests.length; i++) {
            const req = sectorRequests[i];
            const demand = req.idealDemand[goodKey] ?? 0;
            if (demand > 0) {
                demands.push({
                    sectorId: req.sectorId,
                    originalDemand: demand,
                    remaining: demand,
                    priority: req.priority,
                });
            }
        }

        if (demands.length === 0) continue;

        // Sort once for stable ordering
        demands.sort((a, b) => String(a.sectorId).localeCompare(String(b.sectorId)));

        const totalDemand = demands.reduce((sum, item) => sum + item.remaining, 0);

        if (!Number.isFinite(totalDemand)) {
            throw new Error(`Total demand overflow for ${String(goodKey)}`);
        }

        let remainingStock = Math.min(available, totalDemand);

        // Vectorized water-filling: single pass with pre-computed weights
        let active = demands;

        while (active.length > 0 && remainingStock > EPSILON) {
            // Compute total weight
            let totalWeight = 0;
            for (let i = 0; i < active.length; i++) {
                totalWeight += active[i].remaining * active[i].priority;
            }

            if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
                throw new Error(`Invalid allocation weights for ${String(goodKey)}`);
            }

            // Find saturated items in single pass
            const saturatedIndices: number[] = [];
            for (let i = 0; i < active.length; i++) {
                const item = active[i];
                const proposed = remainingStock * (item.remaining * item.priority) / totalWeight;
                if (proposed >= item.remaining - EPSILON) {
                    saturatedIndices.push(i);
                }
            }

            if (saturatedIndices.length > 0) {
                // Allocate saturated sectors
                const saturatedSet = new Set(saturatedIndices);
                
                for (const idx of saturatedIndices) {
                    const item = active[idx];
                    const amount = Math.min(item.remaining, remainingStock);
                    allocation[item.sectorId]![goodKey] = amount;
                    remainingStock -= amount;
                    item.remaining = 0;
                }

                // Compact active array (remove saturated)
                const newActive: typeof active = [];
                for (let i = 0; i < active.length; i++) {
                    if (!saturatedSet.has(i)) {
                        newActive.push(active[i]);
                    }
                }
                active = newActive;
                continue;
            }

            // No caps reached: distribute proportionally
            // Pre-compute all proposed amounts
            const proposedAmounts = new Array(active.length);
            for (let i = 0; i < active.length; i++) {
                const item = active[i];
                const proposed = remainingStock * (item.remaining * item.priority) / totalWeight;
                proposedAmounts[i] = Math.min(proposed, item.remaining);
            }

            for (let i = 0; i < active.length; i++) {
                const item = active[i];
                const amount = proposedAmounts[i];
                allocation[item.sectorId]![goodKey] = (allocation[item.sectorId]![goodKey] ?? 0) + amount;
                remainingStock -= amount;
                item.remaining -= amount;
            }

            // Filter still-active items
            const stillActive: typeof active = [];
            for (let i = 0; i < active.length; i++) {
                if (active[i].remaining > EPSILON) {
                    stillActive.push(active[i]);
                }
            }
            
            if (stillActive.length === 0 || remainingStock <= EPSILON) {
                break;
            }
            active = stillActive;
        }

        // Record unmet demand
        for (let i = 0; i < demands.length; i++) {
            const item = demands[i];
            if (item.remaining > EPSILON) {
                unmetDemand[item.sectorId]![goodKey] = (unmetDemand[item.sectorId]![goodKey] ?? 0) + item.remaining;
            }
        }
    }

    return { allocation, unmetDemand };
}
