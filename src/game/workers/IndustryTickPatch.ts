import type { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";
import type { InputPaymentBreakdown } from "./industryTickHelpers";
import type { PurchaseProvenance } from "./industryTickHelpers";

export interface IndustryTickMetricsData {
    populationUpdates: Record<keyof Population, {
        qol: number;
        expectedQol: number;
        populationChange: number;
        wealth: number;
        number: number;
        requirements: Record<string, number>;
    }>;
    workingWorkers: Population;
    freeWorkers: Population;

    goodsProduction: Partial<Goods>;
    goodsRequirements: Partial<Goods>;

    sectorResults: Record<string, SectorResult>;
    sectorUtilization: Record<string, number>;
    sectorLaborCosts: Record<string, number>;
    sectorInputCosts: Record<string, number>;

    accounting: {
        householdSalesByGood: Partial<Goods>;
        capitalPurchasesByGood: Partial<Goods>;
        sectorProductionSalesByGood: Partial<Goods>;
        sectorInputsConsumedByGood?: Partial<Goods>;
        sectorProductionByGood?: Partial<Goods>;

        wagesByPop: Record<keyof Population, number>;
        spendingByPop: Record<keyof Population, number>;

        sectorInputsPurchasedBySector: Record<string, Partial<Goods>>;
        sectorInputsConsumedBySector: Record<string, Partial<Goods>>;
        sectorInputRefundsBySector: Record<string, number>;

        sectorInputRefundQuantitiesBySector: Record<string, Partial<Goods>>;
        sectorInputRefundAmountsBySector: Record<string, number>;

        returnedInputsByGood: Partial<Goods>;
        sectorInputPaymentBreakdown: InputPaymentBreakdown;
        purchaseProvenance: PurchaseProvenance;
        treasurySubsidiesPaid: Record<string, number>;
    };

    money: Record<string, number>;
    colonyTreasury: number;
    treasuryRevenue: number;
    treasuryExpenditure: number;
}

export interface IndustryTickPatch {
    entityId: string;
    tick: number;
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
    sectorRevenue?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorLaborCosts?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorInputCosts?: Partial<Record<keyof IndustrialSectors, number>>;
    populationProfits?: Partial<Record<keyof Population, number>>;
    wages?: Partial<Record<keyof Population, number>>;
    sectorUtilization?: Partial<Record<keyof IndustrialSectors, number>>;
    sectorStopReason?: Partial<Record<keyof IndustrialSectors, string>>;
    capitalStock?: Partial<Record<keyof IndustrialSectors, Partial<Goods>>>;
    money?: Partial<Record<keyof IndustrialSectors, number>>;
    colonyTreasury?: number;
    householdMoney?: number;
    sectorGoods?: Partial<Record<keyof IndustrialSectors, Goods>>;
    sectorResults?: {
        changed: Record<string, SectorResult>;
        removed: string[];
    };
    // Metrics data for economic history (only populated on completed ticks)
    metrics?: IndustryTickMetricsData;
}
