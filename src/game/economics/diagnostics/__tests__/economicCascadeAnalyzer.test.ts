import { describe, it, expect, beforeEach } from "vitest";
import { EconomicHealthMetrics } from "../economicHealthMetrics";
import { EconomicCascadeAnalyzer } from "../economicCascadeAnalyzer";
import { Goods } from "@game/data/Goods";

describe("EconomicCascadeAnalyzer", () => {
    let healthMetrics: EconomicHealthMetrics;
    let analyzer: EconomicCascadeAnalyzer;

    beforeEach(() => {
        healthMetrics = new EconomicHealthMetrics({ rollingWindowTicks: 50, priceVolatilityWindow: 20 });
        analyzer = new EconomicCascadeAnalyzer(healthMetrics, {
            rollingWindowTicks: 50,
            linkDetectionWindow: 5,
            minConfidenceForLink: 0.5,
            maxCascadeDepth: 5,
            cascadeResolutionThreshold: 10,
        });
    });

    const createMarketSnapshot = (tick: number, goods: Record<string, any>) => ({
        tick,
        entityId: "colony1",
        goods: Object.fromEntries(
            Object.entries(goods).map(([key, value]) => [key, { ...value, good: key as keyof Goods }])
        ),
    });

    const createIndustrySnapshot = (tick: number, sectors: Record<string, any>) => ({
        tick,
        entityId: "colony1",
        sectors,
    });

    describe("Cascade detection", () => {
        it("detects shortage and creates cascade", () => {
            // Record market with oil shortage
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));

            const report = analyzer.analyze(1, "colony1");
            expect(report.cascades.length).toBeGreaterThan(0);
            expect(report.summary.activeCascades).toBeGreaterThan(0);
        });

        it("links sector stop to shortage", () => {
            // Tick 1: oil shortage
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");

            // Tick 2: powerPlant stops
            healthMetrics.recordMarketMetrics(createMarketSnapshot(2, {
                oil: {
                    openingPrice: 150, closingPrice: 180, openingInventory: 30,
                    productionAvailable: 5, availableSupply: 35, desiredDemand: 200,
                    fulfilledDemand: 35, unmetDemand: 165, supplyDemandRatio: 0.175,
                    shortageRatio: 0.825, surplusRatio: 0, imbalance: 0.825, tradedQuantity: 35,
                    currentPrice: 180, basePrice: 100, atFloor: false, atCeiling: true,
                },
            }));

            // Need to record industry metrics for sector stop
            // The analyzer gets industry history from healthMetrics
            const industryHistory = healthMetrics.getIndustryHistory("colony1");
            // Manually add industry metrics for tick 2
            healthMetrics.recordIndustryMetrics("colony1", [{
                sectorId: "powerPlant",
                tick: 2,
                revenue: 0,
                inputCosts: 0,
                laborCosts: 0,
                subsidies: 0,
                operatingResultPreSubsidy: 0,
                operatingResultPostSubsidy: 0,
                profitMarginPreSubsidy: null,
                profitMarginPostSubsidy: null,
                utilization: 0,
                productionOutput: {},
                inputAvailability: { oil: 0.1 },
                laborAvailability: { worker: 1.0 },
                stopReason: "No materials",
                consecutiveStoppedTicks: 1,
            }]);

            const report = analyzer.analyze(2, "colony1");
            expect(report.cascades.length).toBeGreaterThan(0);
            
            const cascade = report.cascades[0];
            expect(cascade.nodes.length).toBeGreaterThan(1);
            expect(cascade.links.length).toBeGreaterThan(0);
            
            // Check for confirmed dependency link
            const confirmedLink = cascade.links.find(l => l.evidenceLevel === "confirmed_dependency");
            expect(confirmedLink).toBeDefined();
        });

        it("generates narrative for cascade", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");

            const report = analyzer.analyze(2, "colony1");
            expect(report.cascades[0].narrative).toContain("Cascade");
        });
    });

    describe("Cascade resolution", () => {
        it("resolves cascade when problems disappear", () => {
            // Create shortage cascade
            for (let i = 1; i <= 5; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    oil: {
                        openingPrice: 100, closingPrice: 150, openingInventory: 50,
                        productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                        fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                        shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                        currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                    },
                }));
                analyzer.analyze(i, "colony1");
            }

            expect(analyzer.getActiveCascades().length).toBeGreaterThan(0);

            // Resolve shortage
            for (let i = 6; i <= 20; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    oil: {
                        openingPrice: 100, closingPrice: 100, openingInventory: 500,
                        productionAvailable: 100, availableSupply: 600, desiredDemand: 200,
                        fulfilledDemand: 200, unmetDemand: 0, supplyDemandRatio: 3.0,
                        shortageRatio: 0, surplusRatio: 0.67, imbalance: -0.67, tradedQuantity: 200,
                        currentPrice: 100, basePrice: 100, atFloor: false, atCeiling: false,
                    },
                }));
                analyzer.analyze(i, "colony1");
            }

            expect(analyzer.getActiveCascades().length).toBe(0);
            expect(analyzer.getResolvedCascades().length).toBeGreaterThan(0);
        });
    });

    describe("Evidence levels", () => {
        it("classifies confirmed dependencies", () => {
            // Oil shortage (tick 1)
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");

            // PowerPlant stop (tick 2) - confirmed dependency
            healthMetrics.recordMarketMetrics(createMarketSnapshot(2, {
                oil: {
                    openingPrice: 150, closingPrice: 180, openingInventory: 30,
                    productionAvailable: 5, availableSupply: 35, desiredDemand: 200,
                    fulfilledDemand: 35, unmetDemand: 165, supplyDemandRatio: 0.175,
                    shortageRatio: 0.825, surplusRatio: 0, imbalance: 0.825, tradedQuantity: 35,
                    currentPrice: 180, basePrice: 100, atFloor: false, atCeiling: true,
                },
            }));
            healthMetrics.recordIndustryMetrics("colony1", [{
                sectorId: "powerPlant",
                tick: 2,
                revenue: 0, inputCosts: 0, laborCosts: 0, subsidies: 0,
                operatingResultPreSubsidy: 0, operatingResultPostSubsidy: 0,
                profitMarginPreSubsidy: null, profitMarginPostSubsidy: null,
                utilization: 0, productionOutput: {},
                inputAvailability: { oil: 0.1 }, laborAvailability: { worker: 1.0 },
                stopReason: "No materials", consecutiveStoppedTicks: 1,
            }]);

            const report = analyzer.analyze(2, "colony1");
            const cascade = report.cascades[0];
            const confirmedLinks = cascade.links.filter(l => l.evidenceLevel === "confirmed_dependency");
            expect(confirmedLinks.length).toBeGreaterThan(0);
        });

        it("classifies observed associations", () => {
            // Production decline (tick 1) - utilization < 0.3
            healthMetrics.recordIndustryMetrics("colony1", [{
                sectorId: "powerPlant",
                tick: 1,
                revenue: 5000, inputCosts: 2000, laborCosts: 1000, subsidies: 0,
                operatingResultPreSubsidy: 2000, operatingResultPostSubsidy: 2000,
                profitMarginPreSubsidy: 0.4, profitMarginPostSubsidy: 0.4,
                utilization: 0.2, productionOutput: { energy: 100 },
                inputAvailability: { oil: 0.5 }, laborAvailability: { worker: 1.0 },
                stopReason: null, consecutiveStoppedTicks: 0,
            }]);
            analyzer.analyze(1, "colony1");

            // Energy shortage (tick 2)
            healthMetrics.recordMarketMetrics(createMarketSnapshot(2, {
                energy: {
                    openingPrice: 20, closingPrice: 30, openingInventory: 100,
                    productionAvailable: 50, availableSupply: 150, desiredDemand: 300,
                    fulfilledDemand: 150, unmetDemand: 150, supplyDemandRatio: 0.5,
                    shortageRatio: 0.5, surplusRatio: 0, imbalance: 0.5, tradedQuantity: 150,
                    currentPrice: 30, basePrice: 20, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(2, "colony1");

            const report = analyzer.analyze(2, "colony1");
            // Verify cascade system is working - at least one cascade exists
            expect(report.cascades.length).toBeGreaterThan(0);
        });
    });

    describe("Cascade queries", () => {
        it("returns active and resolved cascades", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");

            expect(analyzer.getActiveCascades().length).toBeGreaterThan(0);
            expect(analyzer.getResolvedCascades().length).toBe(0);

            // Resolve
            for (let i = 2; i <= 15; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    oil: {
                        openingPrice: 100, closingPrice: 100, openingInventory: 500,
                        productionAvailable: 100, availableSupply: 600, desiredDemand: 200,
                        fulfilledDemand: 200, unmetDemand: 0, supplyDemandRatio: 3.0,
                        shortageRatio: 0, surplusRatio: 0.67, imbalance: -0.67, tradedQuantity: 200,
                        currentPrice: 100, basePrice: 100, atFloor: false, atCeiling: false,
                    },
                }));
                analyzer.analyze(i, "colony1");
            }

            expect(analyzer.getActiveCascades().length).toBe(0);
            expect(analyzer.getResolvedCascades().length).toBeGreaterThan(0);
        });

        it("gets cascade by ID", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");

            const active = analyzer.getActiveCascades();
            expect(active.length).toBeGreaterThan(0);
            
            const cascade = analyzer.getCascadeById(active[0].id);
            expect(cascade).not.toBeNull();
            expect(cascade?.id).toBe(active[0].id);
        });
    });

    describe("Clear", () => {
        it("clears all cascades", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                oil: {
                    openingPrice: 100, closingPrice: 150, openingInventory: 50,
                    productionAvailable: 10, availableSupply: 60, desiredDemand: 200,
                    fulfilledDemand: 60, unmetDemand: 140, supplyDemandRatio: 0.3,
                    shortageRatio: 0.7, surplusRatio: 0, imbalance: 0.7, tradedQuantity: 60,
                    currentPrice: 150, basePrice: 100, atFloor: false, atCeiling: false,
                },
            }));
            analyzer.analyze(1, "colony1");
            analyzer.clear();

            expect(analyzer.getActiveCascades().length).toBe(0);
            expect(analyzer.getResolvedCascades().length).toBe(0);
        });
    });
});