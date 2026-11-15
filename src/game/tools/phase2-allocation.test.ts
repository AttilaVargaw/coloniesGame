import { describe, expect, it } from "vitest";
import { allocateLabor } from "../workers/laborAllocation";
import { allocateGoods } from "../workers/goodsAllocation";
import { allocateBudget } from "../workers/budgetAllocation";
import { Population } from "../data/Population.ts";
import { Goods } from "../data/Goods.ts";

const availableWorkers: Record<keyof Population, number> = {
    farmer: 100,
    scientist: 50,
    worker: 200,
    student: 30,
    healtcarePersonal: 20,
    policeMen: 15,
    teacher: 10,
    serviceWorker: 25,
    clergy: 5,
    retired: 40,
    clerks: 15,
    engineer: 10,
    stayAtHome: 100,
    serviceMan: 10,
};

const availableGoods: Record<keyof Goods, number> = {
    food: 1000,
    water: 500,
    energy: 300,
    machinery: 200,
    buildings: 100,
    oil: 400,
    metals: 150,
    tylium: 80,
    consumerGoods: 300,
    agriculturalGoods: 200,
    tourism: 0,
    services: 0,
    fissionMaterial: 50,
    medicine: 60,
    lumber: 90,
    spaceShips: 10,
    nuclearWeapons: 0,
    vehicles: 30,
    environmentFactor: 0,
    faith: 0,
    lawEnforcement: 0,
    healthcare: 0,
    chemicals: 40,
    waste: 0,
    governance: 0,
    logistics: 0,
    paper: 70,
    entertainment: 0,
    education: 0,
    defense: 0,
    monetaryServices: 0,
    mobility: 0,
    militaryEquipment: 0,
};

describe("laborAllocation", () => {
    it("allocates full demand when supply is sufficient", () => {
        const requests = [
            { sectorId: "farm" as const, idealDemand: { worker: 50 }, priority: 1 },
            { sectorId: "farm" as const, idealDemand: { worker: 50 }, priority: 1 },
        ];
        // Actually use two different sectors
        const reqs = [
            { sectorId: "powerPlant" as const, idealDemand: { worker: 50, engineer: 10 }, priority: 1 },
            { sectorId: "farm" as const, idealDemand: { worker: 50, farmer: 30 }, priority: 1 },
        ];

        const result = allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(result.allocation["powerPlant"]?.worker).toBe(50);
        expect(result.allocation["powerPlant"]?.engineer).toBe(10);
        expect(result.allocation["farm"]?.worker).toBe(50);
        expect(result.allocation["farm"]?.farmer).toBe(30);
        expect(result.unmetDemand["powerPlant"]).toEqual({});
        expect(result.unmetDemand["farm"]).toEqual({});
    });

    it("allocates proportionally when demand exceeds supply", () => {
        const reqs = [
            { sectorId: "sectorA" as const, idealDemand: { worker: 100 }, priority: 1 },
            { sectorId: "sectorB" as const, idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 100 },
            sectorRequests: reqs,
        });

        // 100 workers split equally: 50 each
        expect(result.allocation["sectorA"]?.worker).toBe(50);
        expect(result.allocation["sectorB"]?.worker).toBe(50);
        expect(result.unmetDemand["sectorA"]?.worker).toBe(50);
        expect(result.unmetDemand["sectorB"]?.worker).toBe(50);
    });

    it("respects priority in proportional allocation", () => {
        const reqs = [
            { sectorId: "high" as const, idealDemand: { worker: 100 }, priority: 2 },
            { sectorId: "low" as const, idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 100 },
            sectorRequests: reqs,
        });

        // High priority gets 2/3, low gets 1/3
        expect(result.allocation["high"]?.worker).toBeGreaterThan(result.allocation["low"]?.worker ?? 0);
        expect(result.allocation["high"]?.worker + result.allocation["low"]?.worker).toBe(100);
    });

    it("returns zero allocation for zero demand", () => {
        const reqs = [
            { sectorId: "empty" as const, idealDemand: {}, priority: 1 },
        ];

        const result = allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(result.allocation["empty"]).toEqual({});
        expect(result.unmetDemand["empty"]).toEqual({});
    });

    it("does not mutate input", () => {
        const workersBefore = { ...availableWorkers };
        const reqs = [
            { sectorId: "farm" as const, idealDemand: { worker: 50 }, priority: 1 },
        ];

        allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(availableWorkers).toEqual(workersBefore);
    });
});

describe("goodsAllocation", () => {
    it("allocates full demand when supply is sufficient", () => {
        const reqs = [
            { sectorId: "farm" as const, idealDemand: { water: 100, energy: 50 }, priority: 1 },
            { sectorId: "factory" as const, idealDemand: { metals: 50, oil: 30 }, priority: 1 },
        ];

        const result = allocateGoods({ availableGoods, sectorRequests: reqs });

        expect(result.allocation["farm"]?.water).toBe(100);
        expect(result.allocation["farm"]?.energy).toBe(50);
        expect(result.allocation["factory"]?.metals).toBe(50);
        expect(result.allocation["factory"]?.oil).toBe(30);
    });

    it("allocates proportionally when demand exceeds supply", () => {
        const reqs = [
            { sectorId: "sectorA" as const, idealDemand: { food: 100 }, priority: 1 },
            { sectorId: "sectorB" as const, idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 100 },
            sectorRequests: reqs,
        });

        expect(result.allocation["sectorA"]?.food).toBe(50);
        expect(result.allocation["sectorB"]?.food).toBe(50);
    });

    it("respects priority in proportional allocation", () => {
        const reqs = [
            { sectorId: "high" as const, idealDemand: { food: 100 }, priority: 3 },
            { sectorId: "low" as const, idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 100 },
            sectorRequests: reqs,
        });

        expect(result.allocation["high"]?.food).toBeGreaterThan(result.allocation["low"]?.food ?? 0);
        expect(result.allocation["high"]?.food + result.allocation["low"]?.food).toBe(100);
    });

    it("tracks unmet demand", () => {
        const reqs = [
            { sectorId: "sectorA" as const, idealDemand: { food: 200 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 50 },
            sectorRequests: reqs,
        });

        expect(result.allocation["sectorA"]?.food).toBe(50);
        expect(result.unmetDemand["sectorA"]?.food).toBe(150);
    });

    it("does not mutate input", () => {
        const goodsBefore = { ...availableGoods };
        const reqs = [
            { sectorId: "farm" as const, idealDemand: { water: 100 }, priority: 1 },
        ];

        allocateGoods({ availableGoods, sectorRequests: reqs });

        expect(availableGoods).toEqual(goodsBefore);
    });
});

describe("budgetAllocation", () => {
    it("computes budgetRatio correctly", () => {
        const reqs = [
            { sectorId: "rich" as const, sectorMoney: 1000, sectorInvestment: 0, costPerUnit: 100 },
            { sectorId: "poor" as const, sectorMoney: 50, sectorInvestment: 0, costPerUnit: 100 },
            { sectorId: "broke" as const, sectorMoney: 0, sectorInvestment: 0, costPerUnit: 100 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation["rich"]?.budgetRatio).toBe(1);
        expect(result.allocation["rich"]?.availableBudget).toBe(1000);
        expect(result.allocation["poor"]?.budgetRatio).toBe(0.5);
        expect(result.allocation["broke"]?.budgetRatio).toBe(0);
    });

    it("includes investment in available budget", () => {
        const reqs = [
            { sectorId: "sector" as const, sectorMoney: 100, sectorInvestment: 400, costPerUnit: 100 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation["sector"]?.budgetRatio).toBe(1);
        expect(result.allocation["sector"]?.availableBudget).toBe(500);
    });

    it("handles zero costPerUnit", () => {
        const reqs = [
            { sectorId: "free" as const, sectorMoney: 0, sectorInvestment: 0, costPerUnit: 0 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation["free"]?.budgetRatio).toBe(1);
    });

    it("does not mutate input", () => {
        const reqs = [
            { sectorId: "sector" as const, sectorMoney: 100, sectorInvestment: 0, costPerUnit: 50 },
        ];
        const reqsCopy = JSON.parse(JSON.stringify(reqs));

        allocateBudget({ sectorRequests: reqs });

        expect(reqs).toEqual(reqsCopy);
    });
});
