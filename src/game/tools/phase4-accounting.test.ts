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
        // Buyer pays 100, seller receives 100 → both accounts net to zero
        ledger.record({ tick: 1, type: "goods_purchase", buyerId: "A", sellerId: "B", quantity: 10, unitPrice: 10, amount: 100 });
        const result = ledger.verifyConservation(
            { A: 1000, B: 500 },
            { A: 900, B: 600 },
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeLessThan(1e-6);
    });

    it("verifyConservation detects unbalanced transfers", () => {
        const ledger = new TransactionLedger();
        // Buyer pays 100 but closing balances don't reflect it
        ledger.record({ tick: 1, type: "goods_purchase", buyerId: "A", sellerId: "B", quantity: 10, unitPrice: 10, amount: 100 });
        const result = ledger.verifyConservation(
            { A: 1000, B: 500 },
            { A: 1000, B: 500 }, // balances unchanged → mismatch
        );
        expect(result.valid).toBe(false);
        expect(result.error).toBeGreaterThan(0);
    });

    it("tracks external injections and destructions", () => {
        const ledger = new TransactionLedger();
        ledger.record({ tick: 1, type: "external_injection", amount: 5000 });
        ledger.record({ tick: 1, type: "external_destruction", amount: 1000 });
        const result = ledger.verifyConservation(
            { A: 1000 },
            { A: 1000 },
        );
        expect(result.valid).toBe(true);
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

    const demandByPop: Record<string, Partial<Goods>> = {
        worker: { food: 100, water: 100 },
        clerks: { food: 50, water: 100 },
    };

    const cashByPop: Record<string, number> = {
        worker: 10000,
        clerks: 10000,
    };

    it("allocates revenue proportionally to production", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            demandByPop,
            cashByPop,
            prices,
        });

        // Food: worker buys 100, clerks buys 50, total 150 sold
        //   sectorA share 50% → 75 food = 750 revenue
        //   sectorB share 50% → 75 food = 750 revenue
        // Water: worker buys 50, clerks buys 50, total 100 sold
        //   sectorA share 50% → 25 water = 125 revenue
        //   sectorB share 50% → 25 water = 125 revenue
        // sectorA total: 750 + 125 = 875... NO. Per-group allocation:
        //   worker food: sectorA gets (100/200)*100 = 50 food = 500 revenue
        //   clerks food: sectorA gets (100/200)*50 = 25 food = 250 revenue
        //   worker water: sectorA gets (50/100)*50 = 25 water = 125 revenue
        //   clerks water: sectorA gets (50/100)*50 = 25 water = 125 revenue
        //   sectorA total: 500 + 250 + 125 + 125 = 1000
        expect(result.sectorRevenue["sectorA"]).toBeCloseTo(1000, 0);
        expect(result.sectorRevenue["sectorB"]).toBeCloseTo(1000, 0);
    });

    it("tracks unsold goods", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            demandByPop,
            cashByPop,
            prices,
        });

        // Food: sectorA produces 100, sells 75 total → unsold 25
        expect(result.unsoldQty["sectorA"]?.food).toBeCloseTo(25, 0);
        expect(result.unsoldQty["sectorB"]?.food).toBeCloseTo(25, 0);

        // Water: sectorA produces 50, sells 50 total → unsold 0
        expect(result.unsoldQty["sectorA"]?.water).toBeCloseTo(0, 0);
        expect(result.unsoldQty["sectorB"]?.water).toBeCloseTo(0, 0);
    });

    it("tracks unmet demand by population group", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            demandByPop,
            cashByPop,
            prices,
        });

        // Water: demand = 200, production = 100 → coverage = 0.5
        // Worker unmet = 100 * 0.5 = 50, Clerk unmet = 100 * 0.5 = 50
        expect(result.unmetDemandByPop.worker?.water).toBeCloseTo(50, 0);
        expect(result.unmetDemandByPop.clerks?.water).toBeCloseTo(50, 0);

        // Food: demand = 150, production = 200 → all met
        expect(result.unmetDemandByPop.worker?.food).toBeUndefined();
        expect(result.unmetDemandByPop.clerks?.food).toBeUndefined();
    });

    it("limits purchases by available cash", () => {
        const result = allocatePopulationSales({
            sectorBids,
            sectorResults,
            demandByPop,
            cashByPop: { worker: 100, clerks: 10000 } as any,
            prices,
        });

        // Worker has only 100 cash. Food price = 10, water price = 5.
        // Worker demands 100 food + 100 water = 1000 + 500 = 1500 desired spending
        // Budget coverage = 100/1500 ≈ 0.0667
        // Worker food: 100 * 0.75 * 0.0667 ≈ 5, cost = 50
        // Worker water: 100 * 0.5 * 0.0667 ≈ 3.33, cost = 16.67
        // Actually the budget constraint is applied through cash deduction per good.
        // Let's just verify worker spending <= 100
        expect(result.spendingByPop.worker).toBeLessThanOrEqual(100);
        expect(result.spendingByPop.clerks).toBeGreaterThan(result.spendingByPop.worker);
    });

    it("handles zero production", () => {
        const result = allocatePopulationSales({
            sectorBids: [{ name: "empty" }],
            sectorResults: { empty: { producedGoods: {} } },
            demandByPop,
            cashByPop,
            prices,
        });

        expect(result.sectorRevenue["empty"]).toBe(0);
        // All demand unmet since no production and no stock
        expect(result.unmetDemandByPop.worker?.food).toBeCloseTo(100, 0);
        expect(result.unmetDemandByPop.worker?.water).toBeCloseTo(100, 0);
    });

    it("does not mutate inputs", () => {
        const demandBefore = { ...demandByPop };
        const cashBefore = { ...cashByPop };
        const resultsBefore = JSON.parse(JSON.stringify(sectorResults));

        allocatePopulationSales({
            sectorBids,
            sectorResults,
            demandByPop,
            cashByPop,
            prices,
        });

        expect(demandByPop).toEqual(demandBefore);
        expect(cashByPop).toEqual(cashBefore);
        expect(sectorResults).toEqual(resultsBefore);
    });
});
