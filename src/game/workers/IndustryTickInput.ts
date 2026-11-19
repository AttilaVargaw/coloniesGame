import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import { validatePrices } from "./industryTickHelpers";


export type ProducerInventories = Record<string, Partial<Record<keyof Goods, number>>>;

export interface PriceSnapshot {
    entityId: string;
    sourceTick: number;
    effectiveTick: number;
    prices: Readonly<Record<keyof Goods, number>>;
}

export interface IndustryTickInput {
    entityId: string;
    activeSectors: Set<keyof IndustrialSectors>;
    goods: Goods;
    population: Population;
    techMultipliers: Record<keyof IndustrialSectors, number>;
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
    sectorInvestment: Record<keyof IndustrialSectors, number>;
    activeLaws: Set<string>;

    // Producer inventories for source-aware procurement (optional, defaults to empty)
    producerInventories?: ProducerInventories;

    // Current tick number for ledger transactions
    tick: number;

    // Price snapshot with entity/tick identity
    prices: PriceSnapshot;
}

export function validatePriceSnapshot(
    snapshot: PriceSnapshot, 
    expectedEntityId: string, 
    expectedEffectiveTick: number
): void {
    if (snapshot.entityId !== expectedEntityId) {
        throw new Error(`Entity ID mismatch: expected ${expectedEntityId}, got ${snapshot.entityId}`);
    }
    if (snapshot.effectiveTick !== expectedEffectiveTick) {
        throw new Error(`Effective tick mismatch: expected ${expectedEffectiveTick}, got ${snapshot.effectiveTick}`);
    }
    validatePrices(snapshot.prices);
}