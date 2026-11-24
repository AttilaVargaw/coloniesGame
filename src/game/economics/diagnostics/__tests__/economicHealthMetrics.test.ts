import { describe, it, expect, beforeEach } from "vitest";
import {
    EconomicHealthMetrics,
    createIndustrySectorMetrics,
    createHouseholdCategoryMetrics,
    createEmploymentMetrics,
    createTreasuryMetrics,
    createProductionDependencyExposure,
    DEFAULT_ECONOMIC_HEALTH_CONFIG,
} from "../economicHealthMetrics";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";

describe("EconomicHealthMetrics", () => {
    let metrics: EconomicHealthMetrics;

    beforeEach(() => {
        metrics = new EconomicHealthMetrics({ rollingWindowTicks: 10, priceVolatilityWindow: 5 });
    });

    describe("Market metrics", () => {
        it("records and retrieves market metrics", () => {
            const snapshot = {
                tick: 1,
                entityId: "colony1",
                goods: {
                    food: {
                        good: "food" as keyof Goods,
                        openingPrice: 30,
                        closingPrice: 32,
                        openingInventory: 1000,
                        productionAvailable: 500,
                        availableSupply: 1500,
                        desiredDemand: 1200,
                        fulfilledDemand: 1000,
                        unmetDemand: 200,
                        supplyDemandRatio: 1500 / 1200,
                        shortageRatio: 200 / 1200,
                        surplusRatio: 300 / 1500,
                        imbalance: (1200 - 1500) / 1500,
                        tradedQuantity: 1000,
                    },
                },
            };

            metrics.recordMarketMetrics(snapshot);
            const history = metrics.getMarketHistory();

            expect(history).toHaveLength(1);
            expect(history[0]).toEqual(snapshot);
        });

        it("computes shortage ratio", () => {
            const snapshot = {
                tick: 1,
                entityId: "colony1",
                goods: {
                    food: {
                        good: "food" as keyof Goods,
                        openingPrice: 30,
                        closingPrice: 32,
                        openingInventory: 1000,
                        productionAvailable: 500,
                        availableSupply: 1500,
                        desiredDemand: 1200,
                        fulfilledDemand: 1000,
                        unmetDemand: 200,
                        supplyDemandRatio: 1500 / 1200,
                        shortageRatio: 200 / 1200,
                        surplusRatio: 300 / 1500,
                        imbalance: (1200 - 1500) / 1500,
                        tradedQuantity: 1000,
                    },
                },
            };

            metrics.recordMarketMetrics(snapshot);
            const ratio = metrics.computeMarketShortageRatio("food");

            expect(ratio).toBeCloseTo(200 / 1200);
        });

        it("returns null for shortage ratio when no demand", () => {
            const snapshot = {
                tick: 1,
                entityId: "colony1",
                goods: {
                    food: {
                        good: "food" as keyof Goods,
                        openingPrice: 30,
                        closingPrice: 32,
                        openingInventory: 1000,
                        productionAvailable: 500,
                        availableSupply: 1500,
                        desiredDemand: 0,
                        fulfilledDemand: 0,
                        unmetDemand: 0,
                        supplyDemandRatio: Infinity,
                        shortageRatio: null,
                        surplusRatio: 1,
                        imbalance: -1,
                        tradedQuantity: 0,
                    },
                },
            };

            metrics.recordMarketMetrics(snapshot);
            const ratio = metrics.computeMarketShortageRatio("food");

            expect(ratio).toBeNull();
        });

        it("computes surplus ratio", () => {
            const snapshot = {
                tick: 1,
                entityId: "colony1",
                goods: {
                    food: {
                        good: "food" as keyof Goods,
                        openingPrice: 30,
                        closingPrice: 28,
                        openingInventory: 1000,
                        productionAvailable: 500,
                        availableSupply: 1500,
                        desiredDemand: 800,
                        fulfilledDemand: 800,
                        unmetDemand: 0,
                        supplyDemandRatio: 1500 / 800,
                        shortageRatio: 0,
                        surplusRatio: 700 / 1500,
                        imbalance: (800 - 1500) / 1500,
                        tradedQuantity: 800,
                    },
                },
            };

            metrics.recordMarketMetrics(snapshot);
            const ratio = metrics.computeMarketSurplusRatio("food");

            expect(ratio).toBeCloseTo(700 / 1500);
        });

        it("prunes history beyond rolling window", () => {
            for (let i = 0; i < 15; i++) {
                metrics.recordMarketMetrics({
                    tick: i,
                    entityId: "colony1",
                    goods: {},
                });
            }

            const history = metrics.getMarketHistory();
            expect(history).toHaveLength(10);
            expect(history[0].tick).toBe(5);
        });
    });

    describe("Industry metrics", () => {
        it("records and retrieves industry metrics", () => {
            const sectorMetrics = createIndustrySectorMetrics(
                "powerPlant",
                1,
                10000,
                6000,
                2000,
                500,
                0.8,
                { energy: 500 },
                { oil: 0.8 },
                { worker: 0.9 },
                null,
                0
            );

            metrics.recordIndustryMetrics("colony1", [sectorMetrics]);
            const history = metrics.getIndustryHistory("colony1");

            expect(history).toHaveLength(1);
            expect(history[0].sectorId).toBe("powerPlant");
            expect(history[0].operatingResultPreSubsidy).toBe(2000);
            expect(history[0].operatingResultPostSubsidy).toBe(2500);
            expect(history[0].profitMarginPreSubsidy).toBeCloseTo(0.2);
            expect(history[0].profitMarginPostSubsidy).toBeCloseTo(0.25);
        });

        it("computes operating results", () => {
            const sectorMetrics = createIndustrySectorMetrics(
                "powerPlant",
                1,
                10000,
                6000,
                2000,
                500,
                0.8,
                { energy: 500 },
                { oil: 0.8 },
                { worker: 0.9 },
                null,
                0
            );

            metrics.recordIndustryMetrics("colony1", [sectorMetrics]);
            const result = metrics.computeIndustryOperatingResult("powerPlant", "colony1");

            expect(result.preSubsidy).toBe(2000);
            expect(result.postSubsidy).toBe(2500);
            expect(result.marginPreSubsidy).toBeCloseTo(0.2);
            expect(result.marginPostSubsidy).toBeCloseTo(0.25);
        });

        it("computes sector inactivity duration", () => {
            for (let i = 0; i < 5; i++) {
                metrics.recordIndustryMetrics("colony1", [
                    createIndustrySectorMetrics("powerPlant", i, 0, 0, 0, 0, 0, {}, {}, {}, "No materials", i),
                ]);
            }
            metrics.recordIndustryMetrics("colony1", [
                createIndustrySectorMetrics("powerPlant", 5, 1000, 500, 200, 0, 0.8, {}, {}, {}, null, 0),
            ]);

            const duration = metrics.computeSectorInactivityDuration("powerPlant", "colony1");
            expect(duration).toBe(0);

            metrics.recordIndustryMetrics("colony1", [
                createIndustrySectorMetrics("powerPlant", 6, 0, 0, 0, 0, 0, {}, {}, {}, "No budget", 1),
            ]);

            const duration2 = metrics.computeSectorInactivityDuration("powerPlant", "colony1");
            expect(duration2).toBe(1);
        });

        it("returns null for unknown sector", () => {
            const result = metrics.computeIndustryOperatingResult("unknown", "colony1");
            expect(result.preSubsidy).toBeNull();
        });
    });

    describe("Household metrics", () => {
        it("records and retrieves household metrics", () => {
            const prices: Record<keyof Goods, number> = {
                food: 30, water: 10, energy: 20, consumerGoods: 100,
                tourism: 300, services: 15, agriculturalGoods: 20, tylium: 150,
                metals: 150, fissionMaterial: 100, machinery: 50, medicine: 20,
                lumber: 30, oil: 100, spaceShips: 2000, nuclearWeapons: 300,
                vehicles: 80, environmentFactor: 50, faith: 40, lawEnforcement: 40,
                healthcare: 70, chemicals: 40, buildings: 20, waste: 2,
                paper: 30, logistics: 60, entertainment: 30, education: 80,
                mobility: 200, defense: 100, monetaryServices: 200, militaryEquipment: 800,
            };

            const householdMetrics = createHouseholdCategoryMetrics(
                "worker",
                1,
                1000,
                5000,
                2000,
                1500,
                { food: 50, consumerGoods: 10 },
                { food: 45, consumerGoods: 8 },
                prices,
                60,
                65
            );

            metrics.recordHouseholdMetrics("colony1", [householdMetrics]);
            const history = metrics.getHouseholdHistory("colony1");

            expect(history).toHaveLength(1);
            expect(history[0].category).toBe("worker");
            expect(history[0].consumptionFulfillmentRatio).toBeCloseTo((45*30 + 8*100) / (50*30 + 10*100));
            expect(history[0].purchasingPower).toBeCloseTo((5000 + 2000) / (50*30 + 10*100));
        });

        it("computes household purchasing power", () => {
            const prices: Record<keyof Goods, number> = { food: 30 } as Record<keyof Goods, number>;

            const householdMetrics = createHouseholdCategoryMetrics(
                "worker",
                1,
                1000,
                5000,
                2000,
                1500,
                { food: 50 },
                { food: 45 },
                prices,
                60,
                65
            );

            metrics.recordHouseholdMetrics("colony1", [householdMetrics]);
            const pp = metrics.computeHouseholdPurchasingPower("worker", "colony1");

            expect(pp).toBeCloseTo(7000 / 1500);
        });

        it("computes consumption fulfillment", () => {
            const prices: Record<keyof Goods, number> = { food: 30 } as Record<keyof Goods, number>;

            const householdMetrics = createHouseholdCategoryMetrics(
                "worker",
                1,
                1000,
                5000,
                2000,
                1500,
                { food: 50 },
                { food: 45 },
                prices,
                60,
                65
            );

            metrics.recordHouseholdMetrics("colony1", [householdMetrics]);
            const fulfillment = metrics.computeHouseholdConsumptionFulfillment("worker", "colony1");

            expect(fulfillment).toBeCloseTo(45 / 50);
        });

        it("returns null for zero desired consumption", () => {
            const prices: Record<keyof Goods, number> = { food: 30 } as Record<keyof Goods, number>;

            const householdMetrics = createHouseholdCategoryMetrics(
                "worker",
                1,
                1000,
                5000,
                2000,
                0,
                {},
                {},
                prices,
                60,
                65
            );

            metrics.recordHouseholdMetrics("colony1", [householdMetrics]);
            const fulfillment = metrics.computeHouseholdConsumptionFulfillment("worker", "colony1");

            expect(fulfillment).toBeNull();
        });
    });

    describe("Employment metrics", () => {
        it("records and computes employment utilization", () => {
            const empMetrics = createEmploymentMetrics(1, "colony1", {
                worker: { available: 1000, employed: 800 },
                farmer: { available: 500, employed: 500 },
                retired: { available: 200, employed: 0 },
            });

            metrics.recordEmploymentMetrics(empMetrics);

            expect(metrics.computeEmploymentUtilization("worker")).toBeCloseTo(0.8);
            expect(metrics.computeEmploymentUtilization("farmer")).toBe(1.0);
            expect(metrics.computeEmploymentUtilization("retired")).toBe(0);
            expect(metrics.computeOverallEmploymentUtilization()).toBeCloseTo(1300 / 1700);
        });

        it("handles zero available labor", () => {
            const empMetrics = createEmploymentMetrics(1, "colony1", {
                stayAtHome: { available: 0, employed: 0 },
            });

            metrics.recordEmploymentMetrics(empMetrics);
            expect(metrics.computeEmploymentUtilization("stayAtHome")).toBeNull();
        });
    });

    describe("Treasury metrics", () => {
        it("computes treasury runway", () => {
            const treasuryMetrics = createTreasuryMetrics(1, "colony1", 1_000_000, 50_000, 10_000, 30_000);
            metrics.recordTreasuryMetrics(treasuryMetrics);

            expect(metrics.computeTreasuryRunway()).toBeCloseTo(1_000_000 / 60_000);
        });

        it("returns null runway when no outflows", () => {
            const treasuryMetrics = createTreasuryMetrics(1, "colony1", 1_000_000, 0, 0, 30_000);
            metrics.recordTreasuryMetrics(treasuryMetrics);

            expect(metrics.computeTreasuryRunway()).toBeNull();
        });

        it("returns null runway when negative balance", () => {
            const treasuryMetrics = createTreasuryMetrics(1, "colony1", -100_000, 50_000, 10_000, 30_000);
            metrics.recordTreasuryMetrics(treasuryMetrics);

            expect(metrics.computeTreasuryRunway()).toBeNull();
        });
    });

    describe("Price volatility", () => {
        it("computes price volatility from history", () => {
            const basePrices: Record<keyof Goods, number> = {
                food: 30, water: 10, energy: 20, consumerGoods: 100,
                tourism: 300, services: 15, agriculturalGoods: 20, tylium: 150,
                metals: 150, fissionMaterial: 100, machinery: 50, medicine: 20,
                lumber: 30, oil: 100, spaceShips: 2000, nuclearWeapons: 300,
                vehicles: 80, environmentFactor: 50, faith: 40, lawEnforcement: 40,
                healthcare: 70, chemicals: 40, buildings: 20, waste: 2,
                paper: 30, logistics: 60, entertainment: 30, education: 80,
                mobility: 200, defense: 100, monetaryServices: 200, militaryEquipment: 800,
            };

            // Simulate price history: 30 -> 32 -> 31 -> 33 -> 32
            metrics.recordPriceSnapshot("colony1", { food: 30 }, basePrices);
            metrics.recordPriceSnapshot("colony1", { food: 32 }, basePrices);
            metrics.recordPriceSnapshot("colony1", { food: 31 }, basePrices);
            metrics.recordPriceSnapshot("colony1", { food: 33 }, basePrices);
            metrics.recordPriceSnapshot("colony1", { food: 32 }, basePrices);

            const volatility = metrics.computePriceVolatility("colony1", "food");
            expect(volatility).not.toBeNull();
            expect(volatility! > 0).toBe(true);
        });

        it("returns null for insufficient history", () => {
            const basePrices: Record<keyof Goods, number> = { food: 30 } as Record<keyof Goods, number>;
            metrics.recordPriceSnapshot("colony1", { food: 30 }, basePrices);

            const volatility = metrics.computePriceVolatility("colony1", "food");
            expect(volatility).toBeNull();
        });

        it("detects price at floor and ceiling", () => {
            const basePrices: Record<keyof Goods, number> = {
                food: 30, water: 10, energy: 20, consumerGoods: 100,
                tourism: 300, services: 15, agriculturalGoods: 20, tylium: 150,
                metals: 150, fissionMaterial: 100, machinery: 50, medicine: 20,
                lumber: 30, oil: 100, spaceShips: 2000, nuclearWeapons: 300,
                vehicles: 80, environmentFactor: 50, faith: 40, lawEnforcement: 40,
                healthcare: 70, chemicals: 40, buildings: 20, waste: 2,
                paper: 30, logistics: 60, entertainment: 30, education: 80,
                mobility: 200, defense: 100, monetaryServices: 200, militaryEquipment: 800,
            };

            // Need all histories for getLatestSnapshot
            // Market metrics must include openingPrice for basePrice lookup
            metrics.recordMarketMetrics({ 
                tick: 1, 
                entityId: "colony1", 
                goods: {
                    food: {
                        good: "food" as keyof Goods,
                        openingPrice: 30,
                        closingPrice: 30,
                        openingInventory: 1000,
                        productionAvailable: 500,
                        availableSupply: 1500,
                        desiredDemand: 1000,
                        fulfilledDemand: 1000,
                        unmetDemand: 0,
                        supplyDemandRatio: 1.5,
                        shortageRatio: 0,
                        surplusRatio: 0.33,
                        imbalance: -0.33,
                        tradedQuantity: 1000,
                    }
                } 
            });
            metrics.recordIndustryMetrics("colony1", [createIndustrySectorMetrics("powerPlant", 1, 1000, 500, 200, 0, 0.8, {}, {}, {}, null, 0)]);
            metrics.recordHouseholdMetrics("colony1", [createHouseholdCategoryMetrics("worker", 1, 1000, 5000, 2000, 1500, { food: 50 }, { food: 45 }, basePrices, 60, 65)]);
            metrics.recordEmploymentMetrics(createEmploymentMetrics(1, "colony1", { worker: { available: 1000, employed: 800 } }));
            metrics.recordTreasuryMetrics(createTreasuryMetrics(1, "colony1", 1_000_000, 50_000, 10_000, 30_000));
            metrics.recordDependencyExposure(createProductionDependencyExposure(1, "colony1", {
                powerPlant: { oil: { requirement: 100, shortageRatio: 0.5 } },
            }));

            // Price at floor (0.1 * 30 = 3)
            metrics.recordPriceSnapshot("colony1", { food: 3 }, basePrices);
            const snapshot = metrics.getLatestSnapshot("colony1");
            expect(snapshot?.prices.byGood.food?.atFloor).toBe(true);
            expect(snapshot?.prices.byGood.food?.atCeiling).toBe(false);

            // Price at ceiling (10 * 30 = 300)
            metrics.recordPriceSnapshot("colony1", { food: 300 }, basePrices);
            const snapshot2 = metrics.getLatestSnapshot("colony1");
            expect(snapshot2?.prices.byGood.food?.atFloor).toBe(false);
            expect(snapshot2?.prices.byGood.food?.atCeiling).toBe(true);
        });
    });

    describe("Production dependency exposure", () => {
        it("computes exposure from shortage ratios", () => {
            const exposure = createProductionDependencyExposure(1, "colony1", {
                powerPlant: {
                    oil: { requirement: 100, shortageRatio: 0.5 },
                    environmentFactor: { requirement: 10, shortageRatio: 0.2 },
                },
                farm: {
                    water: { requirement: 50, shortageRatio: 0.0 },
                },
            });

            metrics.recordDependencyExposure(exposure);

            expect(metrics.computeProductionDependencyExposure("powerPlant")).toBeCloseTo(100 * 0.5 + 10 * 0.2);
            expect(metrics.computeProductionDependencyExposure("farm")).toBeCloseTo(0);
        });
    });

    describe("Latest snapshot aggregation", () => {
        it("returns null when any history is empty", () => {
            metrics.recordMarketMetrics({ tick: 1, entityId: "colony1", goods: {} });
            expect(metrics.getLatestSnapshot("colony1")).toBeNull();
        });

        it("returns full snapshot when all histories populated", () => {
            const basePrices: Record<keyof Goods, number> = {
                food: 30, water: 10, energy: 20, consumerGoods: 100,
                tourism: 300, services: 15, agriculturalGoods: 20, tylium: 150,
                metals: 150, fissionMaterial: 100, machinery: 50, medicine: 20,
                lumber: 30, oil: 100, spaceShips: 2000, nuclearWeapons: 300,
                vehicles: 80, environmentFactor: 50, faith: 40, lawEnforcement: 40,
                healthcare: 70, chemicals: 40, buildings: 20, waste: 2,
                paper: 30, logistics: 60, entertainment: 30, education: 80,
                mobility: 200, defense: 100, monetaryServices: 200, militaryEquipment: 800,
            };

            metrics.recordMarketMetrics({ tick: 1, entityId: "colony1", goods: {} });
            metrics.recordIndustryMetrics("colony1", [createIndustrySectorMetrics("powerPlant", 1, 1000, 500, 200, 0, 0.8, {}, {}, {}, null, 0)]);
            metrics.recordHouseholdMetrics("colony1", [createHouseholdCategoryMetrics("worker", 1, 1000, 5000, 2000, 1500, { food: 50 }, { food: 45 }, basePrices, 60, 65)]);
            metrics.recordEmploymentMetrics(createEmploymentMetrics(1, "colony1", { worker: { available: 1000, employed: 800 } }));
            metrics.recordTreasuryMetrics(createTreasuryMetrics(1, "colony1", 1_000_000, 50_000, 10_000, 30_000));
            metrics.recordDependencyExposure(createProductionDependencyExposure(1, "colony1", {
                powerPlant: { oil: { requirement: 100, shortageRatio: 0.5 } },
            }));

            const snapshot = metrics.getLatestSnapshot("colony1");
            expect(snapshot).not.toBeNull();
            expect(snapshot?.tick).toBe(1);
            expect(snapshot?.entityId).toBe("colony1");
        });
    });

    describe("Clear", () => {
        it("clears all histories", () => {
            metrics.recordMarketMetrics({ tick: 1, entityId: "colony1", goods: {} });
            metrics.clear();

            expect(metrics.getMarketHistory()).toHaveLength(0);
            expect(metrics.getIndustryHistory("colony1")).toHaveLength(0);
            expect(metrics.getHouseholdHistory("colony1")).toHaveLength(0);
            expect(metrics.getEmploymentHistory()).toHaveLength(0);
            expect(metrics.getTreasuryHistory()).toHaveLength(0);
            expect(metrics.getDependencyHistory()).toHaveLength(0);
        });
    });
});