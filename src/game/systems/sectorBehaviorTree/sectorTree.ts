import type { SectorBlackboard } from "./bt";
import { Sequence, Selector, BTNode } from "./bt";
import { defaultDecisions } from "./bt";
import {
    GreaterThan,
    LessThan,
} from "./generic";
import {
    HasCapitalDeficit,
    CanAffordCapital,
    HasLaborShortage,
} from "./sectorConditions";
import {
    NormalOperations,
    ReduceProduction,
    BuyCapital,
    Idle,
    HireWorkers,
} from "./sectorActions";

export function createSectorTree(_blackboard: SectorBlackboard): BTNode {
    return new Sequence([
        // 1. Solvency check: don't stop broke sectors entirely — let budgetRatio handle it
        // Generic condition: GreaterThan("money", 0) works on any blackboard with a "money" key
        new Selector([
            new GreaterThan("money", 0),
            new Idle(),  // stay in bids even with 0 money; budgetRatio floor allows minimal production
        ]),

        // 2. Profitability branch
        // Generic conditions: GreaterThan/LessThan on "sectorProfits"
        new Selector([
            new Sequence([
                new GreaterThan("sectorProfits", 0),
                new NormalOperations(),
            ]),
            new Sequence([
                new LessThan("sectorProfits", 0),
                new ReduceProduction(),
            ]),
        ]),

        // 3. Capital investment branch
        new Selector([
            new Sequence([
                new HasCapitalDeficit(),
                new CanAffordCapital(),
                new BuyCapital(),
            ]),
            new Idle(),
        ]),

        // 4. Labor hiring branch
        new Selector([
            new Sequence([
                new HasLaborShortage(),
                new GreaterThan("freeWorkers", 0),
                new HireWorkers(),
            ]),
            new Idle(),
        ]),
    ]);
}

export function buildBlackboard(
    sectorName: string,
    money: number,
    capitalStock: Record<string, number>,
    sectorProfits: number,
    sectorRevenue: number,
    sectorLaborCosts: number,
    sectorInputCosts: number,
    sectorUtilization: number,
    laborAssigned: number,
    freeWorkers: number,
    prices: Record<string, number>,
    salaries: Record<string, number>,
    workerMarketRatios: Record<string, number>,
    capitalGoods?: Record<string, number>,
    workerRequirement?: Record<string, number>,
    goodsProduction?: Record<string, number>,
    outputLevel: number = 0,
    inputLevel: number = 0,
    investmentPriority: number = 0.5,
    investRemaining: number = 0,
): SectorBlackboard {
    return {
        sectorName,
        money,
        capitalStock,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        sectorUtilization,
        laborAssigned,
        freeWorkers,
        prices,
        salaries,
        workerMarketRatios,
        capitalGoods,
        workerRequirement,
        goodsProduction,
        outputLevel,
        inputLevel,
        investmentPriority,
        investRemaining,
        decisions: { ...defaultDecisions },
    };
}
