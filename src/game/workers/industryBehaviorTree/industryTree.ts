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
    PrioritizeEssentialSectors,
    SetInvestmentTotal,
    Idle,
} from "./industryActions";

export function createIndustryTree(_bb: IndustryBlackboard): BTNode {
    return new Sequence([
        // Always clear emergency stop so it's never permanent
        new ClearEmergencyStop(),

        // 1. Low money: reduce investment, don't stop production entirely
        // This selector takes priority - if money is low, we set minimal investment and SKIP other prioritization
        new Selector([
            new Sequence([
                new ColonyMoneyLow(5000),
                new SetInvestmentTotal(0.02), // minimal investment when broke
            ]),
            // Money is OK - proceed to sector prioritization
            new Sequence([
                // 2. Food crisis: prioritize food sectors
                new Selector([
                    new Sequence([
                        new ColonyFoodShortage(),
                        new PrioritizeFoodSectors(),
                        new SetInvestmentTotal(0.2),
                    ]),
                    // 3. No food crisis: prioritize essential sectors
                    new Sequence([
                        new PrioritizeEssentialSectors(),
                        new SetInvestmentTotal(0.1),
                    ]),
                ]),

                // 4. Unemployment: adjust investment (fine-tuning on top of base)
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
            ]),
        ]),
    ]);
}
