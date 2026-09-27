import { EntityComponent } from "@engine/entities/entityComponent";

export class MigrationRouteComponent extends EntityComponent {
    constructor(
        public sourceEntityId: string,
        public destinationEntityId: string,
        public workerCount: number,
        public travelDaysRemaining: number,
        public totalTravelDays: number,
        public speed: number
    ) {
        super();
    }
}
