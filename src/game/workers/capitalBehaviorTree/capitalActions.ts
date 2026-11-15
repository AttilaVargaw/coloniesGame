import type { CapitalBlackboard } from "./capitalBT";
import type { Goods } from "../../data/Goods";
import { Action } from "../../systems/sectorBehaviorTree/bt";

export class ApplyWear extends Action<CapitalBlackboard> {
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        bb.wearAmounts = {};
        for(const [goodKey, rate] of Object.entries(bb.capitalGoods)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const desiredWear = rate * bb.productionRatio;
            const available = bb.currentStock[key] ?? 0;
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
        if(bb.decay <= 0) return "SUCCESS";
        for(const goodKey of Object.keys(bb.currentStock)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const stock = bb.currentStock[key] ?? 0;
            const amount = stock * bb.decay;
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
        for(const [goodKey, amount] of Object.entries(totalLoss)) {
            if(!amount || amount <= 0) continue;
            const key: keyof Goods = goodKey as keyof Goods;
            const cost = amount * (bb.prices[key] ?? 0);
            if(bb.money - bb.moneySpent >= cost) {
                bb.moneySpent += cost;
                bb.replenishAmounts[key] = (bb.replenishAmounts[key] ?? 0) - amount;
                bb.currentStock[key] = (bb.currentStock[key] ?? 0) + amount;
            }
        }
        return "SUCCESS";
    }
}

export class InvestCapital extends Action<CapitalBlackboard> {
    constructor(public goodKey: string, public rate: number) { super(); }
    execute(bb: CapitalBlackboard): "SUCCESS" | "FAILURE" {
        const key: keyof Goods = this.goodKey as keyof Goods;
        const targetStock = this.rate * 100;
        const current = bb.currentStock[key] ?? 0;
        if(current >= targetStock) return "FAILURE";

        // One level of capital goods per tick
        const toBuy = Math.min(targetStock - current, this.rate);
        const price = bb.prices[key] ?? 0;
        if(toBuy <= 0 || price <= 0) return "FAILURE";

        const maxAffordable = Math.floor((bb.money - bb.moneySpent) / price);
        const actualBuy = Math.min(toBuy, maxAffordable);
        if(actualBuy <= 0) return "FAILURE";

        const buyCost = actualBuy * price;
        bb.moneySpent += buyCost;
        bb.currentStock[key] = current + actualBuy;
        bb.investAmounts[key] = (bb.investAmounts[key] ?? 0) - actualBuy;
        return "SUCCESS";
    }
}
