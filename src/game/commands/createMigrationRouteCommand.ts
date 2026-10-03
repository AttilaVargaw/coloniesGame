import { CommandBase } from "@/engine/lib/CommandBase";

export class CreateMigrationRouteCommand extends CommandBase {
    constructor(
        public sourceEntityId: string,
        public destinationEntityId: string,
        public workerCount: number,
        public speed: number
    ) {
        super()
    }
}