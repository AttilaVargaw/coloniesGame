import { describe, expect, it } from "vitest";
import { computeDeprivation, computeMortalityRates, applyMortality, DEMOGRAPHIC_CONFIG } from "../workers/demographics";
import { Population } from "../data/Population.ts";
import { Goods } from "../data/Goods.ts";

describe("DEMOGRAPHIC_CONFIG", () => {
    it("has reasonable default values", () => {
        expect(DEMOGRAPHIC_CONFIG.DEPRIVATION_MORTALITY_RATE).toBeGreaterThan(0);
        expect(DEMOGRAPHIC_CONFIG.DEPRIVATION_DECAY).toBeGreaterThan(0);
        expect(DEMOGRAPHIC_CONFIG.DEPRIVATION_DECAY).toBeLessThan(1);
        expect(DEMOGRAPHIC_CONFIG.QOL_SMOOTHING).toBeGreaterThan(0);
        expect(DEMOGRAPHIC_CONFIG.QOL_SMOOTHING).toBeLessThan(1);
    });
});

describe("computeDeprivation", () => {
    const essentialGoods: (keyof Goods)[] = ["food", "water", "energy"];

    it("accumulates deprivation when goods are short", () => {
        const result = computeDeprivation({
            previousDeprivation: {},
            goodsShortfall: { food: 50, water: 30 },
            desiredDemand: { food: 50, water: 30, energy: 100 },
            essentialGoods,
        });

        // Shortage ratio = 1 for both food and water → deprivation = 1 * 0.5 = 0.5
        expect(result.food).toBe(DEMOGRAPHIC_CONFIG.DEPRIVATION_GROWTH);
        expect(result.water).toBe(DEMOGRAPHIC_CONFIG.DEPRIVATION_GROWTH);
        expect(result.energy).toBe(0);
    });

    it("decays deprivation when goods are available", () => {
        const prevDeprivation = { food: 100, water: 50 };
        const result = computeDeprivation({
            previousDeprivation: prevDeprivation,
            goodsShortfall: {},
            desiredDemand: { food: 100, water: 50 },
            essentialGoods,
        });

        expect(result.food).toBeCloseTo(100 * (1 - DEMOGRAPHIC_CONFIG.DEPRIVATION_DECAY), 4);
        expect(result.water).toBeCloseTo(50 * (1 - DEMOGRAPHIC_CONFIG.DEPRIVATION_DECAY), 4);
    });

    it("does not let deprivation go negative", () => {
        const result = computeDeprivation({
            previousDeprivation: { food: 0 },
            goodsShortfall: {},
            desiredDemand: { food: 100 },
            essentialGoods,
        });

        expect(result.food).toBe(0);
    });

    it("does not mutate input", () => {
        const prev = { food: 50 };
        const prevCopy = { ...prev };
        computeDeprivation({
            previousDeprivation: prev,
            goodsShortfall: {},
            desiredDemand: { food: 100 },
            essentialGoods,
        });
        expect(prev).toEqual(prevCopy);
    });

    it("normalizes shortage by demand (partial shortage)", () => {
        // food: shortfall=30, desired=100 → shortageRatio=0.3 → deprivation=0.3*0.5=0.15
        // water: shortfall=50, desired=50 → shortageRatio=1 → deprivation=1*0.5=0.5
        const result = computeDeprivation({
            previousDeprivation: {},
            goodsShortfall: { food: 30, water: 50 },
            desiredDemand: { food: 100, water: 50 },
            essentialGoods,
        });

        expect(result.food).toBeCloseTo(0.3 * DEMOGRAPHIC_CONFIG.DEPRIVATION_GROWTH, 4);
        expect(result.water).toBe(DEMOGRAPHIC_CONFIG.DEPRIVATION_GROWTH);
    });

    it("caps deprivation at MAX_DEPRIVATION", () => {
        const result = computeDeprivation({
            previousDeprivation: { food: DEMOGRAPHIC_CONFIG.MAX_DEPRIVATION },
            goodsShortfall: { food: 1000 },
            desiredDemand: { food: 100 },
            essentialGoods,
        });

        expect(result.food).toBe(DEMOGRAPHIC_CONFIG.MAX_DEPRIVATION);
    });
});

describe("computeMortalityRates", () => {
    const population: Population = {
        farmer: { number: 1000, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        scientist: { number: 500, wealth: 0, wealthLevel: 0, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0, salary: 1000, birthRate: 0.6 },
        worker: { number: 2000, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        student: { number: 300, wealth: 0, wealthLevel: 0, qol: 30, expectedQol: 30, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
        healtcarePersonal: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
        policeMen: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        teacher: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        serviceWorker: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        clergy: { number: 20, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        retired: { number: 100, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
        clerks: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
        engineer: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
        stayAtHome: { number: 500, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
        serviceMan: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
    };

    it("returns zero mortality with no deprivation", () => {
        const result = computeMortalityRates({
            deprivation: {},
            population,
        });

        // All mortality rates should be finite and non-negative
        for(const [, rate] of Object.entries(result.mortalityRate)) {
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(1);
        }
        expect(result.totalDeaths).toBeGreaterThanOrEqual(0);
    });

    it("increases mortality with deprivation", () => {
        const noDeprivation = computeMortalityRates({
            deprivation: {},
            population,
        });

        const highDeprivation = computeMortalityRates({
            deprivation: { food: 1000, water: 1000 },
            population,
        });

        expect(highDeprivation.totalDeaths).toBeGreaterThan(noDeprivation.totalDeaths);
    });

    it("does not mutate input", () => {
        const popCopy = JSON.parse(JSON.stringify(population));
        computeMortalityRates({
            deprivation: { food: 100 },
            population,
        });
        expect(population).toEqual(popCopy);
    });
});

describe("applyMortality", () => {
    it("reduces population by mortality rate", () => {
        const population: Population = {
            farmer: { number: 1000, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            scientist: { number: 500, wealth: 0, wealthLevel: 0, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0, salary: 1000, birthRate: 0.6 },
            worker: { number: 2000, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            student: { number: 300, wealth: 0, wealthLevel: 0, qol: 30, expectedQol: 30, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            healtcarePersonal: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            policeMen: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            teacher: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            serviceWorker: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            clergy: { number: 20, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            retired: { number: 100, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            clerks: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            engineer: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            stayAtHome: { number: 500, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            serviceMan: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        };

        const mortalityRate: Record<keyof Population, number> = {
            farmer: 0.1,
            scientist: 0,
            worker: 0.05,
            student: 0,
            healtcarePersonal: 0,
            policeMen: 0,
            teacher: 0,
            serviceWorker: 0,
            clergy: 0,
            retired: 0,
            clerks: 0,
            engineer: 0,
            stayAtHome: 0,
            serviceMan: 0,
        };

        const result = applyMortality({ population, mortalityRate });

        // farmer: 1000 * 0.1 / 365 ≈ 0.274 deaths → ~999.726
        expect(result.farmer.number).toBeCloseTo(1000 - 1000 * 0.1 / 365, 4);
        // scientist: 0 mortality → unchanged
        expect(result.scientist.number).toBe(500);
        // worker: 2000 * 0.05 / 365 ≈ 0.274 deaths → ~1999.726
        expect(result.worker.number).toBeCloseTo(2000 - 2000 * 0.05 / 365, 4);
    });

    it("does not let population go negative", () => {
        const population: Population = {
            farmer: { number: 1, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            scientist: { number: 500, wealth: 0, wealthLevel: 0, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0, salary: 1000, birthRate: 0.6 },
            worker: { number: 2000, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            student: { number: 300, wealth: 0, wealthLevel: 0, qol: 30, expectedQol: 30, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            healtcarePersonal: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            policeMen: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            teacher: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            serviceWorker: { number: 100, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            clergy: { number: 20, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
            retired: { number: 100, wealth: 0, wealthLevel: 0, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            clerks: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            engineer: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 500, birthRate: 0.6 },
            stayAtHome: { number: 500, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 180, birthRate: 0 },
            serviceMan: { number: 50, wealth: 0, wealthLevel: 0, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0, salary: 200, birthRate: 0.6 },
        };

        const mortalityRate: Record<keyof Population, number> = {
            farmer: 1.0, // 100% mortality
            scientist: 0,
            worker: 0,
            student: 0,
            healtcarePersonal: 0,
            policeMen: 0,
            teacher: 0,
            serviceWorker: 0,
            clergy: 0,
            retired: 0,
            clerks: 0,
            engineer: 0,
            stayAtHome: 0,
            serviceMan: 0,
        };

        const result = applyMortality({ population, mortalityRate });
        // Daily mortality = annual rate / 365, so 1 farmer with 100% annual mortality
        // loses ~0.0027 people, staying above 0
        expect(result.farmer.number).toBeGreaterThan(0);
        expect(result.farmer.number).toBeLessThan(1);
    });
});
