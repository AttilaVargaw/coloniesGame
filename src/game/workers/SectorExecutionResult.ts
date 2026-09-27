import type { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";

export interface SectorExecutionResult {
    sectorResults: Record<string, SectorResult>;
    sectorProfits: Record<string, number>;
    sectorMaintenance: Record<string, number>;
    sectorUtilization: Record<string, number>;
    workingWorkers: Record<keyof Population, PopulationBreakdown>;
    remainingWorkers: Record<keyof Population, PopulationBreakdown>;
    remainingGoods: Goods;
    sumGoodsRequirements: Goods;
    sumGoodsProduction: Goods;
    currentSectorCapital: Record<keyof IndustrialSectors, number>;
}
