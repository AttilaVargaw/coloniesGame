import { Entity } from "@engine/entities/entity";
import { EventBase } from "../events";
import { Goods } from "@game/data/Goods";

export interface MarketPricesUpdatedData {
    entity: Entity;
    tick: number;
    prices: Record<keyof Goods, number>;
}

export class MarketPricesUpdatedEvent extends EventBase<MarketPricesUpdatedData> { }