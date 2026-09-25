import { CommandBase } from "@/engine/lib/CommandBase";

export class CancelTradeRouteCommand extends CommandBase {
    constructor(public routeEntityId: string) {
        super();
    }
}
