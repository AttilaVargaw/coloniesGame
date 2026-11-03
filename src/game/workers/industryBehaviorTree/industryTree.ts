import type { BTNode } from "../../systems/sectorBehaviorTree/bt";
import { Sequence, Selector } from "../../systems/sectorBehaviorTree/bt";
import type { IndustryBlackboard } from "./industryBT";
import {
    ColonyMoneyLow,
    ColonyUnprofitable,
    ColonyFoodShortage,
    ColonyFoodSurplus,
    ColonyUnemploymentHigh,
    ColonyUnemploymentLow,
} from "./industryConditions";
import {
    EmergencyStopAll,
    ClearEmergencyStop,
    ShutdownUnprofitableSectors,
    PrioritizeFoodSectors,
    SetInvestmentTotal,
} from "./industryActions";

export function createIndustryTree(_bb: IndustryBlackboard): BTNode {
    return new Sequence([
        // 1. Emergency: if colony money is critically low, stop everything
        new Selector([
            new Sequence([
                new ColonyMoneyLow(5000),
                new EmergencyStopAll(),
            ]),
            new ClearEmergencyStop(),
        ]),

        // 2. If unprofitable, shutdown unprofitable sectors
        new Selector([
            new Sequence([
                new ColonyUnprofitable(),
                new ShutdownUnprofitableSectors(),
            ]),
        ]),

        // 3. Food crisis: prioritize food sectors
        new Selector([
            new Sequence([
                new ColonyFoodShortage(),
                new PrioritizeFoodSectors(),
                new SetInvestmentTotal(0.2),
            ]),
            new Selector([
                new Sequence([
                    new ColonyFoodSurplus(),
                    new SetInvestmentTotal(0.05),
                ]),
                new SetInvestmentTotal(0.1),
            ]),
        ]),

        // 4. Unemployment: adjust investment
        new Selector([
            new Sequence([
                new ColonyUnemploymentHigh(0.3),
                new SetInvestmentTotal(0.05), // less investment, more labor needed
            ]),
            new Sequence([
                new ColonyUnemploymentLow(0.1),
                new SetInvestmentTotal(0.15), // more investment to absorb labor
            ]),
        ]),
    ]);
}
