import type { TradeBlackboard } from "./autoTradeBT";
import { Condition } from "../sectorBehaviorTree/bt";

const MAX_AUTO_ROUTES_PER_SETTLEMENT = 10;
const MAX_DISTANCE = 400;

export class SourceHasRouteCapacity extends Condition {
    constructor(private sourceId: string) { super(); }
    check(bb: TradeBlackboard): boolean {
        const s = bb.settlements.find(x => x.entityId === this.sourceId);
        return !!s && s.routeCount < MAX_AUTO_ROUTES_PER_SETTLEMENT;
    }
}

export class DestHasRouteCapacity extends Condition {
    constructor(private destId: string) { super(); }
    check(bb: TradeBlackboard): boolean {
        const s = bb.settlements.find(x => x.entityId === this.destId);
        return !!s && s.routeCount < MAX_AUTO_ROUTES_PER_SETTLEMENT;
    }
}

export class RouteDoesNotExist extends Condition {
    constructor(private sourceId: string, private destId: string) { super(); }
    check(bb: TradeBlackboard): boolean {
        return !bb.activeRoutes.has(`${this.sourceId}->${this.destId}`);
    }
}

export class ValidTradeDistance extends Condition {
    constructor(private sourceId: string, private destId: string) { super(); }
    check(bb: TradeBlackboard): boolean {
        const src = bb.settlements.find(x => x.entityId === this.sourceId);
        const dst = bb.settlements.find(x => x.entityId === this.destId);
        if(!src || !dst) return false;
        const distance = Math.hypot(dst.position.x - src.position.x, dst.position.y - src.position.y);
        return distance <= MAX_DISTANCE;
    }
}

export class MigrationDestFree extends Condition {
    constructor(private destId: string) { super(); }
    check(bb: TradeBlackboard): boolean {
        return !bb.incomingMigrationDestinations.has(this.destId);
    }
}

export class SourceIsSurplus extends Condition {
    constructor(private sourceId: string, private avgPop: number) { super(); }
    check(bb: TradeBlackboard): boolean {
        const s = bb.settlements.find(x => x.entityId === this.sourceId);
        // This is simplified; actual surplus check done at system level
        return !!s;
    }
}

export class DestIsDeficit extends Condition {
    constructor(private destId: string, private avgPop: number) { super(); }
    check(bb: TradeBlackboard): boolean {
        const s = bb.settlements.find(x => x.entityId === this.destId);
        return !!s;
    }
}

export class DestWageHigher extends Condition {
    constructor(private sourceId: string, private destId: string) { super(); }
    check(_bb: TradeBlackboard): boolean {
        return true;
    }
}