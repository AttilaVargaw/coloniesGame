export type BTStatus = "SUCCESS" | "FAILURE" | "RUNNING";

export interface BTNode {
    tick(blackboard: SectorBlackboard): BTStatus;
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

export class Sequence implements BTNode {
    constructor(public children: BTNode[]) {}

    tick(blackboard: SectorBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status !== "SUCCESS") return status;
        }
        return "SUCCESS";
    }
}

export class Selector implements BTNode {
    constructor(public children: BTNode[]) {}

    tick(blackboard: SectorBlackboard): BTStatus {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status === "SUCCESS") return status;
        }
        return "FAILURE";
    }
}

export abstract class Condition implements BTNode {
    abstract check(blackboard: SectorBlackboard): boolean;

    tick(blackboard: SectorBlackboard): BTStatus {
        return this.check(blackboard) ? "SUCCESS" : "FAILURE";
    }
}

export abstract class Action implements BTNode {
    abstract execute(blackboard: SectorBlackboard): BTStatus;

    tick(blackboard: SectorBlackboard): BTStatus {
        return this.execute(blackboard);
    }
}

export class Inverter implements BTNode {
    constructor(public child: BTNode) {}

    tick(blackboard: SectorBlackboard): BTStatus {
        const status = this.child.tick(blackboard);
        if (status === "SUCCESS") return "FAILURE";
        if (status === "FAILURE") return "SUCCESS";
        return status;
    }
}
