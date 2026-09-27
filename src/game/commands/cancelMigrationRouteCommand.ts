import { CommandBase } from "@/engine/lib/CommandBase";

export class CancelMigrationRouteCommand extends CommandBase {
    constructor(
        public routeEntityId: string
    ) {
        super();
    }
}
