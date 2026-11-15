import { describe, expect, it } from "vitest";
import { allocatePopulationSales, TransactionLedger } from "../workers/transactionLedger";
import { Goods } from "../data/Goods.ts";

describe("TransactionLedger", () => {
    it("records and retrieves transactions", () => {
        const ledger = new TransactionLedger();
        ledger.record({
            tick: 1,
            type: "wage_payment",
            buyerId: "sectorA",
            sellerId: "popWorker",
            quantity: 100,
            unitPrice: 1,
            amount: 100,
        });
        const txs = ledger.getTransactions(1);
        expect(txs.length).toBe(1);
        expect(txs[0].type).toBe("wage_payment");
        expect(txs[0].amount).toBe(100);
    });

    it("verifyConservation passes with balanced internal transfers", () => {
        const ledger = new TransactionLedger();
        // Buyer pays 100, seller receives 100 → net internal = 0
        ledger.record({ tick: 1, type: "goods_purchase", buyerId: "A", sellerId: "B", quantity: 10, unitPrice: 10, amount: -100 });
        ledger.record({ tick: 1, type: "goods_purchase", buyerId: "A", sellerId: "B", quantity: 10, unitPrice: 10, amount: 100 });
        const result = ledger.verifyConservation();
        expect(result.valid).toBe(true);
        expect(result.error).toBeLessThan(1e-6);
    });

    it("verifyConservation detects unbalanced transfers", () => {
        const ledger = new TransactionLedger();
        ledger.record({ tick: 1, type: "goods_purchase", buyerId: "A", sellerId: "B", quantity: 10, unitPrice: 10, amount: -100 });
        // No matching seller entry → net internal = -100
        const result = ledger.verifyConservation();
        expect(result.valid).toBe(false);
        expect(result.error).toBe(100);
    });

    it("tracks external injections and destructions", () => {
        const ledger = new TransactionLedger();
        ledger.record({ tick: 1, type: "external_injection", amount: 5000 });
        ledger.record({ tick: 1, type: "external_destruction", amount: 1000 });
        const result = ledger.verifyConservation();
        expect(result.totalInjections).toBe(5000);
        expect(result.totalDestructions).toBe(1000);
    });
});

describe("allocatePopulationSales", () => {
    const sectorBids = [
        { name: "sectorA" },
        { name: "sectorB" },
    ];

    const sectorResults = {
        sectorA: { producedGoods: { food: 100, water: 50 } },
        sectorB: { producedGoods: { food: 100, water: 50 } },
    };

    const prices: Record<keyof Goods, number> = {
        food: 10,
        consumerGoods: 100,
        water: 5,
        energy: 20,
        services: 15,
        agriculturalGoods: 20,
        tylium: 150,
        metals: 150,
        fissionMaterial: 100,
        machinery: 50,
        medicine: 20,
        lumber: 30,
        oil: 100,
        spaceShips: 2000,
        nuclearWeapons: 300,
        vehicles: 80,
        environmentFactor: 50,
        faith: 40,
        lawEnforcement: 40,
        healthcare: 70,
        chemicals: 40,
        buildings: 20,
        waste: 2,
        governance: 40,
        paper: 30,
        logistics: 60,
        entertainment: 30,
        education: 80,
        mobility: 200,
        defense: 100,
        monetaryServices: 200,
        militaryEquipment: 800,
        tourism: 300,
    };

    const populationConsumption: Partial<Goods> = {
        food: 150,  // demand for 150 food, total production is 200
        water: 200, // demand for 200 water, total production is 100 (shortage)
    };

    it("allocates revenue proportionally to production", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            populationConsumption,
            prices,
        });

        // Total food production = 200, demand = 150 → coverage = 0.75
        // Each sector: 75 food * 10 = 750 food revenue
        // Total water production = 100, demand = 200 → coverage = 1.0
        // Each sector: 50 water * 5 = 250 water revenue
        // Total per sector: 750 + 250 = 1000
        expect(result.sectorRevenue["sectorA"]).toBeCloseTo(1000, 0);
        expect(result.sectorRevenue["sectorB"]).toBeCloseTo(1000, 0);
    });

    it("tracks unsold goods", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            populationConsumption,
            prices,
        });

        // Food: each sector produces 100, sells 75 → 25 unsold
        expect(result.unsoldQty["sectorA"]?.food).toBeCloseTo(25, 0);
        expect(result.unsoldQty["sectorB"]?.food).toBeCloseTo(25, 0);

        // Water: each sector produces 50, sells 50 → 0 unsold
        expect(result.unsoldQty["sectorA"]?.water).toBeCloseTo(0, 0);
        expect(result.unsoldQty["sectorB"]?.water).toBeCloseTo(0, 0);
    });

    it("tracks unmet demand", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            populationConsumption,
            prices,
        });

        // Water: demand = 200, production = 100 → 100 unmet
        expect(result.unmetDemandQty?.water).toBeCloseTo(100, 0);

        // Food: demand = 150, production = 200 → 0 unmet
        expect(result.unmetDemandQty?.food).toBeUndefined();
    });

    it("handles zero production", () => {
        const result = allocatePopulationSales({
            sectorBids: [{ name: "empty" }],
            sectorResults: { empty: { producedGoods: {} } },
            populationConsumption: { food: 100 },
            prices,
        });

        expect(result.sectorRevenue["empty"]).toBe(0);
        expect(result.unmetDemandQty?.food).toBe(100);
    });

    it("does not mutate inputs", () => {
        const consumptionBefore = { ...populationConsumption };
        const resultsBefore = JSON.parse(JSON.stringify(sectorResults));

        allocatePopulationSales({
            sectorBids,
            sectorResults,
            populationConsumption,
            prices,
        });

        expect(populationConsumption).toEqual(consumptionBefore);
        expect(sectorResults).toEqual(resultsBefore);
    });
});
