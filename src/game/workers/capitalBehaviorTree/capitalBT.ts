import type { Goods } from "../../data/Goods";

export interface CapitalBlackboard {
    sectorName: string;
    currentStock: Partial<Goods>;
    capitalGoods: Partial<Record<keyof Goods, number>>;
    productionRatio: number;
    decay: number;
    prices: Partial<Record<keyof Goods, number>>;
    money: number;
    availableGoods: Partial<Record<keyof Goods, number>>;

    // Decision outputs
    wearAmounts: Partial<Goods>;
    decayAmounts: Partial<Goods>;
    replenishAmounts: Partial<Goods>;
    investAmounts: Partial<Goods>;
    moneySpent: number;
}

export const defaultCapitalBlackboard = (sectorName: string): CapitalBlackboard => ({
    sectorName,
    currentStock: {},
    capitalGoods: {},
    productionRatio: 0,
    decay: 0,
    prices: {},
    money: 0,
    availableGoods: {},
    wearAmounts: {},
    decayAmounts: {},
    replenishAmounts: {},
    investAmounts: {},
    moneySpent: 0,
});
