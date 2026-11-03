import type { Goods } from "../../data/Goods";

export interface IndustryBlackboard {
    entityId: string;
    settlementType: string;

    // Colony-wide aggregates
    totalMoney: number;
    totalSectorProfits: number;
    totalSectorRevenue: number;
    totalSectorLaborCosts: number;
    totalSectorInputCosts: number;
    totalPopulation: number;
    totalFreeWorkers: number;

    // Colony goods state
    colonyGoods: Partial<Goods>;
    colonyGoodsProduction: Partial<Goods>;
    colonyGoodsRequirements: Partial<Goods>;

    // Per-sector data (lookup by sector name)
    sectorProfits: Record<string, number>;
    sectorRevenue: Record<string, number>;
    sectorLaborCosts: Record<string, number>;
    sectorUtilization: Record<string, number>;

    // Wages by population type
    wages: Record<string, number>;

    // Decision outputs
    investmentPriority: Record<string, number>;  // sector name -> priority score (0-1)
    shutdownSectors: Set<string>;
    emergencyStopAll: boolean;
    investTotal: number;
}

export const defaultIndustryBlackboard = (
    entityId: string,
    settlementType: string,
): IndustryBlackboard => ({
    entityId,
    settlementType,
    totalMoney: 0,
    totalSectorProfits: 0,
    totalSectorRevenue: 0,
    totalSectorLaborCosts: 0,
    totalSectorInputCosts: 0,
    totalPopulation: 0,
    totalFreeWorkers: 0,
    colonyGoods: {},
    colonyGoodsProduction: {},
    colonyGoodsRequirements: {},
    sectorProfits: {},
    sectorRevenue: {},
    sectorLaborCosts: {},
    sectorUtilization: {},
    wages: {},
    investmentPriority: {},
    shutdownSectors: new Set(),
    emergencyStopAll: false,
    investTotal: 0,
});
