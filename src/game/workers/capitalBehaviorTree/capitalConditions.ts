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
        // Aggregate wear+decay losses by good so combined requirements are respected
        const totalLossByGood: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
        let totalCost = 0;

        for(const [goodKey, amount] of Object.entries(bb.wearAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            if(amt > 0) {
                totalLossByGood[key] = (totalLossByGood[key] ?? 0) + amt;
                const price = bb.prices[key] ?? 0;
                if(!Number.isFinite(price) || price < 0) return false;
                totalCost += amt * price;
            }
        }
        for(const [goodKey, amount] of Object.entries(bb.decayAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            if(amt > 0) {
                totalLossByGood[key] = (totalLossByGood[key] ?? 0) + amt;
                const price = bb.prices[key] ?? 0;
                if(!Number.isFinite(price) || price < 0) return false;
                totalCost += amt * price;
            }
        }

        // Condition passes if there is any valid replenishment opportunity:
        // at least one loss quantity > 0 that can be partially covered by stock or money.
        const moneyAvailable = bb.money - bb.moneySpent;
        let anyOpportunity = false;

        for(const [goodKey, amount] of Object.entries(totalLossByGood)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            const stockAvailable = bb.availableGoods[key] ?? 0;
            const price = bb.prices[key] ?? 0;

            // Valid opportunity if stock or money can cover any positive amount
            const maxByStock = stockAvailable > 0 ? stockAvailable : 0;
            const maxByMoney = price > 0 ? Math.floor(moneyAvailable / price) : (stockAvailable > 0 ? amt : 0);
            if(maxByStock > 0 || maxByMoney > 0) {
                anyOpportunity = true;
                break;
            }
        }

        return anyOpportunity && moneyAvailable >= 0;
    }
}

export class CanAffordInvestment extends Condition<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    check(bb: CapitalBlackboard): boolean {
        const key: keyof Goods = this.goodKey as keyof Goods;

        // Validate inputs
        if(!Number.isFinite(this.rate) || this.rate <= 0) return false;
        const price = bb.prices[key] ?? 0;
        if(!Number.isFinite(price) || price < 0) return false;
        const currentStock = bb.currentStock[key] ?? 0;
        if(!Number.isFinite(currentStock) || currentStock < 0) return false;

        const targetStock = this.rate * REFERENCE_STOCK_MULTIPLIER;
        const current = currentStock;
        const needed = targetStock - current;
        if(needed <= 0) return false;

        // One level of capital goods per tick
        const toBuy = Math.min(needed, this.rate);
        const stockAvailable = bb.availableGoods[key] ?? 0;
        const moneyAvailable = bb.money - bb.moneySpent;

        if(stockAvailable < toBuy) return false;
        if(price <= 0) {
            return true; // Free goods, stock available
        }
        return moneyAvailable >= toBuy * price;
    }
}

export class HasWearToReplenish extends Condition<CapitalBlackboard> {
    check(bb: CapitalBlackboard): boolean {
        return Object.values(bb.wearAmounts).some(a => (a ?? 0) > 0) ||
            Object.values(bb.decayAmounts).some(a => (a ?? 0) > 0);
    }
}
