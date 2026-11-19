import { Entity } from "@engine/entities/entity";
import { EventBase } from "../events";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { SectorResult } from "@game/systems/generateIndustrialSector";
import type { InputPaymentBreakdown } from "@game/workers/industryTickHelpers";
import type { PurchaseProvenance } from "@game/workers/industryTickHelpers";

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
}

export interface IndustryTickCompletedData {
    entity: Entity;
    tick: number;
    metrics: IndustryTickMetricsData;
}

export class IndustryTickCompletedEvent extends EventBase<IndustryTickCompletedData> { }