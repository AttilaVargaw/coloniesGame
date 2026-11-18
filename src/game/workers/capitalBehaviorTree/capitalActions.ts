import type { CapitalBlackboard } from "./capitalBT";
import type { Goods } from "../../data/Goods";
import { Action } from "../../systems/sectorBehaviorTree/bt";

const CASH_EPSILON = 1e-9;

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
 * Shared cash-debit helper with validation.
 * Updates bb.money (remaining balance) and bb.moneySpent (cumulative spent).
 * Assumes cost has already been validated to not exceed bb.money.
 */
function debitCapitalMoney(
    bb: CapitalBlackboard,
    cost: number,
    label: string,
): void {
    requireNonNegativeFinite(cost, `${label} cost`);
    requireNonNegativeFinite(bb.money, `${label} remaining balance`);
    requireNonNegativeFinite(bb.moneySpent, `${label} previous spending`);

    if(cost > bb.money) {
        throw new Error(
            `${label} exceeds available cash: cost=${cost}, cash=${bb.money}`,
        );
    }

    const nextSpent = bb.moneySpent + cost;
    const nextMoney = bb.money - cost;

    if(!Number.isFinite(nextSpent) || !Number.isFinite(nextMoney)) {
        throw new Error(`${label} caused a cash accounting overflow`);
    }

    bb.moneySpent = nextSpent;
    bb.money = nextMoney; // cost already validated <= bb.money
}

/**
 * Validate and return price, stock, and remaining money for a capital purchase.
 * bb.money is the remaining balance; bb.moneySpent is cumulative spent.
 */
function getPurchaseInputs(
    bb: CapitalBlackboard,
    key: keyof Goods,
): { price: number; stock: number; remainingMoney: number } {
    const rawPrice = bb.prices[key];

    if(rawPrice === undefined) {
        throw new Error(`Missing capital goods price: ${key}`);
    }

    const price = requireNonNegativeFinite(rawPrice, `price for ${key}`);

    if(price <= 0) {
        throw new Error(`Zero or negative capital goods price not allowed: ${key} = ${price}`);
    }

    const stock = requireNonNegativeFinite(
        bb.availableGoods[key] ?? 0,
        `available stock for ${key}`,
    );
    const remainingMoney = requireNonNegativeFinite(
        bb.money,
        `remaining capital money for ${key}`,
    );

    return { price, stock, remainingMoney };
}

export class ApplyWear extends Action<CapitalBlackboard> {
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        // Validate inputs before mutating state
        if(
            !Number.isFinite(bb.productionRatio) ||
            bb.productionRatio < 0 ||
            bb.productionRatio > 1 + CASH_EPSILON
        ) {
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
            if(!Number.isFinite(desiredWear)) {
                throw new Error(`Capital wear overflow for ${key}`);
            }
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
        for(const [lossKey, amount] of Object.entries(bb.decayAmounts)) {
            const key = lossKey as keyof Goods;
            const nextLoss = (totalLoss[key] ?? 0) + (amount ?? 0);
            if(!Number.isFinite(nextLoss)) {
                throw new Error(`Capital loss overflow for ${key}`);
            }
            totalLoss[key] = nextLoss;
        }

        for(const [goodKey, rawAmount] of Object.entries(totalLoss)) {
            const amount = requireNonNegativeFinite(
                rawAmount ?? 0,
                `capital loss for ${goodKey}`,
            );

            if(amount === 0) continue;

            const key: keyof Goods = goodKey as keyof Goods;
            const { price, stock, remainingMoney } = getPurchaseInputs(bb, key);

            // Calculate max affordable so cost cannot exceed remainingMoney
            const maxAffordable = price === 0 ? amount : remainingMoney / price;
            const actualAmount = Math.min(amount, stock, maxAffordable);
            const cost = actualAmount * price;

            if(!Number.isFinite(cost)) {
                throw new Error(`Capital replenishment cost overflow: ${key}`);
            }

            debitCapitalMoney(bb, cost, `Capital replenishment ${key}`);
            bb.replenishAmounts[key] = -actualAmount;

            const nextStock = (bb.currentStock[key] ?? 0) + actualAmount;
            if(!Number.isFinite(nextStock)) {
                throw new Error(`Capital stock overflow: ${key}`);
            }
            bb.currentStock[key] = nextStock;
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

        if(current >= targetStock) return "SUCCESS";

        // One level of capital goods per tick
        const toBuy = Math.min(targetStock - current, rate);
        if(toBuy <= 0) return "SUCCESS";

        const { price, stock, remainingMoney } = getPurchaseInputs(bb, key);

        // Calculate max affordable so cost cannot exceed remainingMoney
        const maxAffordable = price === 0 ? toBuy : remainingMoney / price;
        const actualBuy = Math.min(toBuy, stock, maxAffordable);

        if(actualBuy <= 0) return "SUCCESS";

        const cost = actualBuy * price;
        if(!Number.isFinite(cost)) {
            throw new Error(`Capital investment cost overflow: ${key}`);
        }

        debitCapitalMoney(bb, cost, `Capital investment ${key}`);

        const nextStock = (bb.currentStock[key] ?? 0) + actualBuy;
        if(!Number.isFinite(nextStock)) {
            throw new Error(`Capital stock overflow: ${key}`);
        }
        bb.currentStock[key] = nextStock;
        bb.investAmounts[key] = -actualBuy;
        bb.availableGoods[key] = stock - actualBuy;

        return "SUCCESS";
    }
}
