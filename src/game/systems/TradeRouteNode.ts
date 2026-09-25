import { TradeRouteComponent } from "@game/components/tradeRouteComponent";
import { EntityNode } from "@engine/entities/entityNode";
import { Entity } from "@/engine/entities/entity";

export class TradeRouteNode extends EntityNode {
    constructor(public tradeRoute: TradeRouteComponent, entity: Entity) {
        super(entity);
    }
}
