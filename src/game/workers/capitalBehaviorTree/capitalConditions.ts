import type { CapitalBlackboard } from "./capitalBT";
import type { Goods } from "../../data/Goods";
import { Condition } from "../../systems/sectorBehaviorTree/bt";

const REFERENCE_STOCK_MULTIPLIER = 100;

export class HasCapitalGoods extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return Object.keys(bb.capitalGoods).length > 0;
    }
}

export class HasProduction extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return bb.productionRatio > 0;
    }
}

export class HasDecay extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return bb.decay > 0;
    }
}

export class BelowTargetStock extends Condition<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    check(bb: CapitalBlackboard): boolean {
        const key: keyof Goods = this.goodKey as keyof Goods;
        const targetStock = this.rate * REFERENCE_STOCK_MULTIPLIER;
        const current = bb.currentStock[key] ?? 0;
        return current < targetStock;
    }
}

export class CanAffordReplenishment extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        let totalCost = 0;
        for(const [goodKey, amount] of Object.entries(bb.wearAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            totalCost += amt * (bb.prices[key] ?? 0);
        }
        for(const [goodKey, amount] of Object.entries(bb.decayAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            totalCost += amt * (bb.prices[key] ?? 0);
        }
        return bb.money - bb.moneySpent >= totalCost;
    }
}

export class CanAffordInvestment extends Condition<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    check(bb: CapitalBlackboard): boolean {
        const key: keyof Goods = this.goodKey as keyof Goods;
        const targetStock = this.rate * REFERENCE_STOCK_MULTIPLIER;
        const current = bb.currentStock[key] ?? 0;
        const needed = targetStock - current;
        if(needed <= 0) return false;
        const cost = needed * (bb.prices[key] ?? 0);
        return bb.money - bb.moneySpent >= cost;
    }
}

export class HasWearToReplenish extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return Object.values(bb.wearAmounts).some(a => (a ?? 0) > 0) ||
            Object.values(bb.decayAmounts).some(a => (a ?? 0) > 0);
    }
}
