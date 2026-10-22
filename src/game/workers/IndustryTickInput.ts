import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";


export interface IndustryTickInput {
    entityId: string;
    activeSectors: Set<keyof IndustrialSectors>;
    goods: Goods;
    population: Population;
    techMultipliers: Record<keyof IndustrialSectors, number>;
    laborAssigned: Record<keyof IndustrialSectors, number>;
    capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>;
    money: number;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
}