import type { IndustryBlackboard } from "./industryBT";
import { Condition } from "../../systems/sectorBehaviorTree/bt";

export class ColonyMoneyLow extends Condition<IndustryBlackboard> {
    constructor(public threshold: number = 10000) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return bb.totalMoney < this.threshold;
    }
}

export class ColonyMoneyHigh extends Condition<IndustryBlackboard> {
    constructor(public threshold: number = 1000000) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return bb.totalMoney > this.threshold;
    }
}

export class ColonyUnprofitable extends Condition<IndustryBlackboard> {
    check(bb: IndustryBlackboard): boolean {
        return bb.totalSectorProfits < 0;
    }
}

export class ColonyProfitable extends Condition<IndustryBlackboard> {
    check(bb: IndustryBlackboard): boolean {
        return bb.totalSectorProfits > 0;
    }
}

export class ColonyFoodShortage extends Condition<IndustryBlackboard> {
    check(bb: IndustryBlackboard): boolean {
        const stock = bb.colonyGoods["food"] ?? 0;
        const req = bb.colonyGoodsRequirements["food"] ?? 0;
        return stock < req * 0.5;
    }
}

export class ColonyFoodSurplus extends Condition<IndustryBlackboard> {
    check(bb: IndustryBlackboard): boolean {
        const stock = bb.colonyGoods["food"] ?? 0;
        const req = bb.colonyGoodsRequirements["food"] ?? 0;
        return stock > req * 1.5;
    }
}

export class ColonyUnemploymentHigh extends Condition<IndustryBlackboard> {
    constructor(public threshold: number = 0.2) { super(); }
    check(bb: IndustryBlackboard): boolean {
        if(bb.totalPopulation <= 0) return false;
        return bb.totalFreeWorkers / bb.totalPopulation > this.threshold;
    }
}

export class ColonyUnemploymentLow extends Condition<IndustryBlackboard> {
    constructor(public threshold: number = 0.05) { super(); }
    check(bb: IndustryBlackboard): boolean {
        if(bb.totalPopulation <= 0) return false;
        return bb.totalFreeWorkers / bb.totalPopulation < this.threshold;
    }
}

export class SectorUnprofitable extends Condition<IndustryBlackboard> {
    constructor(public sectorName: string) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return (bb.sectorProfits[this.sectorName] ?? 0) < 0;
    }
}

export class SectorProfitable extends Condition<IndustryBlackboard> {
    constructor(public sectorName: string) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return (bb.sectorProfits[this.sectorName] ?? 0) > 0;
    }
}

export class SectorUtilizationLow extends Condition<IndustryBlackboard> {
    constructor(public sectorName: string, public threshold: number = 0.3) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return (bb.sectorUtilization[this.sectorName] ?? 0) < this.threshold;
    }
}

export class WageTooHigh extends Condition<IndustryBlackboard> {
    constructor(public popType: string, public threshold: number) { super(); }
    check(bb: IndustryBlackboard): boolean {
        return (bb.wages[this.popType] ?? 0) > this.threshold;
    }
}
