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
    money: Record<keyof IndustrialSectors, number>;
    // sectorGoods: Record<keyof IndustrialSectors, Goods>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;

    // ---- Gamification inputs ----
    workerEfficiencyMultipliers: Record<keyof Population, number>;
    materialRequirementMultipliers: Record<keyof Goods, number>;
    capitalMultipliers: Record<keyof IndustrialSectors, number>;
    selectedMethod: Record<keyof IndustrialSectors, string | null>;
    colonyTreasury: number;
    householdMoney: number;
    sectorInvestment: Record<keyof IndustrialSectors, number>;
    activeLaws: Set<string>;
}