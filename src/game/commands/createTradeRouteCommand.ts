import { CommandBase } from "@/engine/lib/CommandBase";
import { Goods } from "../data/Goods";

export class CreateTradeRouteCommand extends CommandBase {
    constructor(
        public sourceEntityId: string,
        public destinationEntityId: string,
        public goods: Partial<Goods>,
        public speed: number = 0.5
    ) {
        super();
    }
}
