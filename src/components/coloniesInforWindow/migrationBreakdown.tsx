import { useGameEngine } from "@/hooks/useGameContext";
import { LabelComponent } from "@engine/components/label";
import { useGameEvent } from "@/hooks/useGameEvent";
import { DayPassedEvent } from "@/engine/lib/events";
import { MigrationRouteCreatedEvent, MigrationRouteCompletedEvent, MigrationRouteCancelledEvent } from "@game/events/migrationEvents";
import { useCallback, useEffect, useState } from "react";
import { convertToReadable } from "@/lib/utils";
import { CancelMigrationRouteCommand } from "@game/commands/cancelMigrationRouteCommand";
import { MigrationRouteNode } from "@/game/systems/MigrationRouteNode";
import { IndustryComponent } from "@/game/components/industryComponent";

type MigrationRouteInfo = {
    routeEntityId: string;
    sourceEntityId: string;
    destinationEntityId: string;
    workerCount: number;
    travelDaysRemaining: number;
    totalTravelDays: number;
    speed: number;
};

export function MigrationBreakdown({ industry: { entity } }: { industry: IndustryComponent }) {
    const engine = useGameEngine();
    const [routes, setRoutes] = useState<MigrationRouteInfo[]>([]);

    const collectRoutes = useCallback(() => {
        if(!engine || !entity) return;

        const allRoutes = engine.getNodeList(MigrationRouteNode).filter(({ migrationRoute: { sourceEntityId, destinationEntityId } }) =>
            sourceEntityId === entity.id || destinationEntityId === entity.id
        ).map(({ entity, migrationRoute }) => {
            return ({
                routeEntityId: entity.id,
                sourceEntityId: migrationRoute.sourceEntityId,
                destinationEntityId: migrationRoute.destinationEntityId,
                workerCount: migrationRoute.workerCount,
                travelDaysRemaining: migrationRoute.travelDaysRemaining,
                totalTravelDays: migrationRoute.totalTravelDays,
                speed: migrationRoute.speed,
            })
        })

        setRoutes(allRoutes);
    }, [engine, entity]);

    useEffect(() => {
        collectRoutes();
    }, [collectRoutes]);

    useGameEvent(MigrationRouteCreatedEvent, collectRoutes);
    useGameEvent(MigrationRouteCompletedEvent, collectRoutes);
    useGameEvent(MigrationRouteCancelledEvent, collectRoutes);
    useGameEvent(DayPassedEvent, collectRoutes);

    const getEntityName = useCallback((entityId: string) => {
        if(!engine) return entityId;
        const e = engine.getEntityById(entityId);
        return e?.getComponent(LabelComponent)?.text || entityId;
    }, [engine]);

    const handleCancel = useCallback((routeEntityId: string) => {
        if(!engine) return;
        engine.addCommand(new CancelMigrationRouteCommand(routeEntityId));
    }, [engine]);

    if(!entity || routes.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground">No active migration routes</div>;
    }

    return (
        <div className="space-y-4">
            {routes.map((route) => {
                const isSource = route.sourceEntityId === entity.id;
                const otherEntityId = isSource ? route.destinationEntityId : route.sourceEntityId;
                const otherName = getEntityName(otherEntityId);
                const direction = isSource ? "Emigration to" : "Immigration from";

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
                        <div className="flex items-center gap-2">
                            <span className="text-sm">{convertToReadable(route.workerCount)} workers</span>
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
