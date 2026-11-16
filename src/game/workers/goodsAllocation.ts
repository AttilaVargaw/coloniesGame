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
            if (!(key in availableGoods)) {
                throw new Error(`Unknown good in demand: ${key}`);
            }

            if (!Number.isFinite(demand) || demand < 0) {
                throw new Error(
                    `Invalid demand for ${req.sectorId}/${key}: ${demand}`,
                );
            }
        }
    }

    for (const goodKey of Object.keys(availableGoods) as (keyof Goods)[]) {
        const available = availableGoods[goodKey];

        if (!Number.isFinite(available) || available < 0) {
            throw new Error(
                `Invalid available stock for ${String(goodKey)}: ${available}`,
            );
        }

        const demands = sectorRequests
            .map(req => ({
                sectorId: req.sectorId,
                remaining: req.idealDemand[goodKey] ?? 0,
                priority: req.priority,
            }))
            .filter(item => item.remaining > 0)
            .sort((a, b) =>
                String(a.sectorId).localeCompare(String(b.sectorId))
            );

        const totalDemand = demands.reduce(
            (sum, item) => sum + item.remaining,
            0,
        );

        if (totalDemand === 0) continue;

        let remainingStock = Math.min(available, totalDemand);

        // Weighted allocation with demand caps and redistribution.
        let active = demands;

        while (active.length > 0 && remainingStock > EPSILON) {
            const totalWeight = active.reduce(
                (sum, item) => sum + item.remaining * item.priority,
                0,
            );

            if (totalWeight <= 0 || !Number.isFinite(totalWeight)) {
                throw new Error(
                    `Invalid allocation weights for ${String(goodKey)}`,
                );
            }

            const saturated = active.filter(item => {
                const proposed =
                    remainingStock *
                    (item.remaining * item.priority) /
                    totalWeight;

                return proposed >= item.remaining - EPSILON;
            });

            if (saturated.length > 0) {
                const saturatedIds = new Set(
                    saturated.map(item => item.sectorId),
                );

                for (const item of saturated) {
                    const amount = Math.min(item.remaining, remainingStock);

                    allocation[item.sectorId]![goodKey] = amount;
                    remainingStock -= amount;
                    item.remaining -= amount;
                }

                active = active.filter(
                    item => !saturatedIds.has(item.sectorId),
                );

                continue;
            }

            // No demand caps are reached: distribute the remaining stock.
            // Sorting ensures floating-point remainder handling is stable.
            for (let i = 0; i < active.length; i++) {
                const item = active[i];

                const amount = i === active.length - 1
                    ? remainingStock
                    : remainingStock *
                      (item.remaining * item.priority) /
                      totalWeight;

                const allocated = Math.min(amount, item.remaining);

                allocation[item.sectorId]![goodKey] = allocated;
                remainingStock -= allocated;
            }

            break;
        }

        // Record unmet demand.
        for (const item of demands) {
            const allocated =
                allocation[item.sectorId]?.[goodKey] ?? 0;

            const originalDemand =
                sectorRequests.find(
                    req => req.sectorId === item.sectorId,
                )?.idealDemand[goodKey] ?? 0;

            const unmet = originalDemand - allocated;

            if (unmet > EPSILON) {
                unmetDemand[item.sectorId]![goodKey] = unmet;
            }
        }
    }

    return { allocation, unmetDemand };
}
