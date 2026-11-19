import { IndustryTickInput } from "@game/workers/IndustryTickInput";
import type { IndustryTickResult } from "@game/workers/IndustryTickResult";
import type { IndustryTickPatch } from "@game/workers/IndustryTickPatch";
import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { IndustrialSectors } from "@game/components/Factories";
import { EconomicHealthMetrics } from "../diagnostics/economicHealthMetrics";
import { MarketStabilityAnalyzer } from "../diagnostics/marketStabilityAnalyzer";
import { IndustryHealthAnalyzer } from "../diagnostics/industryHealthAnalyzer";
import { HouseholdHealthAnalyzer } from "../diagnostics/householdHealthAnalyzer";
import { EconomicCascadeAnalyzer } from "../diagnostics/economicCascadeAnalyzer";

export interface ScenarioConfig {
    name: string;
    description: string;
    seed: number;
    tickCount: number;
    initialState: Record<string, any>;
    snapshotInterval: number;
    diagnostics: {
        health: boolean;
        market: boolean;
        industry: boolean;
        household: boolean;
        cascade: boolean;
    };
}

export interface ScenarioSnapshot {
    tick: number;
    input: IndustryTickInput;
    result: IndustryTickResult;
    diagnostics: {
        health?: ReturnType<EconomicHealthMetrics["getLatestSnapshot"]>;
        market?: ReturnType<MarketStabilityAnalyzer["analyze"]>;
        industry?: ReturnType<IndustryHealthAnalyzer["analyze"]>;
        household?: ReturnType<HouseholdHealthAnalyzer["analyze"]>;
        cascade?: ReturnType<EconomicCascadeAnalyzer["analyze"]>;
    };
}

export interface ScenarioResult {
    config: ScenarioConfig;
    snapshots: ScenarioSnapshot[];
    firstFailure: { tick: number; reason: string } | null;
    finalState: IndustryTickInput | null;
    diagnosticHistory: {
        health: ReturnType<EconomicHealthMetrics["getLatestSnapshot"]>[];
        market: ReturnType<MarketStabilityAnalyzer["analyze"]>[];
        industry: ReturnType<IndustryHealthAnalyzer["analyze"]>[];
        household: ReturnType<HouseholdHealthAnalyzer["analyze"]>[];
        cascade: ReturnType<EconomicCascadeAnalyzer["analyze"]>[];
    };
    reproducibilityHash: string;
}

export interface ScenarioFailure {
    tick: number;
    error: string;
    state: IndustryTickInput;
}

export type ScenarioRunnerCallback = (progress: { tick: number; total: number; snapshot: ScenarioSnapshot }) => void;

export class EconomicScenarioRunner {
    private simulateTick: (input: IndustryTickInput) => IndustryTickResult | null;
    private createInitialState: (config: Partial<ScenarioConfig["initialState"]>) => IndustryTickInput;
    private healthMetrics: EconomicHealthMetrics;
    private marketAnalyzer: MarketStabilityAnalyzer;
    private industryAnalyzer: IndustryHealthAnalyzer;
    private householdAnalyzer: HouseholdHealthAnalyzer;
    private cascadeAnalyzer: EconomicCascadeAnalyzer;

    constructor(
        simulateTick: (input: IndustryTickInput) => IndustryTickResult | null,
        createInitialState: (config: Partial<ScenarioConfig["initialState"]>) => IndustryTickInput
    ) {
        this.simulateTick = simulateTick;
        this.createInitialState = createInitialState;
        this.healthMetrics = new EconomicHealthMetrics({ rollingWindowTicks: 200, priceVolatilityWindow: 50 });
        this.marketAnalyzer = new MarketStabilityAnalyzer(this.healthMetrics);
        this.industryAnalyzer = new IndustryHealthAnalyzer(this.healthMetrics);
        this.householdAnalyzer = new HouseholdHealthAnalyzer(this.healthMetrics);
        this.cascadeAnalyzer = new EconomicCascadeAnalyzer(this.healthMetrics);
    }

    runScenario(config: ScenarioConfig, onProgress?: ScenarioRunnerCallback): ScenarioResult {
        // Initialize diagnostics
        if (config.diagnostics.health) this.healthMetrics.clear();
        if (config.diagnostics.market) this.marketAnalyzer.clear();
        if (config.diagnostics.industry) this.industryAnalyzer.clear();
        if (config.diagnostics.household) this.householdAnalyzer.clear();
        if (config.diagnostics.cascade) this.cascadeAnalyzer.clear();

        // Create initial state
        let input = this.createInitialState(config.initialState);
        
        // Ensure seed is set for determinism (if supported by simulation)
        if (config.seed !== undefined) {
            input = { ...input, seed: config.seed } as IndustryTickInput & { seed?: number };
        }

        const snapshots: ScenarioSnapshot[] = [];
        let firstFailure: ScenarioResult["firstFailure"] = null;
        let tick = 0;

        // Record initial snapshot (tick 0)
        const initialSnapshot = this.recordSnapshot(0, input, config);
        snapshots.push(initialSnapshot);

        for (tick = 1; tick <= config.tickCount; tick++) {
            const result = this.simulateTick(input);
            
            if (!result) {
                firstFailure = { tick, reason: "simulateTick returned null" };
                break;
            }

            // Check for invariant violations in result
            const invariantError = this.checkInvariants(result);
            if (invariantError) {
                firstFailure = { tick, reason: invariantError };
                break;
            }

            // Update input for next tick
            input = this.advanceInput(input, result);

            // Record snapshot at intervals
            if (tick % config.snapshotInterval === 0 || tick === config.tickCount) {
                const snapshot = this.recordSnapshot(tick, input, config, result);
                snapshots.push(snapshot);
                
                if (onProgress) {
                    onProgress({ tick, total: config.tickCount, snapshot });
                }
            }
        }

        const finalState = input;
        const reproducibilityHash = this.computeReproducibilityHash(snapshots);

        return {
            config,
            snapshots,
            firstFailure,
            finalState,
            diagnosticHistory: {
                health: this.healthMetrics.getMarketHistory().map(() => this.healthMetrics.getLatestSnapshot("")) as any,
                market: this.marketAnalyzer.getAlertHistory().map(() => this.marketAnalyzer.analyze(0, "")) as any,
                industry: this.industryAnalyzer.getAssessmentHistory("") as any,
                household: this.householdAnalyzer.getAssessmentHistory("") as any,
                cascade: this.cascadeAnalyzer.getActiveCascades() as any,
            },
            reproducibilityHash,
        };
    }

    private recordSnapshot(
        tick: number, 
        input: IndustryTickInput, 
        config: ScenarioConfig,
        result?: IndustryTickResult
    ): ScenarioSnapshot {
        const diagnostics: ScenarioSnapshot["diagnostics"] = {};

        if (config.diagnostics.health && result) {
            this.recordHealthMetrics(tick, input, result);
            diagnostics.health = this.healthMetrics.getLatestSnapshot(input.entityId);
        }

        if (config.diagnostics.market) {
            diagnostics.market = this.marketAnalyzer.analyze(tick, input.entityId);
        }

        if (config.diagnostics.industry) {
            diagnostics.industry = this.industryAnalyzer.analyze(tick, input.entityId);
        }

        if (config.diagnostics.household) {
            diagnostics.household = this.householdAnalyzer.analyze(tick, input.entityId);
        }

        if (config.diagnostics.cascade) {
            diagnostics.cascade = this.cascadeAnalyzer.analyze(tick, input.entityId);
        }

        return {
            tick,
            input: this.cloneInput(input),
            result: result ? this.cloneResult(result) : null as any,
            diagnostics,
        };
    }

    private recordHealthMetrics(tick: number, input: IndustryTickInput, result: IndustryTickResult): void {
        // Market metrics
        const marketSnapshot = {
            tick,
            entityId: input.entityId,
            goods: Object.fromEntries(
                Object.entries(result.accounting?.sectorInputsConsumedByGood ?? {}).map(([k]) => [
                    k, {
                        good: k as keyof Goods,
                        openingPrice: input.prices?.prices[k as keyof Goods] ?? 1,
                        closingPrice: input.prices?.prices[k as keyof Goods] ?? 1,
                        openingInventory: input.goods[k as keyof Goods] ?? 0,
                        productionAvailable: result.accounting?.sectorProductionByGood?.[k as keyof Goods] ?? 0,
                        availableSupply: (input.goods[k as keyof Goods] ?? 0) + (result.accounting?.sectorProductionByGood?.[k as keyof Goods] ?? 0),
                        desiredDemand: 0,
                        fulfilledDemand: result.accounting?.householdSalesByGood?.[k as keyof Goods] ?? 0,
                        unmetDemand: 0,
                        supplyDemandRatio: 1,
                        shortageRatio: 0,
                        surplusRatio: 0,
                        imbalance: 0,
                        tradedQuantity: result.accounting?.householdSalesByGood?.[k as keyof Goods] ?? 0,
                    }
                ])
            ),
        };
        this.healthMetrics.recordMarketMetrics(marketSnapshot);

        // Industry metrics
        const industryMetrics: Array<{
            sectorId: string;
            tick: number;
            revenue: number;
            inputCosts: number;
            laborCosts: number;
            subsidies: number;
            operatingResultPreSubsidy: number;
            operatingResultPostSubsidy: number;
            profitMarginPreSubsidy: number | null;
            profitMarginPostSubsidy: number | null;
            utilization: number;
            productionOutput: Partial<Record<keyof Goods, number>>;
            inputAvailability: Partial<Record<keyof Goods, number>>;
            laborAvailability: Partial<Record<keyof Population, number>>;
            stopReason: string | null;
            consecutiveStoppedTicks: number;
        }> = Object.entries(result.sectorResults ?? {}).map(([sectorId, sector]: [string, any]) => {
            const producedGoods = sector.producedGoods as Record<string, number> | undefined;
            return {
                sectorId,
                tick,
                revenue: producedGoods ? Object.values(producedGoods).reduce((a: number, b: number) => a + b, 0) : 0,
                inputCosts: 0,
                laborCosts: 0,
                subsidies: 0,
                operatingResultPreSubsidy: 0,
                operatingResultPostSubsidy: 0,
                profitMarginPreSubsidy: null,
                profitMarginPostSubsidy: null,
                utilization: sector.productionRatio ?? 0,
                productionOutput: producedGoods ?? {},
                inputAvailability: {},
                laborAvailability: {},
                stopReason: sector.stopReason ?? null,
                consecutiveStoppedTicks: sector.stopReason ? 1 : 0,
            };
        });
        this.healthMetrics.recordIndustryMetrics(input.entityId, industryMetrics);

        // Household metrics
        const householdMetrics = Object.entries(input.population).map(([category, pop]) => ({
            category: category as keyof Population,
            tick,
            population: pop.number,
            cashWealth: pop.wealth ?? 0,
            wageIncome: 0,
            actualSpending: 0,
            desiredConsumption: {},
            affordableConsumption: {},
            fulfilledConsumption: {},
            consumptionFulfillmentRatio: null,
            qol: pop.qol ?? 0,
            expectedQol: pop.expectedQol ?? 0,
            purchasingPower: null,
        }));
        this.healthMetrics.recordHouseholdMetrics(input.entityId, householdMetrics);

        // Employment metrics
        const employmentMetrics = {
            tick,
            entityId: input.entityId,
            byCategory: Object.fromEntries(
                Object.entries(input.population).map(([cat, pop]) => [
                    cat, { available: pop.number, employed: 0 }
                ])
            ),
            totalAvailable: Object.values(input.population).reduce((s, p) => s + p.number, 0),
            totalEmployed: 0,
            totalUnallocated: 0,
            overallUtilization: 0,
        };
        this.healthMetrics.recordEmploymentMetrics(employmentMetrics);

        // Treasury metrics
        this.healthMetrics.recordTreasuryMetrics({
            tick,
            entityId: input.entityId,
            balance: input.colonyTreasury ?? 0,
            subsidyOutflowRate: 0,
            otherOutflowRate: 0,
            inflowRate: 0,
            runway: null,
        });

        // Price snapshot
        this.healthMetrics.recordPriceSnapshot(input.entityId, input.prices?.prices ?? {}, input.prices?.prices ?? {});
    }

    private checkInvariants(result: IndustryTickResult): string | null {
        // Check for negative money
        const money = result.money as Record<string, number>;
        for (const [sector, moneyVal] of Object.entries(money)) {
            if (moneyVal < -1e-6) return `Negative sector money: ${sector}=${moneyVal}`;
        }
        if ((result.colonyTreasury ?? 0) < -1e-6) return `Negative treasury: ${result.colonyTreasury}`;

        // Check for negative population
        const population = result.population as Record<string, { number: number; wealth: number }> | undefined;
        if (population) {
            for (const [cat, pop] of Object.entries(population)) {
                if (pop.number < 0) return `Negative population: ${cat}=${pop.number}`;
                if ((pop.wealth ?? 0) < -1e-6) return `Negative wealth: ${cat}=${pop.wealth}`;
            }
        }

        // Check for negative goods
        const goods = result.goods as Record<string, number>;
        for (const [good, qty] of Object.entries(goods)) {
            if (qty < -1e-6) return `Negative goods: ${good}=${qty}`;
        }

        return null;
    }

    private advanceInput(input: IndustryTickInput, result: IndustryTickResult): IndustryTickInput {
        return {
            ...input,
            goods: result.goods,
            money: result.money,
            capitalStock: result.capitalStock,
            population: result.population ?? input.population,
            colonyTreasury: result.colonyTreasury,
            producerInventories: (result as any).producerInventories ?? input.producerInventories,
        };
    }

    private cloneInput(input: IndustryTickInput): IndustryTickInput {
        return JSON.parse(JSON.stringify(input));
    }

    private cloneResult(result: IndustryTickResult): IndustryTickResult {
        return JSON.parse(JSON.stringify(result));
    }

    private computeReproducibilityHash(snapshots: ScenarioSnapshot[]): string {
        // Simple hash of key state at each snapshot
        let hash = 0;
        for (const s of snapshots) {
            const pop = Object.values(s.input.population).reduce((a, b) => a + b.number, 0);
            const money = Object.values(s.input.money).reduce((a, b) => a + b, 0) + (s.input.colonyTreasury ?? 0);
            const goods = Object.values(s.input.goods).reduce((a, b) => a + b, 0);
            hash = ((hash << 5) - hash) + pop + money + goods;
            hash |= 0;
        }
        return hash.toString(16);
    }

    // Replay a scenario from a saved snapshot
    replayFromSnapshot(snapshot: ScenarioSnapshot, remainingTicks: number, onProgress?: ScenarioRunnerCallback): ScenarioSnapshot[] {
        const newSnapshots: ScenarioSnapshot[] = [];
        let input = this.cloneInput(snapshot.input);
        
        for (let tick = 1; tick <= remainingTicks; tick++) {
            const result = this.simulateTick(input);
            if (!result) break;
            
            input = this.advanceInput(input, result);
            
            if (tick % 10 === 0 || tick === remainingTicks) {
                const newSnapshot = this.recordSnapshot(snapshot.tick + tick, input, {
                    diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
                } as ScenarioConfig, result);
                newSnapshots.push(newSnapshot);
                
                if (onProgress) {
                    onProgress({ tick: snapshot.tick + tick, total: snapshot.tick + remainingTicks, snapshot: newSnapshot });
                }
            }
        }
        
        return newSnapshots;
    }

    // Export scenario for sharing/debugging
    exportScenario(result: ScenarioResult): string {
        return JSON.stringify({
            config: result.config,
            reproducibilityHash: result.reproducibilityHash,
            snapshots: result.snapshots.map(s => ({
                tick: s.tick,
                population: Object.fromEntries(Object.entries(s.input.population).map(([k, v]) => [k, v.number])),
                wealth: Object.fromEntries(Object.entries(s.input.population).map(([k, v]) => [k, v.wealth])),
                money: s.input.money,
                treasury: s.input.colonyTreasury,
                goods: s.input.goods,
                prices: s.input.prices?.prices,
                diagnostics: s.diagnostics,
            })),
        }, null, 2);
    }
}

// Predefined scenario configurations
export const STANDARD_SCENARIOS: Record<string, ScenarioConfig> = {
    normal: {
        name: "Normal Starting Economy",
        description: "Baseline economic behavior with all sectors active",
        seed: 42,
        tickCount: 500,
        initialState: {
            populationSize: 100_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    oilShortage: {
        name: "Oil Shortage Collapse",
        description: "Supply constraints and price response from missing oil production",
        seed: 42,
        tickCount: 200,
        initialState: {
            populationSize: 100_000,
            activeSectors: "NO_OIL",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
            initialGoodsOverrides: { oil: 5000 },
        },
        snapshotInterval: 5,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    resourceSurplus: {
        name: "Resource Surplus",
        description: "Price decreases and inventory accumulation from excess supply",
        seed: 42,
        tickCount: 200,
        initialState: {
            populationSize: 100_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
            initialGoodsOverrides: { oil: 10_000_000, metals: 10_000_000 },
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    populationGrowth: {
        name: "Population Growth",
        description: "Labor and household demand pressure from increasing population",
        seed: 42,
        tickCount: 300,
        initialState: {
            populationSize: 50_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    populationDecline: {
        name: "Population Decline",
        description: "Labor availability and household cash behavior with shrinking population",
        seed: 42,
        tickCount: 300,
        initialState: {
            populationSize: 200_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    industrialExpansion: {
        name: "Industrial Expansion",
        description: "Capital demand and production dependencies with growing industry",
        seed: 42,
        tickCount: 500,
        initialState: {
            populationSize: 100_000,
            activeSectors: "MINIMAL",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 0.5,
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    fuelDisruption: {
        name: "Fuel Disruption",
        description: "Multi-sector cascading shortages from fuel supply interruption",
        seed: 42,
        tickCount: 300,
        initialState: {
            populationSize: 100_000,
            activeSectors: "NO_OIL",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
            initialGoodsOverrides: { oil: 5000 },
        },
        snapshotInterval: 5,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    treasuryDepletion: {
        name: "Treasury Depletion",
        description: "Subsidy and financial resilience under fiscal stress",
        seed: 42,
        tickCount: 300,
        initialState: {
            populationSize: 100_000,
            activeSectors: "MINIMAL",
            starterMoneyPerSector: 100_000_000,
            capitalStockMultiplier: 1,
            initialGoodsOverrides: { oil: 1000 },
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    demandShock: {
        name: "Demand Shock",
        description: "Market adjustment under sudden demand changes",
        seed: 42,
        tickCount: 200,
        initialState: {
            populationSize: 100_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
        },
        snapshotInterval: 10,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
    longRunEquilibrium: {
        name: "Long-Run Equilibrium",
        description: "Whether the economy reaches a stable or explainable state over extended time",
        seed: 42,
        tickCount: 2000,
        initialState: {
            populationSize: 100_000,
            activeSectors: "COMPLETE",
            starterMoneyPerSector: 1_000_000_000,
            capitalStockMultiplier: 1,
        },
        snapshotInterval: 50,
        diagnostics: { health: true, market: true, industry: true, household: true, cascade: true },
    },
};

export function createScenarioRunner(
    simulateTick: (input: IndustryTickInput) => IndustryTickResult | null,
    createInitialState: (config: Partial<ScenarioConfig["initialState"]>) => IndustryTickInput
): EconomicScenarioRunner {
    return new EconomicScenarioRunner(simulateTick, createInitialState);
}