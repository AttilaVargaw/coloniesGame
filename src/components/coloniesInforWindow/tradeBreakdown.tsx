import { useGameEngine } from "@/hooks/useGameContext";
import { LabelComponent } from "@engine/components/label";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent } from "@/engine/lib/events";
import { TradeRouteCreatedEvent, TradeRouteCompletedEvent, TradeRouteCancelledEvent } from "@game/events/tradeEvents";
import { useCallback, useEffect, useState } from "react";
import { Goods } from "@/game/data/Goods";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";
import { convertToReadable } from "@/lib/utils";
import { CancelTradeRouteCommand } from "@game/commands/cancelTradeRouteCommand";
import { TradeRouteNode } from "@/game/systems/TradeRouteNode";
import { IndustryComponent } from "@/game/components/industryComponent";

type TradeRouteInfo = {
    routeEntityId: string;
    sourceEntityId: string;
    destinationEntityId: string;
    goods: Partial<Goods>;
    travelDaysRemaining: number;
    totalTravelDays: number;
    speed: number;
};

export function TradeBreakdown({ industry: { entity } }: { industry: IndustryComponent }) {
    const engine = useGameEngine();
    const [routes, setRoutes] = useState<TradeRouteInfo[]>([]);

    const collectRoutes = useCallback(() => {
        if(!engine || !entity) return;

        const allRoutes = engine.getNodeList(TradeRouteNode).filter(({ tradeRoute: { sourceEntityId, destinationEntityId } }) =>
            sourceEntityId === entity.id || destinationEntityId === entity.id
        ).map(({ entity, tradeRoute }) => {
            return ({
                routeEntityId: entity.id,
                sourceEntityId: tradeRoute.sourceEntityId,
                destinationEntityId: tradeRoute.destinationEntityId,
                goods: tradeRoute.goods,
                travelDaysRemaining: tradeRoute.travelDaysRemaining,
                totalTravelDays: tradeRoute.totalTravelDays,
                speed: tradeRoute.speed,
            })
        })

        setRoutes(allRoutes);
    }, [engine, entity]);

    useEffect(() => {
        collectRoutes();
    }, [collectRoutes]);

    useGameEvent(TradeRouteCreatedEvent, collectRoutes);
    useGameEvent(TradeRouteCompletedEvent, collectRoutes);
    useGameEvent(TradeRouteCancelledEvent, collectRoutes);
    useGameEvent(DayPassedEvent, collectRoutes);

    const getEntityName = useCallback((entityId: string) => {
        if(!engine) return entityId;
        const e = engine.getEntityById(entityId);
        return e?.getComponent(LabelComponent)?.text || entityId;
    }, [engine]);

    const handleCancel = useCallback((routeEntityId: string) => {
        if(!engine) return;
        engine.addCommand(new CancelTradeRouteCommand(routeEntityId));
    }, [engine]);

    if(!entity || routes.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground">No active shipments</div>;
    }

    return (
        <div className="space-y-4">
            {routes.map((route) => {
                const isSource = route.sourceEntityId === entity.id;
                const otherEntityId = isSource ? route.destinationEntityId : route.sourceEntityId;
                const otherName = getEntityName(otherEntityId);
                const direction = isSource ? "Export to" : "Import from";

                return (
                    <div key={route.routeEntityId} className="border border-muted rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">
                                {direction} {otherName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {route.travelDaysRemaining}/{route.totalTravelDays} days remaining
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(Object.entries(route.goods) as [keyof Goods, number][]).map(([good, amount]) => {
                                if(!amount || amount <= 0) return null;
                                return (
                                    <Tooltip key={good}>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1 text-sm">
                                                <ResourceIcon name={good} />
                                                <span>{convertToReadable(amount)}</span>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <span>{RESOURCE_NAMES[good] || good}</span>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                        {isSource && (
                            <button
                                onClick={() => handleCancel(route.routeEntityId)}
                                className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 rounded border border-red-700/50"
                            >
                                Cancel Route
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
