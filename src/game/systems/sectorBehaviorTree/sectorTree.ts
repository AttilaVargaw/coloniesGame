import type { SectorBlackboard } from "./bt";
import { Sequence, Selector, BTNode } from "./bt";
import { defaultDecisions } from "./bt";
import {
    HasMoney,
    IsProfitable,
    IsUnprofitable,
    HasCapitalDeficit,
    HasLaborShortage,
    CanAffordCapital,
} from "./sectorConditions";
import {
    EmergencyStop,
    NormalOperations,
    ReduceProduction,
    BuyCapital,
    Idle,
    HireWorkers,
} from "./sectorActions";

export function createSectorTree(_blackboard: SectorBlackboard): BTNode {
    return new Sequence([
        // 1. Solvency check: if no money, emergency stop
        new Selector([
            new HasMoney(),
            new EmergencyStop(),
        ]),

        // 2. Profitability branch
        new Selector([
            new Sequence([
                new IsProfitable(),
                new NormalOperations(),
            ]),
            new Sequence([
                new IsUnprofitable(),
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
        decisions: { ...defaultDecisions },
    };
}
