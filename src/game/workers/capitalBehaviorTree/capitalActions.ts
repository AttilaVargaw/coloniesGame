import type { CapitalBlackboard } from "./capitalBT";
import type { Goods } from "../../data/Goods";
import { Action } from "../../systems/sectorBehaviorTree/bt";

const CASH_EPSILON = 1e-6;

/**
 * Validate that a value is finite and nonnegative, throwing on invalid input.
 */
function requireNonNegativeFinite(value: number, label: string): number {
    if(!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid ${label}: ${value}`);
    }
    return value;
}

/**
 * Validate and return price, stock, and remaining money for a capital purchase.
 * Throws if price is missing or any value is invalid.
 */
function getPurchaseInputs(
    bb: CapitalBlackboard,
    key: keyof Goods,
): { price: number; stock: number; money: number } {
    const rawPrice = bb.prices[key];

    if(rawPrice === undefined) {
        throw new Error(`Missing capital goods price: ${key}`);
    }

    const price = requireNonNegativeFinite(rawPrice, `price for ${key}`);
    const stock = requireNonNegativeFinite(
        bb.availableGoods[key] ?? 0,
        `available stock for ${key}`,
    );
    const money = requireNonNegativeFinite(bb.money, "capital budget");
    const spent = requireNonNegativeFinite(bb.moneySpent, "capital spending");

    if(spent > money + CASH_EPSILON) {
        throw new Error("Capital spending exceeds sector budget");
    }

    return { price, stock, money: Math.max(0, money - spent) };
}

export class ApplyWear extends Action<CapitalBlackboard> {
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        // Validate inputs before mutating state
        if(!Number.isFinite(bb.productionRatio) || bb.productionRatio < 0) {
            throw new Error(`Invalid production ratio: ${bb.productionRatio}`);
        }

        bb.wearAmounts = {};
        for(const [goodKey, rate] of Object.entries(bb.capitalGoods)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const desiredWearRate = requireNonNegativeFinite(
                rate,
                `capital goods rate for ${key}`,
            );
            const available = requireNonNegativeFinite(
                bb.currentStock[key] ?? 0,
                `capital stock for ${key}`,
            );

            const desiredWear = desiredWearRate * bb.productionRatio;
            // Cap wear at actual available stock
            const actualWear = Math.min(desiredWear, available);
            bb.wearAmounts[key] = actualWear;
            bb.currentStock[key] = Math.max(0, available - actualWear);
        }
        return "SUCCESS";
    }
}

export class ApplyDecay extends Action<CapitalBlackboard> {
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        bb.decayAmounts = {};

        // Decay rate must be between 0 and 1 inclusive
        const decayRate = requireNonNegativeFinite(bb.decay, "capital decay rate");
        if(decayRate > 1) {
            throw new Error(`Invalid capital decay rate: ${decayRate} (must be <= 1)`);
        }

        if(decayRate <= 0) return "SUCCESS";

        for(const goodKey of Object.keys(bb.currentStock)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const stock = requireNonNegativeFinite(
                bb.currentStock[key] ?? 0,
                `capital stock for ${key}`,
            );
            const amount = Math.min(stock, stock * decayRate);
            bb.decayAmounts[key] = amount;
            bb.currentStock[key] = Math.max(0, stock - amount);
        }
        return "SUCCESS";
    }
}

export class ReplenishLosses extends Action<CapitalBlackboard> {
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        bb.replenishAmounts = {};

        const totalLoss: Record<string, number> = { ...bb.wearAmounts };
        for(const [key, amount] of Object.entries(bb.decayAmounts)) {
            totalLoss[key] = (totalLoss[key] ?? 0) + (amount ?? 0);
        }

        for(const [goodKey, rawAmount] of Object.entries(totalLoss)) {
            const amount = requireNonNegativeFinite(
                rawAmount ?? 0,
                `capital loss for ${goodKey}`,
            );

            if(amount === 0) continue;

            const key: keyof Goods = goodKey as keyof Goods;
            const { price, stock, money } = getPurchaseInputs(bb, key);

            const affordable = price === 0 ? amount : money / price;
            const actualAmount = Math.min(amount, stock, affordable);
            const cost = actualAmount * price;

            if(!Number.isFinite(cost)) {
                throw new Error(`Capital replenishment cost overflow: ${key}`);
            }

            bb.moneySpent += cost;
            bb.replenishAmounts[key] = -actualAmount;
            bb.currentStock[key] = (bb.currentStock[key] ?? 0) + actualAmount;
            bb.availableGoods[key] = stock - actualAmount;
        }
        return "SUCCESS";
    }
}

export class InvestCapital extends Action<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }

    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        const key: keyof Goods = this.goodKey as keyof Goods;

        const rate = requireNonNegativeFinite(
            this.rate,
            `investment rate for ${key}`,
        );
        const targetStock = rate * 100;
        const current = requireNonNegativeFinite(
            bb.currentStock[key] ?? 0,
            `capital stock for ${key}`,
        );

        if(!Number.isFinite(targetStock)) {
            throw new Error(`Capital target overflow: ${key}`);
        }

        if(current >= targetStock) return "FAILURE";

        // One level of capital goods per tick
        const toBuy = Math.min(targetStock - current, rate);
        if(toBuy <= 0) return "FAILURE";

        const { price, stock, money } = getPurchaseInputs(bb, key);
        const affordable = price === 0 ? toBuy : money / price;
        const actualBuy = Math.min(toBuy, stock, affordable);

        if(actualBuy <= 0) return "FAILURE";

        const cost = actualBuy * price;
        if(!Number.isFinite(cost)) {
            throw new Error(`Capital investment cost overflow: ${key}`);
        }

        bb.moneySpent += cost;
        bb.currentStock[key] = current + actualBuy;
        bb.investAmounts[key] = -actualBuy;
        bb.availableGoods[key] = stock - actualBuy;

        return "SUCCESS";
    }
}
