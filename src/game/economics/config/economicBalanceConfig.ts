import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { IndustrialSectors } from "@game/components/Factories";

export interface PriceAdjustmentConfig {
    sensitivity: number;
    maxIncreasePerTick: number;
    maxDecreasePerTick: number;
    minPriceMultiplier: number;
    maxPriceMultiplier: number;
}

export interface ProductionPriorityConfig {
    bySector: Partial<Record<string, number>>;
    essentialSectors: string[];
}

export interface LaborAllocationConfig {
    essentialServiceSectors: string[];
    protectedSectors: string[];
    twoStageEnabled: boolean;
}

export interface HouseholdWealthConfig {
    wealthDrawdownRate: number;
    qolLevels: Array<{
        level: number;
        minBudget: number;
        goods: Partial<Record<keyof Goods, number>>;
    }>;
}

export interface CapitalInvestmentConfig {
    wearRate: number;
    decayRate: number;
    replenishmentPriority: number;
    investmentPriority: number;
    capitalRatioUncapped: boolean;
}

export interface SubsidyConfig {
    essentialSectors: string[];
    maxSubsidyRatio: number;
    treasuryReserveRatio: number;
}

export interface SectorProductionConfig {
    bySector: Partial<Record<string, {
        outputPerWorker: number;
        inputRequirements: Partial<Record<keyof Goods, number>>;
        capitalRequirements: Partial<Record<keyof Goods, number>>;
        techMultiplier: number;
    }>>;
}

export interface EconomicBalanceConfig {
    prices: PriceAdjustmentConfig;
    production: ProductionPriorityConfig;
    labor: LaborAllocationConfig;
    household: HouseholdWealthConfig;
    capital: CapitalInvestmentConfig;
    subsidies: SubsidyConfig;
    sectors: SectorProductionConfig;
    validation: {
        accountingTolerance: number;
        maxNegativeMoney: number;
        maxNegativeGoods: number;
    };
}

export const DEFAULT_ECONOMIC_BALANCE_CONFIG: EconomicBalanceConfig = {
    prices: {
        sensitivity: 0.15,
        maxIncreasePerTick: 0.10,
        maxDecreasePerTick: 0.10,
        minPriceMultiplier: 0.1,
        maxPriceMultiplier: 10.0,
    },
    production: {
        bySector: {},
        essentialSectors: [
            "powerPlant",
            "waterTreatment",
            "healthcare",
            "education",
            "lawEnforcement",
            "logistics",
            "government",
        ],
    },
    labor: {
        essentialServiceSectors: [
            "powerPlant",
            "waterTreatment",
            "healthcare",
            "education",
            "lawEnforcement",
            "logistics",
        ],
        protectedSectors: [],
        twoStageEnabled: true,
    },
    household: {
        wealthDrawdownRate: 0.01,
        qolLevels: [],
    },
    capital: {
        wearRate: 0.01,
        decayRate: 0.001,
        replenishmentPriority: 1,
        investmentPriority: 2,
        capitalRatioUncapped: true,
    },
    subsidies: {
        essentialSectors: [
            "powerPlant",
            "waterTreatment",
            "healthcare",
            "education",
            "lawEnforcement",
            "logistics",
            "government",
        ],
        maxSubsidyRatio: 1.0,
        treasuryReserveRatio: 0.1,
    },
    sectors: {
        bySector: {},
    },
    validation: {
        accountingTolerance: 1e-6,
        maxNegativeMoney: 0,
        maxNegativeGoods: 0,
    },
};

export function createPriceConfig(overrides: Partial<PriceAdjustmentConfig> = {}): PriceAdjustmentConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.prices, ...overrides };
}

export function createProductionConfig(overrides: Partial<ProductionPriorityConfig> = {}): ProductionPriorityConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.production, ...overrides };
}

export function createLaborConfig(overrides: Partial<LaborAllocationConfig> = {}): LaborAllocationConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.labor, ...overrides };
}

export function createHouseholdConfig(overrides: Partial<HouseholdWealthConfig> = {}): HouseholdWealthConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.household, ...overrides };
}

export function createCapitalConfig(overrides: Partial<CapitalInvestmentConfig> = {}): CapitalInvestmentConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.capital, ...overrides };
}

export function createSubsidyConfig(overrides: Partial<SubsidyConfig> = {}): SubsidyConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.subsidies, ...overrides };
}

export function createSectorConfig(overrides: Partial<SectorProductionConfig> = {}): SectorProductionConfig {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.sectors, ...overrides };
}

export function createValidationConfig(overrides: Partial<EconomicBalanceConfig["validation"]> = {}): EconomicBalanceConfig["validation"] {
    return { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.validation, ...overrides };
}

export function createFullConfig(overrides: Partial<EconomicBalanceConfig> = {}): EconomicBalanceConfig {
    return {
        prices: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.prices, ...overrides.prices },
        production: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.production, ...overrides.production },
        labor: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.labor, ...overrides.labor },
        household: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.household, ...overrides.household },
        capital: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.capital, ...overrides.capital },
        subsidies: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.subsidies, ...overrides.subsidies },
        sectors: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.sectors, ...overrides.sectors },
        validation: { ...DEFAULT_ECONOMIC_BALANCE_CONFIG.validation, ...overrides.validation },
    };
}

export interface BalancingExperiment {
    name: string;
    description: string;
    baselineConfig: EconomicBalanceConfig;
    experimentalConfig: EconomicBalanceConfig;
    scenarioKey: string;
    metricsToCompare: string[];
}

export interface ExperimentResult {
    experiment: BalancingExperiment;
    baselineResult: {
        reproducibilityHash: string;
        firstFailure: { tick: number; reason: string } | null;
        snapshots: number;
        finalState: {
            totalPopulation: number;
            totalWealth: number;
            treasuryBalance: number;
            activeSectors: number;
            stoppedSectors: string[];
            prices: Record<keyof Goods, number>;
        };
        diagnosticSummary: {
            marketAlerts: number;
            industryHealth: Record<string, number>;
            householdStatus: Record<string, number>;
            activeCascades: number;
        };
    };
    experimentalResult: {
        reproducibilityHash: string;
        firstFailure: { tick: number; reason: string } | null;
        snapshots: number;
        finalState: {
            totalPopulation: number;
            totalWealth: number;
            treasuryBalance: number;
            activeSectors: number;
            stoppedSectors: string[];
            prices: Record<keyof Goods, number>;
        };
        diagnosticSummary: {
            marketAlerts: number;
            industryHealth: Record<string, number>;
            householdStatus: Record<string, number>;
            activeCascades: number;
        };
    };
    comparison: {
        hashMatch: boolean;
        populationDelta: number;
        wealthDelta: number;
        treasuryDelta: number;
        sectorDelta: number;
        priceChanges: Partial<Record<keyof Goods, number>>;
        newFailures: boolean;
        regressions: string[];
        improvements: string[];
    };
    conclusion: "keep" | "reject" | "investigate";
    notes: string;
}

export function runBalancingExperiment(
    experiment: BalancingExperiment,
    runScenario: (config: any) => any,
    extractMetrics: (result: any) => any
): ExperimentResult {
    const baselineResult = runScenario(experiment.baselineConfig);
    const experimentalResult = runScenario(experiment.experimentalConfig);

    return {
        experiment,
        baselineResult: extractMetrics(baselineResult),
        experimentalResult: extractMetrics(experimentalResult),
        comparison: {
            hashMatch: baselineResult.reproducibilityHash === experimentalResult.reproducibilityHash,
            populationDelta: 0,
            wealthDelta: 0,
            treasuryDelta: 0,
            sectorDelta: 0,
            priceChanges: {},
            newFailures: false,
            regressions: [],
            improvements: [],
        },
        conclusion: "investigate",
        notes: "",
    };
}