import type { IndustrialSectors } from "../components/Factories.ts";

export interface BudgetAllocationRequest {
    sectorId: keyof IndustrialSectors;
    sectorMoney: number;
    inputCostPerUnit: number;
}

export interface BudgetAllocationResult {
    allocation: Partial<Record<keyof IndustrialSectors, { budgetRatio: number; availableBudget: number }>>;
}

/**
 * Centralized input budget allocation.
 *
 * Computes budgetRatio for each sector based on available operating cash
 * and capital-adjusted input costs. Labor affordability is handled separately
 * by the labor allocator; investment money is reserved for capital purchases.
 *
 * budgetRatio = min(1, sectorMoney / inputCostPerUnit)
 *
 * Returns budgetRatio and availableBudget per sector.
 */
export function allocateBudget({
    sectorRequests,
}: {
    sectorRequests: BudgetAllocationRequest[];
}): BudgetAllocationResult {
    const allocation: Partial<Record<keyof IndustrialSectors, { budgetRatio: number; availableBudget: number }>> = {};

    for (const req of sectorRequests) {
        const availableBudget = req.sectorMoney;
        const budgetRatio = req.inputCostPerUnit > 0 ? Math.min(1, availableBudget / req.inputCostPerUnit) : 1;

        allocation[req.sectorId] = {
            budgetRatio,
            availableBudget,
        };
    }

    return { allocation };
}
