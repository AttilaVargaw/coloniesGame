import { describe, it, expect, beforeEach } from "vitest";
import { EconomicHealthMetrics } from "../economicHealthMetrics";
import { MarketStabilityAnalyzer, DEFAULT_MARKET_STABILITY_CONFIG } from "../marketStabilityAnalyzer";
import { Goods } from "@game/data/Goods";

describe("MarketStabilityAnalyzer", () => {
    let healthMetrics: EconomicHealthMetrics;
    let analyzer: MarketStabilityAnalyzer;

    beforeEach(() => {
        healthMetrics = new EconomicHealthMetrics({ rollingWindowTicks: 50, priceVolatilityWindow: 20 });
        analyzer = new MarketStabilityAnalyzer(healthMetrics, {
            shortagePersistenceThreshold: 3,
            surplusPersistenceThreshold: 5,
            priceTrendWindow: 5,
            oscillationDetectionWindow: 10,
            minOscillationAmplitude: 0.05,
            unmetDemandPersistenceThreshold: 3,
        });
    });

    const createMarketSnapshot = (tick: number, goods: Record<string, any>) => ({
        tick,
        entityId: "colony1",
        goods: Object.fromEntries(
            Object.entries(goods).map(([key, value]) => [key, { ...value, good: key as keyof Goods }])
        ),
    });

    describe("Persistent shortage detection", () => {
        it("detects persistent shortage after threshold", () => {
            for (let i = 1; i <= 5; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    food: {
                        openingPrice: 30, closingPrice: 35, openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 200,
                        fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75,
                        shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150,
                    },
                }));

                const report = analyzer.analyze(i, "colony1");
                
                if (i < 3) {
                    expect(report.alerts.filter(a => a.type === "persistent_shortage")).toHaveLength(0);
                } else {
                    const shortageAlerts = report.alerts.filter(a => a.type === "persistent_shortage");
                    expect(shortageAlerts).toHaveLength(1);
                    expect(shortageAlerts[0].consecutiveTicks).toBe(i);
                    expect(shortageAlerts[0].severity).toBe("warning");
                }
            }
        });

        it("escalates to critical when shortage ratio > 50%", () => {
            for (let i = 1; i <= 4; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    food: {
                        openingPrice: 30, closingPrice: 50, openingInventory: 100,
                        productionAvailable: 20, availableSupply: 120, desiredDemand: 300,
                        fulfilledDemand: 120, unmetDemand: 180, supplyDemandRatio: 0.4,
                        shortageRatio: 0.6, surplusRatio: 0, imbalance: 0.6, tradedQuantity: 120,
                    },
                }));

                const report = analyzer.analyze(i, "colony1");
                
                if (i >= 3) {
                    const shortageAlerts = report.alerts.filter(a => a.type === "persistent_shortage");
                    expect(shortageAlerts[0].severity).toBe("critical");
                }
            }
        });

        it("clears shortage tracking when shortage ends", () => {
            for (let i = 1; i <= 4; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    food: {
                        openingPrice: 30, closingPrice: 35, openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 200,
                        fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75,
                        shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150,
                    },
                }));
                analyzer.analyze(i, "colony1");
            }

            // Shortage ends
            healthMetrics.recordMarketMetrics(createMarketSnapshot(5, {
                food: {
                    openingPrice: 35, closingPrice: 32, openingInventory: 200,
                    productionAvailable: 100, availableSupply: 300, desiredDemand: 150,
                    fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 2.0,
                    shortageRatio: 0, surplusRatio: 0.5, imbalance: -0.5, tradedQuantity: 150,
                },
            }));

            const report = analyzer.analyze(5, "colony1");
            const shortageAlerts = report.alerts.filter(a => a.type === "persistent_shortage");
            expect(shortageAlerts).toHaveLength(0);
        });
    });

    describe("Persistent surplus detection", () => {
        it("detects persistent surplus after threshold", () => {
            for (let i = 1; i <= 7; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    consumerGoods: {
                        openingPrice: 100, closingPrice: 90, openingInventory: 500,
                        productionAvailable: 200, availableSupply: 700, desiredDemand: 200,
                        fulfilledDemand: 200, unmetDemand: 0, supplyDemandRatio: 3.5,
                        shortageRatio: 0, surplusRatio: 0.71, imbalance: -0.71, tradedQuantity: 200,
                    },
                }));

                const report = analyzer.analyze(i, "colony1");
                
                if (i < 5) {
                    expect(report.alerts.filter(a => a.type === "persistent_surplus")).toHaveLength(0);
                } else {
                    const surplusAlerts = report.alerts.filter(a => a.type === "persistent_surplus");
                    expect(surplusAlerts).toHaveLength(1);
                }
            }
        });
    });

    describe("Price trend detection", () => {
        it("detects repeated price increases", () => {
            // Record price history: 30 -> 32 -> 34 -> 36 -> 38 -> 40 -> 42 -> 44 -> 46 -> 48 (10 increases)
            const prices = [30, 32, 34, 36, 38, 40, 42, 44, 46, 48];
            
            // Record all market metrics first
            for (let i = 0; i < prices.length; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i + 1, {
                    food: {
                        openingPrice: prices[i], closingPrice: prices[i], openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                        fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                        shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    },
                }));
            }
            
            // Analyze all ticks, capture the last report
            let finalReport: any;
            for (let i = 0; i < prices.length; i++) {
                finalReport = analyzer.analyze(i + 1, "colony1");
            }

            // Check the last report (tick 10)
            const trendAlerts = finalReport!.alerts.filter((a: any) => a.type === "repeated_price_increase");
            expect(trendAlerts.length).toBeGreaterThan(0);
            expect(trendAlerts[0].evidence.increaseRatio).toBeGreaterThanOrEqual(0.8);
        });

        it("detects repeated price decreases", () => {
            const prices = [50, 48, 46, 44, 42, 40, 38, 36, 34, 32];
            
            // Record all market metrics first
            for (let i = 0; i < prices.length; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i + 1, {
                    food: {
                        openingPrice: prices[i], closingPrice: prices[i], openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                        fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                        shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    },
                }));
            }
            
            // Analyze all ticks, capture the last report
            let finalReport: any;
            for (let i = 0; i < prices.length; i++) {
                finalReport = analyzer.analyze(i + 1, "colony1");
            }

            const trendAlerts = finalReport!.alerts.filter((a: any) => a.type === "repeated_price_decrease");
            expect(trendAlerts.length).toBeGreaterThan(0);
            expect(trendAlerts[0].evidence.decreaseRatio).toBeGreaterThanOrEqual(0.8);
        });
    });

    describe("Price oscillation detection", () => {
        it("detects price oscillation", () => {
            // Oscillating prices: 30 -> 35 -> 30 -> 35 -> 30 -> 35 -> 30 -> 35
            const prices = [30, 35, 30, 35, 30, 35, 30, 35, 30, 35, 30, 35];
            
            for (let i = 0; i < prices.length; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i + 1, {
                    energy: {
                        openingPrice: prices[i], closingPrice: prices[i], openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                        fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                        shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    },
                }));
                analyzer.analyze(i + 1, "colony1");
            }

            const report = analyzer.analyze(prices.length, "colony1");
            const oscAlerts = report.alerts.filter(a => a.type === "price_oscillation");
            expect(oscAlerts.length).toBeGreaterThan(0);
            expect(oscAlerts[0].evidence.directionChanges).toBeGreaterThanOrEqual(5);
        });

        it("does not detect oscillation for stable prices", () => {
            const prices = [30, 30.1, 30, 30.1, 30, 30.1];
            
            for (let i = 0; i < prices.length; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i + 1, {
                    energy: {
                        openingPrice: prices[i], closingPrice: prices[i], openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                        fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                        shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    },
                }));
                analyzer.analyze(i + 1, "colony1");
            }

            const report = analyzer.analyze(prices.length, "colony1");
            const oscAlerts = report.alerts.filter(a => a.type === "price_oscillation");
            expect(oscAlerts).toHaveLength(0);
        });
    });

    describe("Price bounds detection", () => {
        it("detects price at floor", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                food: {
                    openingPrice: 3, closingPrice: 3, openingInventory: 100,
                    productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                    fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                    shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    currentPrice: 3, basePrice: 30, atFloor: true, atCeiling: false,
                },
            }));

            const report = analyzer.analyze(1, "colony1");
            const floorAlerts = report.alerts.filter(a => a.type === "at_price_floor");
            expect(floorAlerts).toHaveLength(1);
            expect(floorAlerts[0].severity).toBe("info");
        });

        it("detects price at ceiling", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                food: {
                    openingPrice: 300, closingPrice: 300, openingInventory: 100,
                    productionAvailable: 50, availableSupply: 150, desiredDemand: 150,
                    fulfilledDemand: 150, unmetDemand: 0, supplyDemandRatio: 1,
                    shortageRatio: 0, surplusRatio: 0, imbalance: 0, tradedQuantity: 150,
                    currentPrice: 300, basePrice: 30, atFloor: false, atCeiling: true,
                },
            }));

            const report = analyzer.analyze(1, "colony1");
            const ceilingAlerts = report.alerts.filter(a => a.type === "at_price_ceiling");
            expect(ceilingAlerts).toHaveLength(1);
            expect(ceilingAlerts[0].severity).toBe("warning");
            expect(ceilingAlerts[0].description).toContain("genuine scarcity");
        });
    });

    describe("Unmet demand persistence", () => {
        it("detects persistent unmet demand", () => {
            for (let i = 1; i <= 5; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    medicine: {
                        openingPrice: 20, closingPrice: 25, openingInventory: 100,
                        productionAvailable: 20, availableSupply: 120, desiredDemand: 200,
                        fulfilledDemand: 120, unmetDemand: 80, supplyDemandRatio: 0.6,
                        shortageRatio: 0.4, surplusRatio: 0, imbalance: 0.4, tradedQuantity: 120,
                    },
                }));

                const report = analyzer.analyze(i, "colony1");
                
                if (i < 3) {
                    expect(report.alerts.filter(a => a.type === "unmet_demand_persistent")).toHaveLength(0);
                } else {
                    const unmetAlerts = report.alerts.filter(a => a.type === "unmet_demand_persistent");
                    expect(unmetAlerts).toHaveLength(1);
                    expect(unmetAlerts[0].evidence.unmetDemand).toBe(80);
                }
            }
        });
    });

    describe("No demand with inventory", () => {
        it("detects goods with inventory but no demand", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                nuclearWeapons: {
                    openingPrice: 300, closingPrice: 300, openingInventory: 50,
                    productionAvailable: 0, availableSupply: 50, desiredDemand: 0,
                    fulfilledDemand: 0, unmetDemand: 0, supplyDemandRatio: Infinity,
                    shortageRatio: 0, surplusRatio: 1, imbalance: -1, tradedQuantity: 0,
                },
            }));

            const report = analyzer.analyze(1, "colony1");
            const alerts = report.alerts.filter(a => a.type === "no_demand_with_inventory");
            expect(alerts).toHaveLength(1);
            expect(alerts[0].evidence.openingInventory).toBe(50);
        });
    });

    describe("Summary computation", () => {
        it("computes correct summary counts", () => {
            // Record 5 ticks with shortage (food) and surplus (consumerGoods)
            for (let i = 1; i <= 5; i++) {
                healthMetrics.recordMarketMetrics(createMarketSnapshot(i, {
                    food: {
                        openingPrice: 30, closingPrice: 35, openingInventory: 100,
                        productionAvailable: 50, availableSupply: 150, desiredDemand: 200,
                        fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75,
                        shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150,
                        currentPrice: 35, basePrice: 30, atFloor: false, atCeiling: false,
                    },
                    consumerGoods: {
                        openingPrice: 100, closingPrice: 90, openingInventory: 500,
                        productionAvailable: 200, availableSupply: 700, desiredDemand: 200,
                        fulfilledDemand: 200, unmetDemand: 0, supplyDemandRatio: 3.5,
                        shortageRatio: 0, surplusRatio: 0.71, imbalance: -0.71, tradedQuantity: 200,
                        currentPrice: 90, basePrice: 100, atFloor: false, atCeiling: false,
                    },
                }));
            }

            // Analyze each tick to build up persistence tracking
            for (let i = 1; i <= 5; i++) {
                analyzer.analyze(i, "colony1");
            }

            // Check at tick 5
            const report = analyzer.analyze(5, "colony1");
            console.log("Alerts:", report.alerts.map(a => a.type));
            console.log("Summary:", report.summary);
            expect(report.summary.goodsWithShortage).toBe(1);
            expect(report.summary.goodsWithSurplus).toBe(1);
        });
    });

    describe("Alert history", () => {
        it("maintains alert history across analyses", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                food: { openingPrice: 30, closingPrice: 35, openingInventory: 100, productionAvailable: 50, availableSupply: 150, desiredDemand: 200, fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75, shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150 },
            }));
            analyzer.analyze(1, "colony1");

            healthMetrics.recordMarketMetrics(createMarketSnapshot(2, {
                food: { openingPrice: 30, closingPrice: 35, openingInventory: 100, productionAvailable: 50, availableSupply: 150, desiredDemand: 200, fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75, shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150 },
            }));
            analyzer.analyze(2, "colony1");

            healthMetrics.recordMarketMetrics(createMarketSnapshot(3, {
                food: { openingPrice: 30, closingPrice: 35, openingInventory: 100, productionAvailable: 50, availableSupply: 150, desiredDemand: 200, fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75, shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150 },
            }));
            const report = analyzer.analyze(3, "colony1");

            const history = analyzer.getAlertHistory();
            expect(history.length).toBeGreaterThan(0);
            expect(report.alerts.length).toBeGreaterThan(0);
        });
    });

    describe("Clear", () => {
        it("clears all tracking state", () => {
            healthMetrics.recordMarketMetrics(createMarketSnapshot(1, {
                food: { openingPrice: 30, closingPrice: 35, openingInventory: 100, productionAvailable: 50, availableSupply: 150, desiredDemand: 200, fulfilledDemand: 150, unmetDemand: 50, supplyDemandRatio: 0.75, shortageRatio: 0.25, surplusRatio: 0, imbalance: 0.25, tradedQuantity: 150 },
            }));
            analyzer.analyze(1, "colony1");
            analyzer.clear();

            const report = analyzer.analyze(2, "colony1");
            expect(report.alerts).toHaveLength(0);
            expect(analyzer.getAlertHistory()).toHaveLength(0);
        });
    });
});