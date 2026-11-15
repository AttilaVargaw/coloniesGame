import type { IndustrialSectors } from "../components/Factories.ts";

export interface BudgetAllocationRequest {
    sectorId: keyof IndustrialSectors;
    sectorMoney: number;
    sectorInvestment: number;
    costPerUnit: number;
}

export interface BudgetAllocationResult {
    allocation: Partial<Record<keyof IndustrialSectors, { budgetRatio: number; availableBudget: number }>>;
}

/**
 * Centralized budget allocation.
 *
 * Computes budgetRatio for each sector based on available money and investment.
 * budgetRatio = min(1, (sectorMoney + sectorInvestment) / costPerUnit).
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
        const availableBudget = req.sectorMoney + req.sectorInvestment;
        const budgetRatio = req.costPerUnit > 0 ? Math.min(1, availableBudget / Math.max(req.costPerUnit, 1)) : 1;

        allocation[req.sectorId] = {
            budgetRatio,
            availableBudget,
        };
    }

    return { allocation };
}
