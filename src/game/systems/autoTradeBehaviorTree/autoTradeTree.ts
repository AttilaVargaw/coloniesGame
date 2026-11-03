import type { BTNode } from "../sectorBehaviorTree/bt";
import { Sequence } from "../sectorBehaviorTree/bt";
import type { TradeBlackboard } from "./autoTradeBT";
import {
    SourceHasRouteCapacity,
    DestHasRouteCapacity,
    RouteDoesNotExist,
    ValidTradeDistance,
} from "./autoTradeConditions";
import { CreateTradeRouteAction } from "./autoTradeActions";

export function createTradeRouteTree(
    sourceId: string,
    destId: string,
    goods: Record<string, number>,
    _bb: TradeBlackboard,
): BTNode<TradeBlackboard> {
    return new Sequence([
        new SourceHasRouteCapacity(sourceId),
        new DestHasRouteCapacity(destId),
        new RouteDoesNotExist(sourceId, destId),
        new ValidTradeDistance(sourceId, destId),
        new CreateTradeRouteAction(sourceId, destId, goods),
    ]);
}

export function createMigrationRouteTree(
    sourceId: string,
    destId: string,
    _workerCount: number,
    _bb: TradeBlackboard,
): BTNode<TradeBlackboard> {
    return new Sequence([
        new SourceHasRouteCapacity(sourceId),
        new DestHasRouteCapacity(destId),
    ]);
}
