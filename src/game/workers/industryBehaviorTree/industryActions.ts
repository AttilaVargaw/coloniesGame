import type { IndustryBlackboard } from "./industryBT";
import { Action } from "../../systems/sectorBehaviorTree/bt";

export class EmergencyStopAll extends Action<IndustryBlackboard> {
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        bb.emergencyStopAll = true;
        bb.shutdownSectors = new Set(Object.keys(bb.sectorProfits));
        return "SUCCESS";
    }
}

export class ClearEmergencyStop extends Action<IndustryBlackboard> {
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        bb.emergencyStopAll = false;
        bb.shutdownSectors.clear();
        return "SUCCESS";
    }
}

export class ShutdownUnprofitableSectors extends Action<IndustryBlackboard> {
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        for(const [sectorName, profit] of Object.entries(bb.sectorProfits)) {
            if(profit < 0) {
                bb.shutdownSectors.add(sectorName);
            }
        }
        return "SUCCESS";
    }
}

export class PrioritizeFoodSectors extends Action<IndustryBlackboard> {
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        const foodSectors = ["fishery", "farm", "greenhouse"]; // sectors that produce food
        for(const sectorName of Object.keys(bb.sectorProfits)) {
            if(foodSectors.includes(sectorName)) {
                bb.investmentPriority[sectorName] = Math.max(
                    bb.investmentPriority[sectorName] ?? 0,
                    0.9
                );
            } else {
                bb.investmentPriority[sectorName] = Math.min(
                    bb.investmentPriority[sectorName] ?? 0.5,
                    0.3
                );
            }
        }
        return "SUCCESS";
    }
}

export class PrioritizeEssentialSectors extends Action<IndustryBlackboard> {
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        const essentialSectors = [
            "powerPlant",
            "waterTreatment",
            "healthcare",
            "education",
            "lawEnforcement",
            "governance",
            "logistics",
            "government",
        ];
        for(const sectorName of Object.keys(bb.sectorProfits)) {
            if(essentialSectors.includes(sectorName)) {
                bb.investmentPriority[sectorName] = Math.max(
                    bb.investmentPriority[sectorName] ?? 0,
                    0.9
                );
            } else {
                bb.investmentPriority[sectorName] = Math.min(
                    bb.investmentPriority[sectorName] ?? 0.5,
                    0.3
                );
            }
        }
        return "SUCCESS";
    }
}

export class SetInvestmentTotal extends Action<IndustryBlackboard> {
    constructor(public fractionOfMoney: number = 0.1) { super(); }
    execute(bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        bb.investTotal = bb.totalMoney * this.fractionOfMoney;
        return "SUCCESS";
    }
}

export class Idle extends Action<IndustryBlackboard> {
    execute(_bb: IndustryBlackboard): "SUCCESS" | "FAILURE" {
        return "SUCCESS";
    }
}
