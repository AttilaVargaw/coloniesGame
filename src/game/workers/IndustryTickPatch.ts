import type { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";


export interface IndustryTickPatch {
    entityId: string;
    goods?: Partial<Goods>;
    goodsRequirements?: Partial<Goods>;
    goodsProduction?: Partial<Goods>;
    workingWorkers?: Partial<Population>;
    freeWorkers?: Partial<Population>;
    populationUpdates?: Partial<Record<keyof Population, {
        qol?: number;
        expectedQol?: number;
        populationChange?: number;
        wealth?: number;
        number?: number;
        requirements?: Partial<Goods>;
    }>>;
    sectorProfits?: Partial<Record<keyof IndustrialSectors, number>>;
    populationProfits?: Partial<Record<keyof Population, number>>;
    sectorUtilization?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorResults?: {
        changed: Record<string, SectorResult>;
        removed: string[];
    };
    sectors?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorWealth?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorCapital?: Partial<Record<keyof IndustrialSectors, number>>;
}
