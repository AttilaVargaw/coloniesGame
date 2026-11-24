import type { CapitalBlackboard } from "./capitalBT";
import type { Goods } from "../../data/Goods";
import { Condition } from "../../systems/sectorBehaviorTree/bt";

const REFERENCE_STOCK_MULTIPLIER = 100;
const CASH_EPSILON = 1e-9;

/**
 * Shared helper: aggregate wear and decay losses with validation.
 * Throws on invalid or overflow values.
 */
function getTotalLossByGood(
    bb: CapitalBlackboard,
): Partial<Record<keyof Goods, number>> {
    const result: Partial<Record<keyof Goods, number>> = {};

    for(const source of [bb.wearAmounts, bb.decayAmounts]) {
        for(const [goodKey, rawAmount] of Object.entries(source)) {
            const key = goodKey as keyof Goods;
            const amount = rawAmount ?? 0;

            if(!Number.isFinite(amount) || amount < 0) {
                throw new Error(`Invalid capital loss for ${key}: ${amount}`);
            }

            const next = (result[key] ?? 0) + amount;

            if(!Number.isFinite(next)) {
                throw new Error(`Capital loss overflow for ${key}`);
            }

            result[key] = next;
        }
    }

    return result;
}

/**
 * Shared helper: compute the maximum purchasable quantity for a good.
 * Validates all inputs and throws on invalid state.
 */
function getPurchaseCapacity(
    bb: CapitalBlackboard,
    key: keyof Goods,
    requested: number,
): number {
    const price = bb.prices[key];
    const stock = bb.availableGoods[key] ?? 0;
    const money = bb.money;

    if(price === undefined || !Number.isFinite(price) || price <= 0) {
        throw new Error(`Invalid or zero capital goods price: ${key} = ${price}`);
    }

    if(!Number.isFinite(stock) || stock < 0) {
        throw new Error(`Invalid available stock: ${key}`);
    }

    if(!Number.isFinite(money) || money < -1e-10) {
        throw new Error(`Invalid capital cash balance: ${money}`);
    }

    if(!Number.isFinite(requested) || requested < 0) {
        throw new Error(`Invalid requested capital quantity: ${requested}`);
    }

    const affordable = money / price;

    return Math.min(requested, stock, affordable);
}

export class HasCapitalGoods extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return Object.keys(bb.capitalGoods).length > 0;
    }
}

export class HasProduction extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        if(
            !Number.isFinite(bb.productionRatio) ||
            bb.productionRatio < 0 ||
            bb.productionRatio > 1 + CASH_EPSILON
        ) {
            throw new Error(`Invalid production ratio: ${bb.productionRatio}`);
        }

        return bb.productionRatio > 0;
    }
}

export class HasDecay extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        if(
            !Number.isFinite(bb.decay) ||
            bb.decay < 0 ||
            bb.decay > 1
        ) {
            throw new Error(`Invalid capital decay: ${bb.decay}`);
        }

        return bb.decay > 0;
    }
}

export class BelowTargetStock extends Condition<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    check(bb: CapitalBlackboard): boolean {
        if(!Number.isFinite(this.rate) || this.rate <= 0) {
            throw new Error(`Invalid investment rate for ${this.goodKey}: ${this.rate}`);
        }

        const key: keyof Goods = this.goodKey as keyof Goods;
        const current = bb.currentStock[key] ?? 0;

        if(!Number.isFinite(current) || current < 0) {
            throw new Error(`Invalid capital stock for ${key}: ${current}`);
        }

        const targetStock = this.rate * REFERENCE_STOCK_MULTIPLIER;

        if(!Number.isFinite(targetStock)) {
            throw new Error(`Capital target stock overflow for ${this.goodKey}`);
        }

        return current < targetStock;
    }
}

export class CanAffordReplenishment extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        const totalLossByGood = getTotalLossByGood(bb);

        // Condition passes if there is any valid replenishment opportunity:
        // at least one loss quantity > 0 that can be partially covered by stock or money.
        return Object.entries(totalLossByGood).some(([goodKey, amount]) =>
            getPurchaseCapacity(
                bb,
                goodKey as keyof Goods,
                amount ?? 0,
            ) > 0,
        );
    }
}

export class CanAffordInvestment extends Condition<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    check(bb: CapitalBlackboard): boolean {
        const key: keyof Goods = this.goodKey as keyof Goods;

        // Validate configuration — throw on invalid setup
        if(!Number.isFinite(this.rate) || this.rate <= 0) {
            throw new Error(`Invalid investment rate for ${this.goodKey}: ${this.rate}`);
        }
        const price = bb.prices[key];
        if(price === undefined || !Number.isFinite(price) || price < 0) {
            throw new Error(`Invalid capital goods price for ${key}: ${price}`);
        }
        const currentStock = bb.currentStock[key] ?? 0;
        if(!Number.isFinite(currentStock) || currentStock < 0) {
            throw new Error(`Invalid capital stock for ${key}: ${currentStock}`);
        }

        const targetStock = this.rate * REFERENCE_STOCK_MULTIPLIER;
        if(!Number.isFinite(targetStock)) {
            throw new Error(`Capital target stock overflow for ${this.goodKey}`);
        }
        const needed = targetStock - currentStock;
        if(needed <= 0) return false;

        // One level of capital goods per tick
        const toBuy = Math.min(needed, this.rate);

        // Check if *any* amount can be purchased (aligned with InvestCapital action)
        return getPurchaseCapacity(bb, key, toBuy) > 1e-10;
    }
}

export class HasWearToReplenish extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return Object.values(bb.wearAmounts).some(a => (a ?? 0) > 0) ||
            Object.values(bb.decayAmounts).some(a => (a ?? 0) > 0);
    }
}
