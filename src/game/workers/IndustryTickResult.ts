import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { SectorResult } from "../systems/generateIndustrialSector";
import type { InputPaymentBreakdown } from "./industryTickHelpers";
import type { PurchaseProvenance } from "./industryTickHelpers";

export type { SectorResult } from "../systems/generateIndustrialSector";

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
    colonyTreasury: number;
    householdMoney: number;
    // sectorGoods: Record<string, Goods>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
    population: Population;
    unmetDemand: Partial<Goods>;
    deprivation: Partial<Record<keyof Goods, number>>;

    // Accounting summary for deterministic tick verification
    accounting: {
        householdSalesByGood: Partial<Goods>;
        capitalPurchasesByGood: Partial<Goods>;
        sectorProductionSalesByGood: Partial<Goods>;
        sectorInputsConsumedByGood?: Partial<Goods>;
        sectorProductionByGood?: Partial<Goods>;

        wagesByPop: Record<keyof Population, number>;
        spendingByPop: Record<keyof Population, number>;

        // Per-sector input reconciliation data
        sectorInputsPurchasedBySector: Record<string, Partial<Goods>>;
        sectorInputsConsumedBySector: Record<string, Partial<Goods>>;
        sectorInputRefundsBySector: Record<string, number>;
        
        // Explicit refund tracking for validation
        sectorInputRefundQuantitiesBySector: Record<string, Partial<Goods>>;
        sectorInputRefundAmountsBySector: Record<string, number>;
        
        returnedInputsByGood: Partial<Goods>;
        sectorInputPaymentBreakdown: InputPaymentBreakdown;
        purchaseProvenance: PurchaseProvenance;
        treasurySubsidiesPaid: Record<string, number>;
    };

    // Treasury financial data
    treasuryRevenue: number;
    treasuryExpenditure: number;
}
