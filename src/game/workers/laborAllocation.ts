import { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

export interface LaborAllocationRequest {
    sectorId: keyof IndustrialSectors;
    idealDemand: Partial<Record<keyof Population, number>>;
    priority: number;
}

export interface LaborAllocationResult {
    allocation: Partial<
        Record<
            keyof IndustrialSectors,
            Partial<Record<keyof Population, number>>
        >
    >;
    unmetDemand: Partial<
        Record<
            keyof IndustrialSectors,
            Partial<Record<keyof Population, number>>
        >
    >;
}

const EPSILON = 1e-9;

/**
 * Centralized labor allocation.
 *
 * Allocates available workers across sectors independent of iteration order.
 * When total demand exceeds supply, allocation is proportional to each sector's
 * ideal demand weighted by priority, never exceeding a sector's requested demand.
 * Any excess from saturated sectors is redistributed to remaining sectors.
 *
 * Fractional workers are supported internally; rounding for display should be
 * handled separately by the UI layer.
 *
 * Returns the per-sector, per-population-type labor allocation and unmet demand.
 */
export function allocateLabor({
    availableWorkers,
    sectorRequests,
}: {
    availableWorkers: Record<keyof Population, number>;
    sectorRequests: LaborAllocationRequest[];
}): LaborAllocationResult {
    const allocation: LaborAllocationResult["allocation"] = {};
    const unmetDemand: LaborAllocationResult["unmetDemand"] = {};

    const seen = new Set<keyof IndustrialSectors>();

    for (const req of sectorRequests) {
        if (seen.has(req.sectorId)) {
            throw new Error(`Duplicate labor request for ${req.sectorId}`);
        }
        seen.add(req.sectorId);

        if (!Number.isFinite(req.priority) || req.priority <= 0) {
            throw new Error(
                `Invalid labor priority for ${req.sectorId}: ${req.priority}`,
            );
        }

        allocation[req.sectorId] = {};
        unmetDemand[req.sectorId] = {};

        for (const [key, demand] of Object.entries(req.idealDemand)) {
            if (!(key in availableWorkers)) {
                throw new Error(`Unknown population type in labor demand: ${key}`);
            }

            if (!Number.isFinite(demand) || demand < 0) {
                throw new Error(
                    `Invalid labor demand for ${req.sectorId}/${key}: ${demand}`,
                );
            }
        }
    }

    for (const popType of Object.keys(availableWorkers) as (keyof Population)[]) {
        const available = availableWorkers[popType];

        if (!Number.isFinite(available) || available < 0) {
            throw new Error(
                `Invalid available workers for ${String(popType)}: ${available}`,
            );
        }

        const demands = sectorRequests
            .map(req => ({
                sectorId: req.sectorId,
                remaining: req.idealDemand[popType] ?? 0,
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

        let remainingWorkers = Math.min(available, totalDemand);

        // Weighted allocation with demand caps and redistribution.
        let active = demands;

        while (active.length > 0 && remainingWorkers > EPSILON) {
            const totalWeight = active.reduce(
                (sum, item) => sum + item.remaining * item.priority,
                0,
            );

            if (totalWeight <= 0 || !Number.isFinite(totalWeight)) {
                throw new Error(
                    `Invalid labor allocation weights for ${String(popType)}`,
                );
            }

            const saturated = active.filter(item => {
                const proposed =
                    remainingWorkers *
                    (item.remaining * item.priority) /
                    totalWeight;

                return proposed >= item.remaining - EPSILON;
            });

            if (saturated.length > 0) {
                const saturatedIds = new Set(
                    saturated.map(item => item.sectorId),
                );

                for (const item of saturated) {
                    const amount = Math.min(item.remaining, remainingWorkers);

                    allocation[item.sectorId]![popType] = amount;
                    remainingWorkers -= amount;
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
                    ? remainingWorkers
                    : remainingWorkers *
                      (item.remaining * item.priority) /
                      totalWeight;

                const allocated = Math.min(amount, item.remaining);

                allocation[item.sectorId]![popType] = allocated;
                remainingWorkers -= allocated;
            }

            break;
        }

        // Record unmet demand.
        for (const item of demands) {
            const allocated =
                allocation[item.sectorId]?.[popType] ?? 0;

            const originalDemand =
                sectorRequests.find(
                    req => req.sectorId === item.sectorId,
                )?.idealDemand[popType] ?? 0;

            const unmet = originalDemand - allocated;

            if (unmet > EPSILON) {
                unmetDemand[item.sectorId]![popType] = unmet;
            }
        }
    }

    return { allocation, unmetDemand };
}
