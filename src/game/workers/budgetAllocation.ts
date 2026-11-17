import type { IndustrialSectors } from "../components/Factories.ts";

export interface BudgetAllocationRequest {
    sectorId: keyof IndustrialSectors;
    sectorMoney: number;
    totalOperatingCostAtFullScale: number;
}

export interface BudgetAllocationResult {
    allocation: Partial<Record<keyof IndustrialSectors, { budgetRatio: number; availableBudget: number }>>;
}

/**
 * Centralized operating budget allocation.
 *
 * Computes budgetRatio for each sector based on available operating cash
 * and total capital-adjusted operating costs (inputs + wages). Investment
 * money is reserved for capital purchases.
 *
 * budgetRatio = min(1, sectorMoney / totalOperatingCostAtFullScale)
 *
 * Returns budgetRatio and availableBudget per sector.
 */
export function allocateBudget({
    sectorRequests,
}: {
    sectorRequests: BudgetAllocationRequest[];
}): BudgetAllocationResult {
    const allocation: Partial<Record<keyof IndustrialSectors, { budgetRatio: number; availableBudget: number }>> = {};
    const seen = new Set<keyof IndustrialSectors>();

    for (const req of sectorRequests) {
        if (seen.has(req.sectorId)) {
            throw new Error(`Duplicate budget request for ${req.sectorId}`);
        }
        seen.add(req.sectorId);

        if (!Number.isFinite(req.sectorMoney) || req.sectorMoney < 0) {
            throw new Error(`Invalid operating cash for ${req.sectorId}: ${req.sectorMoney}`);
        }

        if (!Number.isFinite(req.totalOperatingCostAtFullScale) || req.totalOperatingCostAtFullScale < 0) {
            throw new Error(`Invalid operating cost for ${req.sectorId}: ${req.totalOperatingCostAtFullScale}`);
        }

        const availableBudget = req.sectorMoney;
        const budgetRatio = req.totalOperatingCostAtFullScale > 0
            ? Math.min(1, availableBudget / req.totalOperatingCostAtFullScale)
            : 1;

        if (!Number.isFinite(budgetRatio)) {
            throw new Error(`Invalid budget ratio for ${req.sectorId}: ${budgetRatio}`);
        }

        allocation[req.sectorId] = {
            budgetRatio,
            availableBudget,
        };
    }

    return { allocation };
}
