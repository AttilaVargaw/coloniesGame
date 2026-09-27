import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";


export interface IndustryTickInput {
    entityId: string;
    sectors: IndustrialSectors;
    goods: Goods;
    population: Population;
    sectorWealth: Record<keyof IndustrialSectors, number>;
    sectorCapital: Record<keyof IndustrialSectors, number>;
    upgradeSectors: string[];
    autoUpgradeSectors: Record<string, boolean>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
}
