export type BTStatus = "SUCCESS" | "FAILURE" | "RUNNING";

export interface BTNode<TBlackboard = any> {
    tick(blackboard: TBlackboard): BTStatus;
}

export interface SectorBlackboard {
    sectorName: string;
    money: number;
    capitalStock: Record<string, number>;
    sectorProfits: number;
    sectorRevenue: number;
    sectorLaborCosts: number;
    sectorInputCosts: number;
    sectorUtilization: number;
    laborAssigned: number;
    freeWorkers: number;
    prices: Record<string, number>;
    salaries: Record<string, number>;
    workerMarketRatios: Record<string, number>;
    capitalGoods?: Record<string, number>;
    workerRequirement?: Record<string, number>;
    goodsProduction?: Record<string, number>;
    outputLevel: number;
    inputLevel: number;
    investmentPriority: number;
    investRemaining: number;
    decisions: SectorDecisions;
}

export interface SectorDecisions {
    laborAssigned: number;
    sectorInvestment: number;
    stopProduction: boolean;
    restartProduction: boolean;
    buyCapital: boolean;
}

export const defaultDecisions: SectorDecisions = {
    laborAssigned: 0,
    sectorInvestment: 0,
    stopProduction: false,
    restartProduction: false,
    buyCapital: false,
};

export class Sequence<TBlackboard = any> implements BTNode<TBlackboard> {
    constructor(public children: BTNode<TBlackboard>[]) {}

    tick(blackboard: TBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status !== "SUCCESS") return status;
        }
        return "SUCCESS";
    }
}

export class Selector<TBlackboard = any> implements BTNode<TBlackboard> {
    constructor(public children: BTNode<TBlackboard>[]) {}

    tick(blackboard: TBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status === "SUCCESS") return status;
        }
        return "FAILURE";
    }
}

export abstract class Condition<TBlackboard = any> implements BTNode<TBlackboard> {
    abstract check(blackboard: TBlackboard): boolean;

    tick(blackboard: TBlackboard): BTStatus {
        return this.check(blackboard) ? "SUCCESS" : "FAILURE";
    }
}

export abstract class Action<TBlackboard = any> implements BTNode<TBlackboard> {
    abstract execute(blackboard: TBlackboard): BTStatus;

    tick(blackboard: TBlackboard): BTStatus {
        return this.execute(blackboard);
    }
}

export class Inverter<TBlackboard = any> implements BTNode<TBlackboard> {
    constructor(public child: BTNode<TBlackboard>) {}

    tick(blackboard: TBlackboard): BTStatus {
        const status = this.child.tick(blackboard);
        if (status === "SUCCESS") return "FAILURE";
        if (status === "FAILURE") return "SUCCESS";
        return status;
    }
}
