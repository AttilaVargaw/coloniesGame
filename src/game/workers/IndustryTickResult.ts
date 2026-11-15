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
    populationUpdates: Record<keyof Population, {
        qol: number;
        expectedQol: number;
        populationChange: number;
        wealth: number;
        number: number;
        requirements: Record<string, number>;
    }>;
    goods: Goods;
    sectorProfits: Record<string, number>;
    sectorRevenue: Record<string, number>;
    sectorLaborCosts: Record<string, number>;
    sectorInputCosts: Record<string, number>;
    populationProfits: Record<string, number>;
    sectorUtilization: Record<string, number>;
    sectorStopReason: Record<string, string>;
    wages: Record<keyof Population, number>;
    sectorResults: Record<string, SectorResult>;
    capitalStock: Record<string, Partial<Goods>>;
    money: Record<string, number>;
    // sectorGoods: Record<string, Goods>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
    population: Population;
    unmetDemand: Partial<Goods>;
    deprivation: Partial<Record<keyof Goods, number>>;
}
