import type { Goods } from "../../data/Goods";

export interface CapitalBlackboard {
    sectorName: string;

    currentStock: Partial<Goods>;
    capitalGoods: Partial<Record<keyof Goods, number>>;

    productionRatio: number;
    decay: number;

    prices: Partial<Record<keyof Goods, number>>;

    openingMoney: number;
    money: number;

    availableGoods: Partial<Record<keyof Goods, number>>;

    // Physical losses during this tick.
    wearAmounts: Partial<Goods>;
    decayAmounts: Partial<Goods>;

    // Negative inventory deltas for purchased capital goods.
    replenishAmounts: Partial<Goods>;
    investAmounts: Partial<Goods>;

    // Total cash expenditure during this tick.
    moneySpent: number;
}

export const defaultCapitalBlackboard = (sectorName: string): CapitalBlackboard => ({
    sectorName,
    currentStock: {},
    capitalGoods: {},
    productionRatio: 0,
    decay: 0,
    prices: {},
    openingMoney: 0,
    money: 0,
    availableGoods: {},
    wearAmounts: {},
    decayAmounts: {},
    replenishAmounts: {},
    investAmounts: {},
    moneySpent: 0,
});
