import type { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";

export interface SectorExecutionResult {
    sectorResults: Record<string, SectorResult>;
    sectorProfits: Record<string, number>;
    sectorRevenue: Record<string, number>;
    sectorLaborCosts: Record<string, number>;
    sectorInputCosts: Record<string, number>;
    populationProfits: Record<string, number>;
    sectorUtilization: Record<string, number>;
    sectorStopReason: Record<string, string>;
    workingWorkers: Record<keyof Population, PopulationBreakdown>;
    remainingWorkers: Record<keyof Population, PopulationBreakdown>;
    sectorGoods: Record<keyof IndustrialSectors, Goods>;
    sumGoodsRequirements: Goods;
    sumGoodsProduction: Goods;
}
