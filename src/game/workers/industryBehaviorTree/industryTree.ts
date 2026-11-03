import type { BTNode } from "../../systems/sectorBehaviorTree/bt";
import { Sequence, Selector } from "../../systems/sectorBehaviorTree/bt";
import type { IndustryBlackboard } from "./industryBT";
import {
    ColonyMoneyLow,
    ColonyFoodShortage,
    ColonyFoodSurplus,
    ColonyUnemploymentHigh,
    ColonyUnemploymentLow,
} from "./industryConditions";
import {
    ClearEmergencyStop,
    PrioritizeFoodSectors,
    SetInvestmentTotal,
    Idle,
} from "./industryActions";

export function createIndustryTree(_bb: IndustryBlackboard): BTNode {
    return new Sequence([
        // Always clear emergency stop so it's never permanent
        new ClearEmergencyStop(),

        // 1. Low money: reduce investment, don't stop production entirely
        new Selector([
            new Sequence([
                new ColonyMoneyLow(5000),
                new SetInvestmentTotal(0.02), // minimal investment when broke
            ]),
            new Idle(),
        ]),

        // 2. Food crisis: prioritize food sectors
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

        // 3. Unemployment: adjust investment
        new Selector([
            new Sequence([
                new ColonyUnemploymentHigh(0.3),
                new SetInvestmentTotal(0.05),
            ]),
            new Sequence([
                new ColonyUnemploymentLow(0.1),
                new SetInvestmentTotal(0.15),
            ]),
        ]),
    ]);
}
