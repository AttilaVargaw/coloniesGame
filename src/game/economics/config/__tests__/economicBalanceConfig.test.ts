import { describe, it, expect } from "vitest";
import {
    DEFAULT_ECONOMIC_BALANCE_CONFIG,
    createFullConfig,
    createPriceConfig,
    createProductionConfig,
    createLaborConfig,
    createHouseholdConfig,
    createCapitalConfig,
    createSubsidyConfig,
    createSectorConfig,
    createValidationConfig,
    BalancingExperiment,
    ExperimentResult,
} from "../economicBalanceConfig";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { IndustrialSectors } from "@game/components/Factories";

describe("EconomicBalanceConfig", () => {
    describe("Default config", () => {
        it("has valid price configuration", () => {
            const prices = DEFAULT_ECONOMIC_BALANCE_CONFIG.prices;
            expect(prices.sensitivity).toBe(0.15);
            expect(prices.maxIncreasePerTick).toBe(0.10);
            expect(prices.maxDecreasePerTick).toBe(0.10);
            expect(prices.minPriceMultiplier).toBe(0.1);
            expect(prices.maxPriceMultiplier).toBe(10.0);
        });

        it("has essential sectors defined", () => {
            const essential = DEFAULT_ECONOMIC_BALANCE_CONFIG.production.essentialSectors;
            expect(essential).toContain("powerPlant");
            expect(essential).toContain("waterTreatment");
            expect(essential).toContain("healthcare");
            expect(essential).toContain("education");
            expect(essential).toContain("lawEnforcement");
            expect(essential).toContain("governance");
            expect(essential).toContain("logistics");
            expect(essential).toContain("government");
        });

        it("has labor allocation config", () => {
            const labor = DEFAULT_ECONOMIC_BALANCE_CONFIG.labor;
            expect(labor.twoStageEnabled).toBe(true);
            expect(labor.essentialServiceSectors).toContain("powerPlant");
            expect(labor.essentialServiceSectors).toContain("healthcare");
        });

        it("has household wealth config", () => {
            const household = DEFAULT_ECONOMIC_BALANCE_CONFIG.household;
            expect(household.wealthDrawdownRate).toBe(0.01);
        });

        it("has capital config with uncapped ratio", () => {
            const capital = DEFAULT_ECONOMIC_BALANCE_CONFIG.capital;
            expect(capital.capitalRatioUncapped).toBe(true);
            expect(capital.wearRate).toBe(0.01);
            expect(capital.decayRate).toBe(0.001);
        });

        it("has subsidy config", () => {
            const subsidies = DEFAULT_ECONOMIC_BALANCE_CONFIG.subsidies;
            expect(subsidies.maxSubsidyRatio).toBe(1.0);
            expect(subsidies.treasuryReserveRatio).toBe(0.1);
        });

        it("has validation tolerances", () => {
            const validation = DEFAULT_ECONOMIC_BALANCE_CONFIG.validation;
            expect(validation.accountingTolerance).toBe(1e-6);
            expect(validation.maxNegativeMoney).toBe(0);
            expect(validation.maxNegativeGoods).toBe(0);
        });
    });

    describe("Config factory functions", () => {
        it("createPriceConfig merges overrides", () => {
            const config = createPriceConfig({ sensitivity: 0.2, maxIncreasePerTick: 0.15 });
            expect(config.sensitivity).toBe(0.2);
            expect(config.maxIncreasePerTick).toBe(0.15);
            expect(config.maxDecreasePerTick).toBe(0.10); // default preserved
        });

        it("createProductionConfig merges overrides", () => {
            const config = createProductionConfig({ 
                essentialSectors: ["powerPlant", "farm"] 
            });
            expect(config.essentialSectors).toEqual(["powerPlant", "farm"]);
        });

        it("createLaborConfig merges overrides", () => {
            const config = createLaborConfig({ twoStageEnabled: false });
            expect(config.twoStageEnabled).toBe(false);
            expect(config.essentialServiceSectors).toContain("powerPlant"); // default preserved
        });

        it("createHouseholdConfig merges overrides", () => {
            const config = createHouseholdConfig({ wealthDrawdownRate: 0.02 });
            expect(config.wealthDrawdownRate).toBe(0.02);
        });

        it("createCapitalConfig merges overrides", () => {
            const config = createCapitalConfig({ wearRate: 0.02, capitalRatioUncapped: false });
            expect(config.wearRate).toBe(0.02);
            expect(config.capitalRatioUncapped).toBe(false);
        });

        it("createSubsidyConfig merges overrides", () => {
            const config = createSubsidyConfig({ maxSubsidyRatio: 0.5 });
            expect(config.maxSubsidyRatio).toBe(0.5);
            expect(config.treasuryReserveRatio).toBe(0.1); // default preserved
        });

        it("createSectorConfig merges overrides", () => {
            const config = createSectorConfig({ bySector: { farm: { outputPerWorker: 5, inputRequirements: {}, capitalRequirements: {}, techMultiplier: 1 } } } as any);
            expect(config.bySector.farm?.outputPerWorker).toBe(5);
        });

        it("createValidationConfig merges overrides", () => {
            const config = createValidationConfig({ accountingTolerance: 1e-4 });
            expect(config.accountingTolerance).toBe(1e-4);
            expect(config.maxNegativeMoney).toBe(0); // default preserved
        });

        it("createFullConfig merges all sections", () => {
            const config = createFullConfig({
                prices: { sensitivity: 0.25 },
                production: { essentialSectors: ["test"], bySector: {} },
                labor: { twoStageEnabled: false, essentialServiceSectors: [], protectedSectors: [] },
                household: { wealthDrawdownRate: 0.05, qolLevels: [] },
                capital: { wearRate: 0.03, decayRate: 0.001, replenishmentPriority: 1, investmentPriority: 2, capitalRatioUncapped: true },
                subsidies: { essentialSectors: [], maxSubsidyRatio: 0.8, treasuryReserveRatio: 0.1 },
                sectors: { bySector: { test: { outputPerWorker: 10, inputRequirements: {}, capitalRequirements: {}, techMultiplier: 1 } } },
                validation: { accountingTolerance: 1e-5, maxNegativeMoney: 0, maxNegativeGoods: 0 },
            } as any);
            
            expect(config.prices.sensitivity).toBe(0.25);
            expect(config.production.essentialSectors).toEqual(["test"]);
            expect(config.labor.twoStageEnabled).toBe(false);
            expect(config.household.wealthDrawdownRate).toBe(0.05);
            expect(config.capital.wearRate).toBe(0.03);
            expect(config.subsidies.maxSubsidyRatio).toBe(0.8);
            expect(config.sectors.bySector.test?.outputPerWorker).toBe(10);
            expect(config.validation.accountingTolerance).toBe(1e-5);
        });
    });

    describe("Immutability", () => {
        it("default config is not mutated by factory functions", () => {
            createPriceConfig({ sensitivity: 0.5 } as any);
            expect(DEFAULT_ECONOMIC_BALANCE_CONFIG.prices.sensitivity).toBe(0.15);
            
            createProductionConfig({ essentialSectors: ["test"] } as any);
            expect(DEFAULT_ECONOMIC_BALANCE_CONFIG.production.essentialSectors).toContain("powerPlant");
        });

        it("createFullConfig returns new object, doesn't mutate default", () => {
            const config = createFullConfig({ prices: { sensitivity: 0.9 } } as any);
            config.prices.sensitivity = 0.99;
            
            expect(DEFAULT_ECONOMIC_BALANCE_CONFIG.prices.sensitivity).toBe(0.15);
            expect(config.prices.sensitivity).toBe(0.99);
        });
    });

    describe("Experiment types", () => {
        it("BalancingExperiment has required fields", () => {
            const experiment: BalancingExperiment = {
                name: "Test Experiment",
                description: "Test description",
                baselineConfig: DEFAULT_ECONOMIC_BALANCE_CONFIG,
                experimentalConfig: createFullConfig({
                    prices: { sensitivity: 0.2, maxIncreasePerTick: 0.1, maxDecreasePerTick: 0.1, minPriceMultiplier: 0.1, maxPriceMultiplier: 10 },
                    production: { essentialSectors: ["powerPlant"], bySector: {} },
                    labor: { twoStageEnabled: true, essentialServiceSectors: [], protectedSectors: [] },
                    household: { wealthDrawdownRate: 0.01, qolLevels: [] },
                    capital: { wearRate: 0.01, decayRate: 0.001, replenishmentPriority: 1, investmentPriority: 2, capitalRatioUncapped: true },
                    subsidies: { essentialSectors: [], maxSubsidyRatio: 1.0, treasuryReserveRatio: 0.1 },
                    sectors: { bySector: {} },
                    validation: { accountingTolerance: 1e-6, maxNegativeMoney: 0, maxNegativeGoods: 0 },
                }),
                scenarioKey: "normal",
                metricsToCompare: ["population", "wealth", "prices"],
            };
            
            expect(experiment.name).toBe("Test Experiment");
            expect(experiment.scenarioKey).toBe("normal");
        });

        it("ExperimentResult structure is valid", () => {
            const result: ExperimentResult = {
                experiment: {} as BalancingExperiment,
                baselineResult: {
                    reproducibilityHash: "abc123",
                    firstFailure: null,
                    snapshots: 50,
                    finalState: {
                        totalPopulation: 100000,
                        totalWealth: 1000000,
                        treasuryBalance: 5000000,
                        activeSectors: 20,
                        stoppedSectors: [],
                        prices: {} as Record<keyof Goods, number>,
                    },
                    diagnosticSummary: {
                        marketAlerts: 0,
                        industryHealth: {},
                        householdStatus: {},
                        activeCascades: 0,
                    },
                },
                experimentalResult: {
                    reproducibilityHash: "def456",
                    firstFailure: null,
                    snapshots: 50,
                    finalState: {
                        totalPopulation: 105000,
                        totalWealth: 1100000,
                        treasuryBalance: 5500000,
                        activeSectors: 21,
                        stoppedSectors: [],
                        prices: {} as Record<keyof Goods, number>,
                    },
                    diagnosticSummary: {
                        marketAlerts: 1,
                        industryHealth: {},
                        householdStatus: {},
                        activeCascades: 0,
                    },
                },
                comparison: {
                    hashMatch: false,
                    populationDelta: 5000,
                    wealthDelta: 100000,
                    treasuryDelta: 500000,
                    sectorDelta: 1,
                    priceChanges: {},
                    newFailures: false,
                    regressions: [],
                    improvements: ["population_growth", "wealth_increase"],
                },
                conclusion: "keep",
                notes: "Experiment improved population and wealth",
            };
            
            expect(result.conclusion).toBe("keep");
            expect(result.comparison.improvements).toContain("population_growth");
        });
    });

    describe("Configuration separation", () => {
        it("validation tolerances are separate from gameplay config", () => {
            // Validation tolerances should not be mixed with gameplay parameters
            const validation = DEFAULT_ECONOMIC_BALANCE_CONFIG.validation;
            const prices = DEFAULT_ECONOMIC_BALANCE_CONFIG.prices;
            
            expect(validation.accountingTolerance).toBeDefined();
            expect(prices.sensitivity).toBeDefined();
            // They should be in separate config sections
            expect(Object.keys(DEFAULT_ECONOMIC_BALANCE_CONFIG)).toContain("validation");
            expect(Object.keys(DEFAULT_ECONOMIC_BALANCE_CONFIG)).toContain("prices");
        });

        it("market constraints remain in price config", () => {
            const prices = DEFAULT_ECONOMIC_BALANCE_CONFIG.prices;
            expect(prices.minPriceMultiplier).toBe(0.1);
            expect(prices.maxPriceMultiplier).toBe(10.0);
            expect(prices.maxIncreasePerTick).toBe(0.10);
            expect(prices.maxDecreasePerTick).toBe(0.10);
        });
    });
});