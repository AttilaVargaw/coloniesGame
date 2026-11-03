import type { SectorBlackboard } from "./bt";
import { Action, BTStatus } from "./bt";

export class EmergencyStop extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        blackboard.decisions.stopProduction = true;
        blackboard.decisions.laborAssigned = 0;
        blackboard.decisions.sectorInvestment = 0;
        blackboard.decisions.buyCapital = false;
        return "SUCCESS";
    }
}

export class NormalOperations extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        blackboard.decisions.stopProduction = false;
        blackboard.decisions.restartProduction = true;
        blackboard.decisions.buyCapital = false;
        return "SUCCESS";
    }
}

export class ReduceProduction extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        blackboard.decisions.laborAssigned = Math.floor(blackboard.laborAssigned * 0.75);
        blackboard.decisions.sectorInvestment = 0;
        return "SUCCESS";
    }
}

export class IncreaseLabor extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        blackboard.decisions.laborAssigned = blackboard.freeWorkers > 0
            ? Math.min(blackboard.freeWorkers, blackboard.laborAssigned + 50)
            : blackboard.laborAssigned;
        return "SUCCESS";
    }
}

export class BuyCapital extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        if (!blackboard.capitalGoods) return "FAILURE";

        let bestGood: string | null = null;
        let bestCost = Infinity;

        for (const [goodKey, rate] of Object.entries(blackboard.capitalGoods)) {
            const price = blackboard.prices[goodKey] ?? 0;
            if (price <= 0) continue;
            const stock = blackboard.capitalStock[goodKey] ?? 0;
            const needed = rate * 100 - stock;
            if (needed <= 0) continue;
            const cost = needed * price;
            if (cost < bestCost) {
                bestCost = cost;
                bestGood = goodKey;
            }
        }

        if (!bestGood || bestCost > blackboard.money) return "FAILURE";

        blackboard.decisions.sectorInvestment = bestCost;
        blackboard.decisions.buyCapital = true;
        blackboard.decisions.restartProduction = true;
        return "SUCCESS";
    }
}

export class Idle extends Action {
    execute(_blackboard: SectorBlackboard): BTStatus {
        // Maintain current state, no changes
        return "SUCCESS";
    }
}

export class HireWorkers extends Action {
    execute(blackboard: SectorBlackboard): BTStatus {
        blackboard.decisions.laborAssigned = Math.min(
            blackboard.freeWorkers,
            blackboard.laborAssigned + 25
        );
        return "SUCCESS";
    }
}
