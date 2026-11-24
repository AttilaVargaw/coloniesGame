import { describe, expect, it } from "vitest";
import { allocateLabor } from "../workers/laborAllocation";
import { allocateGoods } from "../workers/goodsAllocation";
import { allocateBudget } from "../workers/budgetAllocation";
import { Population } from "../data/Population.ts";
import { Goods } from "../data/Goods.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

const SectorId = (id: string) => id as keyof IndustrialSectors;

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
    healthcare: 0,
    chemicals: 40,
    waste: 0,
    logistics: 0,
    paper: 70,
    entertainment: 0,
    education: 0,
    monetaryServices: 0,
    mobility: 0,
    militaryEquipment: 0,
};

describe("laborAllocation", () => {
    it("allocates full demand when supply is sufficient", () => {
        const reqs = [
            { sectorId: SectorId("powerPlant"), idealDemand: { worker: 50, engineer: 10 }, priority: 1 },
            { sectorId: SectorId("farm"), idealDemand: { worker: 50, farmer: 30 }, priority: 1 },
        ];

        const result = allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(result.allocation[SectorId("powerPlant")]?.worker).toBe(50);
        expect(result.allocation[SectorId("powerPlant")]?.engineer).toBe(10);
        expect(result.allocation[SectorId("farm")]?.worker).toBe(50);
        expect(result.allocation[SectorId("farm")]?.farmer).toBe(30);
        expect(result.unmetDemand[SectorId("powerPlant")]).toEqual({});
        expect(result.unmetDemand[SectorId("farm")]).toEqual({});
    });

    it("allocates proportionally when demand exceeds supply", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 1 },
            { sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 100 },
            sectorRequests: reqs,
        });

        // 100 workers split equally: 50 each
        expect(result.allocation[SectorId("sectorA")]?.worker).toBe(50);
        expect(result.allocation[SectorId("sectorB")]?.worker).toBe(50);
        expect(result.unmetDemand[SectorId("sectorA")]?.worker).toBe(50);
        expect(result.unmetDemand[SectorId("sectorB")]?.worker).toBe(50);
    });

    it("respects priority in proportional allocation", () => {
        const reqs = [
            { sectorId: SectorId("high"), idealDemand: { worker: 100 }, priority: 2 },
            { sectorId: SectorId("low"), idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 100 },
            sectorRequests: reqs,
        });

        // High priority gets 2/3, low gets 1/3
        const highWorkers = result.allocation[SectorId("high")]?.worker ?? 0;
        const lowWorkers = result.allocation[SectorId("low")]?.worker ?? 0;
        expect(highWorkers).toBeGreaterThan(lowWorkers);
        expect(highWorkers + lowWorkers).toBe(100);
    });

    it("returns zero allocation for zero demand", () => {
        const reqs = [
            { sectorId: SectorId("empty"), idealDemand: {}, priority: 1 },
        ];

        const result = allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(result.allocation[SectorId("empty")]).toEqual({});
        expect(result.unmetDemand[SectorId("empty")]).toEqual({});
    });

    it("does not mutate input", () => {
        const workersBefore = { ...availableWorkers };
        const reqs = [
            { sectorId: SectorId("farm"), idealDemand: { worker: 50 }, priority: 1 },
        ];

        allocateLabor({ availableWorkers, sectorRequests: reqs });

        expect(availableWorkers).toEqual(workersBefore);
    });

    it("excludes stayAtHome population from labor allocation", () => {
        // stayAtHome workers are excluded from the available pool (set to 0)
        const workersWithoutStayAtHome = {
            ...availableWorkers,
            stayAtHome: 0,
        };
        const reqs = [
            { sectorId: SectorId("farm"), idealDemand: { stayAtHome: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: workersWithoutStayAtHome,
            sectorRequests: reqs,
        });

        expect(result.allocation[SectorId("farm")]?.stayAtHome ?? 0).toBe(0);
        expect(result.unmetDemand[SectorId("farm")]?.stayAtHome).toBe(100);
    });

    it("redistributes excess when high-priority sector reaches demand cap", () => {
        const reqs = [
            { sectorId: SectorId("high"), idealDemand: { worker: 2 }, priority: 100 },
            { sectorId: SectorId("low"), idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 10 },
            sectorRequests: reqs,
        });

        // High priority gets its full demand of 2, low gets remaining 8
        expect(result.allocation[SectorId("high")]?.worker).toBe(2);
        expect(result.allocation[SectorId("low")]?.worker).toBe(8);
    });

    it("preserves fractional allocations for fractional stock", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 1 },
            { sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 99.5 },
            sectorRequests: reqs,
        });

        const a = result.allocation[SectorId("sectorA")]?.worker ?? 0;
        const b = result.allocation[SectorId("sectorB")]?.worker ?? 0;
        expect(a + b).toBeCloseTo(99.5, 8);
    });

    it("results are identical when request order is reversed", () => {
        const reqsForward = [
            { sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 2 },
            { sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
        ];
        const reqsReverse = [
            { sectorId: SectorId("sectorB"), idealDemand: { worker: 100 }, priority: 1 },
            { sectorId: SectorId("sectorA"), idealDemand: { worker: 100 }, priority: 2 },
        ];

        const forward = allocateLabor({ availableWorkers: { ...availableWorkers, worker: 100 }, sectorRequests: reqsForward });
        const reverse = allocateLabor({ availableWorkers: { ...availableWorkers, worker: 100 }, sectorRequests: reqsReverse });

        expect(forward.allocation[SectorId("sectorA")]?.worker ?? 0).toBeCloseTo(reverse.allocation[SectorId("sectorA")]?.worker ?? 0, 8);
        expect(forward.allocation[SectorId("sectorB")]?.worker ?? 0).toBeCloseTo(reverse.allocation[SectorId("sectorB")]?.worker ?? 0, 8);
    });

    it("never allocates more than available workers or ideal demand", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { worker: 1000 }, priority: 10 },
            { sectorId: SectorId("sectorB"), idealDemand: { worker: 1000 }, priority: 1 },
        ];

        const result = allocateLabor({
            availableWorkers: { ...availableWorkers, worker: 150 },
            sectorRequests: reqs,
        });

        const totalAllocated =
            (result.allocation[SectorId("sectorA")]?.worker ?? 0) +
            (result.allocation[SectorId("sectorB")]?.worker ?? 0);

        expect(totalAllocated).toBeLessThanOrEqual(150);
        expect(result.allocation[SectorId("sectorA")]?.worker).toBeLessThanOrEqual(1000);
        expect(result.allocation[SectorId("sectorB")]?.worker).toBeLessThanOrEqual(1000);
    });
});

describe("goodsAllocation", () => {
    it("allocates full demand when supply is sufficient", () => {
        const reqs = [
            { sectorId: SectorId("farm"), idealDemand: { water: 100, energy: 50 }, priority: 1 },
            { sectorId: SectorId("factory"), idealDemand: { metals: 50, oil: 30 }, priority: 1 },
        ];

        const result = allocateGoods({ availableGoods, sectorRequests: reqs });

        expect(result.allocation[SectorId("farm")]?.water).toBe(100);
        expect(result.allocation[SectorId("farm")]?.energy).toBe(50);
        expect(result.allocation[SectorId("factory")]?.metals).toBe(50);
        expect(result.allocation[SectorId("factory")]?.oil).toBe(30);
    });

    it("allocates proportionally when demand exceeds supply", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 1 },
            { sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 100 },
            sectorRequests: reqs,
        });

        expect(result.allocation[SectorId("sectorA")]?.food).toBe(50);
        expect(result.allocation[SectorId("sectorB")]?.food).toBe(50);
    });

    it("respects priority in proportional allocation", () => {
        const reqs = [
            { sectorId: SectorId("high"), idealDemand: { food: 100 }, priority: 3 },
            { sectorId: SectorId("low"), idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 100 },
            sectorRequests: reqs,
        });

        const highFood = result.allocation[SectorId("high")]?.food ?? 0;
        const lowFood = result.allocation[SectorId("low")]?.food ?? 0;
        expect(highFood).toBeGreaterThan(lowFood);
        expect(highFood + lowFood).toBe(100);
    });

    it("tracks unmet demand", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 200 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 50 },
            sectorRequests: reqs,
        });

        expect(result.allocation[SectorId("sectorA")]?.food).toBe(50);
        expect(result.unmetDemand[SectorId("sectorA")]?.food).toBe(150);
    });

    it("does not mutate input", () => {
        const goodsBefore = { ...availableGoods };
        const reqs = [
            { sectorId: SectorId("farm"), idealDemand: { water: 100 }, priority: 1 },
        ];

        allocateGoods({ availableGoods, sectorRequests: reqs });

        expect(availableGoods).toEqual(goodsBefore);
    });

    it("redistributes excess when high-priority sector reaches demand cap", () => {
        const reqs = [
            { sectorId: SectorId("high"), idealDemand: { food: 2 }, priority: 100 },
            { sectorId: SectorId("low"), idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 10 },
            sectorRequests: reqs,
        });

        // High priority gets its full demand of 2, low gets remaining 8
        expect(result.allocation[SectorId("high")]?.food).toBe(2);
        expect(result.allocation[SectorId("low")]?.food).toBe(8);
    });

    it("preserves fractional allocations for fractional stock", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 1 },
            { sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 99.5 },
            sectorRequests: reqs,
        });

        const a = result.allocation[SectorId("sectorA")]?.food ?? 0;
        const b = result.allocation[SectorId("sectorB")]?.food ?? 0;
        expect(a + b).toBeCloseTo(99.5, 8);
    });

    it("results are identical when request order is reversed", () => {
        const reqsForward = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 2 },
            { sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
        ];
        const reqsReverse = [
            { sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
            { sectorId: SectorId("sectorA"), idealDemand: { food: 100 }, priority: 2 },
        ];

        const forward = allocateGoods({ availableGoods: { ...availableGoods, food: 100 }, sectorRequests: reqsForward });
        const reverse = allocateGoods({ availableGoods: { ...availableGoods, food: 100 }, sectorRequests: reqsReverse });

        expect(forward.allocation[SectorId("sectorA")]?.food ?? 0).toBeCloseTo(reverse.allocation[SectorId("sectorA")]?.food ?? 0, 8);
        expect(forward.allocation[SectorId("sectorB")]?.food ?? 0).toBeCloseTo(reverse.allocation[SectorId("sectorB")]?.food ?? 0, 8);
    });

    it("never allocates more than available stock or ideal demand", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 1000 }, priority: 10 },
            { sectorId: SectorId("sectorB"), idealDemand: { food: 1000 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 150 },
            sectorRequests: reqs,
        });

        const totalAllocated =
            (result.allocation[SectorId("sectorA")]?.food ?? 0) +
            (result.allocation[SectorId("sectorB")]?.food ?? 0);

        expect(totalAllocated).toBeLessThanOrEqual(150);
        expect(result.allocation[SectorId("sectorA")]?.food).toBeLessThanOrEqual(1000);
        expect(result.allocation[SectorId("sectorB")]?.food).toBeLessThanOrEqual(1000);
    });

    it("zero stock: every requested good has a zero allocation entry", () => {
        const reqs = [
            { sectorId: SectorId("sectorA"), idealDemand: { food: 100, water: 50 }, priority: 1 },
            { sectorId: SectorId("sectorB"), idealDemand: { food: 100 }, priority: 1 },
        ];

        const result = allocateGoods({
            availableGoods: { ...availableGoods, food: 0, water: 0 },
            sectorRequests: reqs,
        });

        // Every demanded good must have an entry, even when zero stock
        expect(result.allocation[SectorId("sectorA")]?.food).toBe(0);
        expect(result.allocation[SectorId("sectorA")]?.water).toBe(0);
        expect(result.allocation[SectorId("sectorB")]?.food).toBe(0);

        // Full demand is unmet
        expect(result.unmetDemand[SectorId("sectorA")]?.food).toBe(100);
        expect(result.unmetDemand[SectorId("sectorA")]?.water).toBe(50);
        expect(result.unmetDemand[SectorId("sectorB")]?.food).toBe(100);
    });
});

describe("budgetAllocation", () => {
    it("computes budgetRatio correctly", () => {
        const reqs = [
            { sectorId: SectorId("rich"), sectorMoney: 1000, totalOperatingCostAtFullScale: 100 },
            { sectorId: SectorId("poor"), sectorMoney: 50, totalOperatingCostAtFullScale: 100 },
            { sectorId: SectorId("broke"), sectorMoney: 0, totalOperatingCostAtFullScale: 100 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation[SectorId("rich")]?.budgetRatio).toBe(1);
        expect(result.allocation[SectorId("rich")]?.availableBudget).toBe(1000);
        expect(result.allocation[SectorId("poor")]?.budgetRatio).toBe(0.5);
        expect(result.allocation[SectorId("broke")]?.budgetRatio).toBe(0);
    });

    it("excludes investment from available budget", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: 100, totalOperatingCostAtFullScale: 100 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation[SectorId("sector")]?.budgetRatio).toBe(1);
        expect(result.allocation[SectorId("sector")]?.availableBudget).toBe(100);
    });

    it("handles zero totalOperatingCostAtFullScale", () => {
        const reqs = [
            { sectorId: SectorId("free"), sectorMoney: 0, totalOperatingCostAtFullScale: 0 },
        ];

        const result = allocateBudget({ sectorRequests: reqs });

        expect(result.allocation[SectorId("free")]?.budgetRatio).toBe(1);
    });

    it("does not mutate input", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: 100, totalOperatingCostAtFullScale: 50 },
        ];
        const reqsCopy = JSON.parse(JSON.stringify(reqs));

        allocateBudget({ sectorRequests: reqs });

        expect(reqs).toEqual(reqsCopy);
    });

    it("rejects duplicate sector ID", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: 100, totalOperatingCostAtFullScale: 50 },
            { sectorId: SectorId("sector"), sectorMoney: 50, totalOperatingCostAtFullScale: 25 },
        ];

        expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
            "Duplicate budget request for sector",
        );
    });

    it("rejects negative sector money", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: -50, totalOperatingCostAtFullScale: 100 },
        ];

        expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
            "Invalid operating cash",
        );
    });

    it("rejects non-finite sector money", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: NaN, totalOperatingCostAtFullScale: 100 },
        ];

        expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
            "Invalid operating cash",
        );
    });

    it("rejects negative operating cost", () => {
        const reqs = [
            { sectorId: SectorId("sector"), sectorMoney: 100, totalOperatingCostAtFullScale: -25 },
        ];

        expect(() => allocateBudget({ sectorRequests: reqs })).toThrow(
            "Invalid operating cost",
        );
    });
});
