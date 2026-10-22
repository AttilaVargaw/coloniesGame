import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";

export interface IndustryTickResult {
    entityId: string;
    goodsRequirements: Partial<Goods>;
    goodsProduction: Partial<Goods>;
    workingWorkers: Population;
    freeWorkers: Population;
    populationUpdates: Record<string, {
        qol: number;
        expectedQol: number;
        populationChange: number;
        wealth: number;
        number: number;
        requirements: Record<string, number>;
    }>;
    goods: Goods;
    sectorProfits: Record<string, number>;
    populationProfits: Record<string, number>;
    sectorUtilization: Record<string, number>;
    sectorResults: Record<string, SectorResult>;
    capitalStock: Record<string, Partial<Goods>>;
    money: Record<string, number>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
}
