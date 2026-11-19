import { describe, it, expect } from "vitest";
import { getPrices, Goods, basePrices } from "@game/data/Goods";
import { createEmptyWarehouse } from "@game/factories/createStarterWarehouse";

describe("getPrices deprecated", () => {
    it("still works for backward compatibility", () => {
        const goods = { ...createEmptyWarehouse(), energy: 100, food: 200 } as Goods;
        const memory = {} as Partial<Record<keyof Goods, number>>;
        const prices = getPrices(goods, memory);
        expect(prices.energy).toBeGreaterThan(0);
        expect(prices.food).toBeGreaterThan(0);
    });

    it("returns prices for all goods", () => {
        const goods = createEmptyWarehouse() as Goods;
        const memory = {} as Partial<Record<keyof Goods, number>>;
        const prices = getPrices(goods, memory);
        
        for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
            expect(prices[key]).toBeDefined();
            expect(prices[key]).toBeGreaterThan(0);
        }
    });
});