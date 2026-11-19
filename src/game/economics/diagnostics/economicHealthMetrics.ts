import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { IndustrialSectors } from "@game/components/Factories";
import { basePrices } from "@game/data/Goods";

export interface MarketMetricsSnapshot {
    tick: number;
    entityId: string;
    goods: Partial<Record<keyof Goods, GoodMarketMetrics>>;
}

export interface GoodMarketMetrics {
    good: keyof Goods;
    openingPrice: number;
    closingPrice: number;
    openingInventory: number;
    productionAvailable: number;
    availableSupply: number;
    desiredDemand: number;
    fulfilledDemand: number;
    unmetDemand: number;
    supplyDemandRatio: number;
    shortageRatio: number | null;
    surplusRatio: number | null;
    imbalance: number;
    tradedQuantity: number;
}

export interface IndustrySectorMetrics {
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
}

export interface HouseholdCategoryMetrics {
    category: keyof Population;
    tick: number;
    population: number;
    cashWealth: number;
    wageIncome: number;
    actualSpending: number;
    desiredConsumption: Partial<Record<keyof Goods, number>>;
    affordableConsumption: Partial<Record<keyof Goods, number>>;
    fulfilledConsumption: Partial<Record<keyof Goods, number>>;
    consumptionFulfillmentRatio: number | null;
    qol: number;
    expectedQol: number;
    purchasingPower: number | null;
}

export interface EmploymentMetrics {
    tick: number;
    entityId: string;
    byCategory: Partial<Record<keyof Population, {
        available: number;
        employed: number;
        unallocated: number;
        utilization: number | null;
    }>>;
    totalAvailable: number;
    totalEmployed: number;
    totalUnallocated: number;
    overallUtilization: number | null;
}

export interface TreasuryMetrics {
    tick: number;
    entityId: string;
    balance: number;
    subsidyOutflowRate: number;
    otherOutflowRate: number;
    inflowRate: number;
    runway: number | null;
}

export interface PriceVolatilityMetrics {
    tick: number;
    entityId: string;
    byGood: Partial<Record<keyof Goods, {
        currentPrice: number;
        priceChange: number;
        priceChangePct: number;
        volatility: number | null;
        atFloor: boolean;
        atCeiling: boolean;
        basePrice: number;
    }>>;
}

export interface ProductionDependencyExposure {
    tick: number;
    entityId: string;
    bySector: Record<string, {
        totalExposure: number;
        byInput: Partial<Record<keyof Goods, number>>;
    }>;
}

export interface EconomicHealthSnapshot {
    tick: number;
    entityId: string;
    market: MarketMetricsSnapshot;
    industry: Record<string, IndustrySectorMetrics>;
    households: Record<string, HouseholdCategoryMetrics>;
    employment: EmploymentMetrics;
    treasury: TreasuryMetrics;
    prices: PriceVolatilityMetrics;
    dependencyExposure: ProductionDependencyExposure;
}

function safeDivide(numerator: number, denominator: number): number | null {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (denominator === 0) return null;
    return numerator / denominator;
}

function safeRatio(numerator: number, denominator: number): number | null {
    const result = safeDivide(numerator, denominator);
    if (result === null) return null;
    return Math.max(0, result);
}

export interface EconomicHealthMetricsConfig {
    rollingWindowTicks: number;
    priceVolatilityWindow: number;
}

export const DEFAULT_ECONOMIC_HEALTH_CONFIG: EconomicHealthMetricsConfig = {
    rollingWindowTicks: 50,
    priceVolatilityWindow: 20,
};

export class EconomicHealthMetrics {
    private config: EconomicHealthMetricsConfig;
    private marketHistory: MarketMetricsSnapshot[] = [];
    private industryHistory: Map<string, IndustrySectorMetrics[]> = new Map();
    private householdHistory: Map<string, HouseholdCategoryMetrics[]> = new Map();
    private employmentHistory: EmploymentMetrics[] = [];
    private treasuryHistory: TreasuryMetrics[] = [];
    private priceHistory: Map<string, Map<keyof Goods, number[]>> = new Map();
    private dependencyHistory: ProductionDependencyExposure[] = [];

    constructor(config: Partial<EconomicHealthMetricsConfig> = {}) {
        this.config = { ...DEFAULT_ECONOMIC_HEALTH_CONFIG, ...config };
    }

    private initializePriceHistory(entityId: string): void {
        if (!this.priceHistory.has(entityId)) {
            const goodHistory = new Map<keyof Goods, number[]>();
            const allGoods = Object.keys(basePrices) as (keyof Goods)[];
            for (const good of allGoods) {
                goodHistory.set(good, []);
            }
            this.priceHistory.set(entityId, goodHistory);
        }
    }

    recordMarketMetrics(snapshot: MarketMetricsSnapshot): void {
        this.marketHistory.push(snapshot);
        this.pruneHistory(this.marketHistory);
    }

    recordIndustryMetrics(entityId: string, metrics: IndustrySectorMetrics[]): void {
        if (!this.industryHistory.has(entityId)) {
            this.industryHistory.set(entityId, []);
        }
        const history = this.industryHistory.get(entityId)!;
        history.push(...metrics);
        this.pruneHistory(history);
    }

    recordHouseholdMetrics(entityId: string, metrics: HouseholdCategoryMetrics[]): void {
        if (!this.householdHistory.has(entityId)) {
            this.householdHistory.set(entityId, []);
        }
        const history = this.householdHistory.get(entityId)!;
        history.push(...metrics);
        this.pruneHistory(history);
    }

    recordEmploymentMetrics(metrics: EmploymentMetrics): void {
        this.employmentHistory.push(metrics);
        this.pruneHistory(this.employmentHistory);
    }

    recordTreasuryMetrics(metrics: TreasuryMetrics): void {
        this.treasuryHistory.push(metrics);
        this.pruneHistory(this.treasuryHistory);
    }

    recordPriceSnapshot(entityId: string, prices: Partial<Record<keyof Goods, number>>, basePrices: Record<keyof Goods, number>): void {
        this.initializePriceHistory(entityId);
        const entityPriceHistory = this.priceHistory.get(entityId)!;
        for (const [good, price] of Object.entries(prices) as [keyof Goods, number][]) {
            const history = entityPriceHistory.get(good);
            if (history) {
                const basePrice = basePrices[good] ?? 1;
                const floor = basePrice * 0.1;
                const ceiling = basePrice * 10.0;
                history.push(price);
                if (history.length > this.config.priceVolatilityWindow) {
                    history.shift();
                }
            }
        }
    }

    recordDependencyExposure(metrics: ProductionDependencyExposure): void {
        this.dependencyHistory.push(metrics);
        this.pruneHistory(this.dependencyHistory);
    }

    private pruneHistory<T>(arr: T[]): void {
        if (arr.length > this.config.rollingWindowTicks) {
            arr.splice(0, arr.length - this.config.rollingWindowTicks);
        }
    }

    computeMarketShortageRatio(good: keyof Goods): number | null {
        const latest = this.marketHistory[this.marketHistory.length - 1];
        if (!latest || !latest.goods[good]) return null;
        const m = latest.goods[good]!;
        return m.shortageRatio;
    }

    computeMarketSurplusRatio(good: keyof Goods): number | null {
        const latest = this.marketHistory[this.marketHistory.length - 1];
        if (!latest || !latest.goods[good]) return null;
        const m = latest.goods[good]!;
        return m.surplusRatio;
    }

    computePriceVolatility(entityId: string, good: keyof Goods): number | null {
        const entityPriceHistory = this.priceHistory.get(entityId);
        if (!entityPriceHistory) return null;
        const history = entityPriceHistory.get(good);
        if (!history || history.length < 2) return null;

        const changes: number[] = [];
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];
            if (prev > 0) {
                changes.push((curr - prev) / prev);
            }
        }
        if (changes.length === 0) return null;

        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((sum, c) => sum + (c - mean) ** 2, 0) / changes.length;
        return Math.sqrt(variance);
    }

    computeIndustryOperatingResult(sectorId: string, entityId: string): {
        preSubsidy: number | null;
        postSubsidy: number | null;
        marginPreSubsidy: number | null;
        marginPostSubsidy: number | null;
    } {
        const history = this.industryHistory.get(entityId);
        if (!history) return { preSubsidy: null, postSubsidy: null, marginPreSubsidy: null, marginPostSubsidy: null };

        const latest = history.find(m => m.sectorId === sectorId && m.tick === history[history.length - 1].tick);
        if (!latest) return { preSubsidy: null, postSubsidy: null, marginPreSubsidy: null, marginPostSubsidy: null };

        return {
            preSubsidy: latest.operatingResultPreSubsidy,
            postSubsidy: latest.operatingResultPostSubsidy,
            marginPreSubsidy: latest.profitMarginPreSubsidy,
            marginPostSubsidy: latest.profitMarginPostSubsidy,
        };
    }

    computeSectorInactivityDuration(sectorId: string, entityId: string): number {
        const history = this.industryHistory.get(entityId);
        if (!history) return 0;

        let consecutive = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const m = history[i];
            if (m.sectorId === sectorId) {
                if (m.stopReason && m.stopReason !== "") {
                    consecutive++;
                } else {
                    break;
                }
            }
        }
        return consecutive;
    }

    computeHouseholdPurchasingPower(category: keyof Population, entityId: string): number | null {
        const history = this.householdHistory.get(entityId);
        if (!history) return null;

        const latest = history.find(m => m.category === category && m.tick === history[history.length - 1].tick);
        if (!latest) return null;
        return latest.purchasingPower;
    }

    computeHouseholdConsumptionFulfillment(category: keyof Population, entityId: string): number | null {
        const history = this.householdHistory.get(entityId);
        if (!history) return null;

        const latest = history.find(m => m.category === category && m.tick === history[history.length - 1].tick);
        if (!latest) return null;
        return latest.consumptionFulfillmentRatio;
    }

    computeEmploymentUtilization(category: keyof Population): number | null {
        const latest = this.employmentHistory[this.employmentHistory.length - 1];
        if (!latest || !latest.byCategory[category]) return null;
        return latest.byCategory[category]!.utilization;
    }

    computeOverallEmploymentUtilization(): number | null {
        const latest = this.employmentHistory[this.employmentHistory.length - 1];
        if (!latest) return null;
        return latest.overallUtilization;
    }

    computeTreasuryRunway(): number | null {
        const latest = this.treasuryHistory[this.treasuryHistory.length - 1];
        if (!latest) return null;
        return latest.runway;
    }

    computeProductionDependencyExposure(sectorId: string): number | null {
        const latest = this.dependencyHistory[this.dependencyHistory.length - 1];
        if (!latest || !latest.bySector[sectorId]) return null;
        return latest.bySector[sectorId].totalExposure;
    }

    getMarketHistory(): MarketMetricsSnapshot[] {
        return [...this.marketHistory];
    }

    getIndustryHistory(entityId: string): IndustrySectorMetrics[] {
        return [...(this.industryHistory.get(entityId) ?? [])];
    }

    getHouseholdHistory(entityId: string): HouseholdCategoryMetrics[] {
        return [...(this.householdHistory.get(entityId) ?? [])];
    }

    getEmploymentHistory(): EmploymentMetrics[] {
        return [...this.employmentHistory];
    }

    getTreasuryHistory(): TreasuryMetrics[] {
        return [...this.treasuryHistory];
    }

    getDependencyHistory(): ProductionDependencyExposure[] {
        return [...this.dependencyHistory];
    }

    getLatestSnapshot(entityId: string): EconomicHealthSnapshot | null {
        const market = this.marketHistory[this.marketHistory.length - 1];
        const industry = this.industryHistory.get(entityId);
        const households = this.householdHistory.get(entityId);
        const employment = this.employmentHistory[this.employmentHistory.length - 1];
        const treasury = this.treasuryHistory[this.treasuryHistory.length - 1];
        const dependency = this.dependencyHistory[this.dependencyHistory.length - 1];

        if (!market || !industry || !households || !employment || !treasury || !dependency) {
            return null;
        }

        return {
            tick: market.tick,
            entityId,
            market,
            industry: Object.fromEntries(industry.map(m => [m.sectorId, m])),
            households: Object.fromEntries(households.map(m => [m.category, m])),
            employment,
            treasury,
            prices: this.computePriceVolatilitySnapshot(entityId),
            dependencyExposure: dependency,
        };
    }

    private computePriceVolatilitySnapshot(entityId: string): PriceVolatilityMetrics {
        const byGood: PriceVolatilityMetrics["byGood"] = {};
        const latestMarket = this.marketHistory[this.marketHistory.length - 1];
        const entityPriceHistory = this.priceHistory.get(entityId);

        if (!entityPriceHistory) {
            return {
                tick: latestMarket?.tick ?? 0,
                entityId: latestMarket?.entityId ?? "",
                byGood: {},
            };
        }

        for (const [good, history] of entityPriceHistory) {
            if (history.length === 0) continue;
            const currentPrice = history[history.length - 1];
            const basePrice = latestMarket?.goods[good]?.openingPrice ?? 1;
            const floor = basePrice * 0.1;
            const ceiling = basePrice * 10.0;

            let priceChange = 0;
            let priceChangePct = 0;
            if (history.length >= 2) {
                priceChange = currentPrice - history[history.length - 2];
                if (history[history.length - 2] > 0) {
                    priceChangePct = priceChange / history[history.length - 2];
                }
            }

            byGood[good] = {
                currentPrice,
                priceChange,
                priceChangePct,
                volatility: this.computePriceVolatility(entityId, good),
                atFloor: Math.abs(currentPrice - floor) < 1e-6,
                atCeiling: Math.abs(currentPrice - ceiling) < 1e-6,
                basePrice,
            };
        }

        return {
            tick: latestMarket?.tick ?? 0,
            entityId: latestMarket?.entityId ?? "",
            byGood,
        };
    }

    clear(): void {
        this.marketHistory = [];
        this.industryHistory.clear();
        this.householdHistory.clear();
        this.employmentHistory = [];
        this.treasuryHistory = [];
        this.dependencyHistory = [];
        this.priceHistory.clear();
    }
}

export function createIndustrySectorMetrics(
    sectorId: string,
    tick: number,
    revenue: number,
    inputCosts: number,
    laborCosts: number,
    subsidies: number,
    utilization: number,
    productionOutput: Partial<Record<keyof Goods, number>>,
    inputAvailability: Partial<Record<keyof Goods, number>>,
    laborAvailability: Partial<Record<keyof Population, number>>,
    stopReason: string | null,
    consecutiveStoppedTicks: number
): IndustrySectorMetrics {
    const operatingResultPreSubsidy = revenue - inputCosts - laborCosts;
    const operatingResultPostSubsidy = operatingResultPreSubsidy + subsidies;

    return {
        sectorId,
        tick,
        revenue,
        inputCosts,
        laborCosts,
        subsidies,
        operatingResultPreSubsidy,
        operatingResultPostSubsidy,
        profitMarginPreSubsidy: revenue > 0 ? safeDivide(operatingResultPreSubsidy, revenue) : null,
        profitMarginPostSubsidy: revenue > 0 ? safeDivide(operatingResultPostSubsidy, revenue) : null,
        utilization,
        productionOutput,
        inputAvailability,
        laborAvailability,
        stopReason,
        consecutiveStoppedTicks,
    };
}

export function createHouseholdCategoryMetrics(
    category: keyof Population,
    tick: number,
    population: number,
    cashWealth: number,
    wageIncome: number,
    actualSpending: number,
    desiredConsumption: Partial<Record<keyof Goods, number>>,
    fulfilledConsumption: Partial<Record<keyof Goods, number>>,
    prices: Record<keyof Goods, number>,
    qol: number,
    expectedQol: number
): HouseholdCategoryMetrics {
    const affordableConsumption: Partial<Record<keyof Goods, number>> = {};
    const budget = cashWealth + wageIncome;
    let totalDesiredValue = 0;
    let totalFulfilledValue = 0;
    let totalAffordableValue = 0;

    for (const [good, desired] of Object.entries(desiredConsumption)) {
        const key = good as keyof Goods;
        const price = prices[key] ?? 0;
        totalDesiredValue += desired * price;

        const affordable = budget > 0 ? Math.min(desired, budget / Math.max(price, 1)) : 0;
        affordableConsumption[key] = affordable;
        totalAffordableValue += affordable * price;

        const fulfilled = fulfilledConsumption[key] ?? 0;
        totalFulfilledValue += fulfilled * price;
    }

    const consumptionFulfillmentRatio = totalDesiredValue > 0 ? totalFulfilledValue / totalDesiredValue : null;
    const purchasingPower = totalDesiredValue > 0 ? budget / totalDesiredValue : null;

    return {
        category,
        tick,
        population,
        cashWealth,
        wageIncome,
        actualSpending,
        desiredConsumption,
        affordableConsumption,
        fulfilledConsumption,
        consumptionFulfillmentRatio,
        qol,
        expectedQol,
        purchasingPower,
    };
}

export function createEmploymentMetrics(
    tick: number,
    entityId: string,
    byCategory: Partial<Record<keyof Population, { available: number; employed: number }>>
): EmploymentMetrics {
    const result: EmploymentMetrics = {
        tick,
        entityId,
        byCategory: {},
        totalAvailable: 0,
        totalEmployed: 0,
        totalUnallocated: 0,
        overallUtilization: null,
    };

    for (const [category, data] of Object.entries(byCategory) as [keyof Population, { available: number; employed: number }][]) {
        const available = data.available;
        const employed = data.employed;
        const unallocated = Math.max(0, available - employed);
        const utilization = available > 0 ? safeDivide(employed, available) : null;

        result.byCategory[category] = { available, employed, unallocated, utilization };
        result.totalAvailable += available;
        result.totalEmployed += employed;
        result.totalUnallocated += unallocated;
    }

    result.overallUtilization = result.totalAvailable > 0
        ? safeDivide(result.totalEmployed, result.totalAvailable)
        : null;

    return result;
}

export function createTreasuryMetrics(
    tick: number,
    entityId: string,
    balance: number,
    subsidyOutflowRate: number,
    otherOutflowRate: number,
    inflowRate: number
): TreasuryMetrics {
    const totalOutflow = subsidyOutflowRate + otherOutflowRate;
    const runway = totalOutflow > 0 && balance > 0 ? balance / totalOutflow : null;

    return {
        tick,
        entityId,
        balance,
        subsidyOutflowRate,
        otherOutflowRate,
        inflowRate,
        runway,
    };
}

export function createProductionDependencyExposure(
    tick: number,
    entityId: string,
    sectorDependencies: Record<string, Partial<Record<keyof Goods, { requirement: number; shortageRatio: number | null }>>>
): ProductionDependencyExposure {
    const bySector: ProductionDependencyExposure["bySector"] = {};

    for (const [sectorId, deps] of Object.entries(sectorDependencies)) {
        let totalExposure = 0;
        const byInput: Partial<Record<keyof Goods, number>> = {};

        for (const [good, dep] of Object.entries(deps) as [keyof Goods, { requirement: number; shortageRatio: number | null }][]) {
            const exposure = dep.shortageRatio !== null ? dep.requirement * dep.shortageRatio : 0;
            byInput[good] = exposure;
            totalExposure += exposure;
        }

        bySector[sectorId] = { totalExposure, byInput };
    }

    return { tick, entityId, bySector };
}