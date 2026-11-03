import type { TradeBlackboard } from "./autoTradeBT";
import { Action } from "../sectorBehaviorTree/bt";
import { CreateTradeRouteCommand } from "@game/commands/createTradeRouteCommand";
import { CreateMigrationRouteCommand } from "@game/commands/createMigrationRouteCommand";

const MAX_ROUTE_SPEED = 20;

export class CreateTradeRouteAction extends Action {
    constructor(
        private sourceId: string,
        private destId: string,
        private goods: Record<string, number>,
    ) { super(); }

    execute(bb: TradeBlackboard): "SUCCESS" | "FAILURE" {
        if(!bb.engine) return "FAILURE";
        bb.engine.addCommand(
            new CreateTradeRouteCommand(this.sourceId, this.destId, this.goods, MAX_ROUTE_SPEED)
        );
        return "SUCCESS";
    }
}

export class CreateMigrationRouteAction extends Action {
    constructor(
        private sourceId: string,
        private destId: string,
        private workerCount: number,
    ) { super(); }

    execute(bb: TradeBlackboard): "SUCCESS" | "FAILURE" {
        if(!bb.engine) return "FAILURE";
        bb.engine.addCommand(
            new CreateMigrationRouteCommand(this.sourceId, this.destId, this.workerCount, MAX_ROUTE_SPEED)
        );
        return "SUCCESS";
    }
}
