import type { SectorBlackboard } from "./bt";
import { Condition } from "./bt";

export class HasMoney extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.money > 0;
    }
}

export class IsProfitable extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.sectorProfits > 0;
    }
}

export class IsUnprofitable extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.sectorProfits < 0;
    }
}

export class HasCapitalDeficit extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        if (!blackboard.capitalGoods) return false;
        let minLevel = Infinity;
        let hasCapital = false;
        for (const [goodKey, rate] of Object.entries(blackboard.capitalGoods)) {
            hasCapital = true;
            const stock = blackboard.capitalStock[goodKey] ?? 0;
            const referenceConsumption = rate * 100;
            if (referenceConsumption <= 0) continue;
            const ratio = stock / referenceConsumption;
            minLevel = Math.min(minLevel, ratio);
        }
        if (!hasCapital) return false;
        return minLevel < 0.5;
    }
}

export class HasAdequateCapital extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        if (!blackboard.capitalGoods) return true;
        let minAdequacy = Infinity;
        let hasCapital = false;
        for (const [goodKey, rate] of Object.entries(blackboard.capitalGoods)) {
            hasCapital = true;
            const stock = blackboard.capitalStock[goodKey] ?? 0;
            const referenceConsumption = rate * 100;
            if (referenceConsumption <= 0) continue;
            const ratio = stock / referenceConsumption;
            minAdequacy = Math.min(minAdequacy, ratio);
        }
        if (!hasCapital) return true;
        return minAdequacy >= 0.5;
    }
}

export class HasLaborShortage extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        if (!blackboard.workerRequirement) return false;
        for (const [workerType] of Object.entries(blackboard.workerRequirement)) {
            const ratio = blackboard.workerMarketRatios[workerType] ?? 1;
            if (ratio < 0.8) return true;
        }
        return false;
    }
}

export class HasNoWorkers extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.laborAssigned <= 0;
    }
}

export class HasEnoughWorkers extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        if (!blackboard.workerRequirement) return true;
        for (const [workerType] of Object.entries(blackboard.workerRequirement)) {
            const ratio = blackboard.workerMarketRatios[workerType] ?? 1;
            if (ratio < 0.8) return false;
        }
        return true;
    }
}

export class UtilizationLow extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.sectorUtilization < 0.3;
    }
}

export class UtilizationHigh extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.sectorUtilization > 0.9;
    }
}

export class IsStopped extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.outputLevel <= 0;
    }
}

export class IsRunning extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        return blackboard.outputLevel > 0;
    }
}

export class CanAffordCapital extends Condition {
    check(blackboard: SectorBlackboard): boolean {
        if (!blackboard.capitalGoods) return false;
        let cheapestCost = Infinity;
        for (const [goodKey, rate] of Object.entries(blackboard.capitalGoods)) {
            const price = blackboard.prices[goodKey] ?? 0;
            if (price <= 0) continue;
            const needed = rate * 100 - (blackboard.capitalStock[goodKey] ?? 0);
            if (needed <= 0) continue;
            const cost = needed * price;
            cheapestCost = Math.min(cheapestCost, cost);
        }
        return cheapestCost <= blackboard.money && cheapestCost < Infinity;
    }
}
