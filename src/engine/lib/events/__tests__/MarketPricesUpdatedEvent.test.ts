import { describe, it, expect } from "vitest";
import { MarketPricesUpdatedEvent } from "../MarketPricesUpdatedEvent";
import { Entity } from "@engine/entities/entity";
import { Goods } from "@game/data/Goods";

describe("MarketPricesUpdatedEvent", () => {
    it("stores entity, tick, and prices", () => {
        const entity = new Entity("test-123");
        const prices: Record<keyof Goods, number> = { energy: 25, food: 30 } as Record<keyof Goods, number>;
        const event = new MarketPricesUpdatedEvent({ entity, tick: 5, prices });
        
        expect(event.data.entity).toBe(entity);
        expect(event.data.tick).toBe(5);
        expect(event.data.prices).toEqual(prices);
    });
});