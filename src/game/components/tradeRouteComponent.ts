import { EntityComponent } from "@engine/entities/entityComponent";
import { Goods } from "../data/Goods";

export class TradeRouteComponent extends EntityComponent {
    constructor(
        public sourceEntityId: string,
        public destinationEntityId: string,
        public goods: Partial<Goods>,
        public travelDaysRemaining: number,
        public totalTravelDays: number,
        public speed: number
    ) {
        super();
    }
}
