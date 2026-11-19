import { Goods } from "@game/data/Goods";
import { EconomicHealthMetrics, MarketMetricsSnapshot } from "./economicHealthMetrics";
import { basePrices } from "@game/data/Goods";

export interface MarketStabilityAlert {
    good: keyof Goods;
    type: "persistent_shortage" | "persistent_surplus" | "repeated_price_increase" | "repeated_price_decrease" | "price_oscillation" | "at_price_floor" | "at_price_ceiling" | "unmet_demand_persistent" | "no_demand_with_inventory";
    severity: "info" | "warning" | "critical";
    firstDetectedTick: number;
    consecutiveTicks: number;
    description: string;
    evidence: Record<string, unknown>;
}

export interface MarketStabilityReport {
    tick: number;
    entityId: string;
    alerts: MarketStabilityAlert[];
    summary: {
        goodsWithShortage: number;
        goodsWithSurplus: number;
        goodsAtFloor: number;
        goodsAtCeiling: number;
        goodsWithOscillation: number;
    };
}

export interface MarketStabilityAnalyzerConfig {
    shortagePersistenceThreshold: number;
    surplusPersistenceThreshold: number;
    priceTrendWindow: number;
    oscillationDetectionWindow: number;
    minOscillationAmplitude: number;
    unmetDemandPersistenceThreshold: number;
}

export const DEFAULT_MARKET_STABILITY_CONFIG: MarketStabilityAnalyzerConfig = {
    shortagePersistenceThreshold: 10,
    surplusPersistenceThreshold: 20,
    priceTrendWindow: 10,
    oscillationDetectionWindow: 20,
    minOscillationAmplitude: 0.05,
    unmetDemandPersistenceThreshold: 10,
};

export class MarketStabilityAnalyzer {
    private config: MarketStabilityAnalyzerConfig;
    private healthMetrics: EconomicHealthMetrics;
    private shortageTracking: Map<keyof Goods, { firstTick: number; consecutive: number }> = new Map();
    private surplusTracking: Map<keyof Goods, { firstTick: number; consecutive: number }> = new Map();
    private priceHistory: Map<keyof Goods, number[]> = new Map();
    private unmetDemandTracking: Map<keyof Goods, { firstTick: number; consecutive: number }> = new Map();
    private alertHistory: MarketStabilityAlert[] = [];
    private lastReportTick = -1;

    constructor(healthMetrics: EconomicHealthMetrics, config: Partial<MarketStabilityAnalyzerConfig> = {}) {
        this.healthMetrics = healthMetrics;
        this.config = { ...DEFAULT_MARKET_STABILITY_CONFIG, ...config };
        this.initializePriceHistory();
    }

    private initializePriceHistory(): void {
        const allGoods = Object.keys(basePrices) as (keyof Goods)[];
        for (const good of allGoods) {
            this.priceHistory.set(good, []);
        }
    }

    analyze(tick: number, entityId: string): MarketStabilityReport {
        const marketHistory = this.healthMetrics.getMarketHistory();
        const latestMarket = marketHistory.find(m => m.tick === tick && m.entityId === entityId);
        
        if (!latestMarket) {
            return {
                tick,
                entityId,
                alerts: [],
                summary: {
                    goodsWithShortage: 0,
                    goodsWithSurplus: 0,
                    goodsAtFloor: 0,
                    goodsAtCeiling: 0,
                    goodsWithOscillation: 0,
                },
            };
        }

        const alerts: MarketStabilityAlert[] = [];

        for (const [good, metrics] of Object.entries(latestMarket.goods)) {
            const goodKey = good as keyof Goods;
            this.updatePriceHistory(goodKey, metrics.closingPrice);
            
            alerts.push(...this.checkShortage(goodKey, metrics, tick));
            alerts.push(...this.checkSurplus(goodKey, metrics, tick));
            alerts.push(...this.checkPriceTrends(goodKey, tick));
            alerts.push(...this.checkOscillation(goodKey, tick));
            alerts.push(...this.checkPriceBounds(goodKey, metrics, tick));
            alerts.push(...this.checkUnmetDemand(goodKey, metrics, tick));
            alerts.push(...this.checkNoDemandWithInventory(goodKey, metrics, tick));
        }

        this.alertHistory.push(...alerts);
        this.lastReportTick = tick;

        const summary = this.computeSummary(alerts);

        return { tick, entityId, alerts, summary };
    }

    private updatePriceHistory(good: keyof Goods, price: number): void {
        const history = this.priceHistory.get(good);
        if (history) {
            history.push(price);
            if (history.length > this.config.oscillationDetectionWindow) {
                history.shift();
            }
        }
    }

    private checkShortage(good: keyof Goods, metrics: any, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];
        const shortageRatio = metrics.shortageRatio;

        if (shortageRatio !== null && shortageRatio > 0.1) {
            const tracking = this.shortageTracking.get(good) ?? { firstTick: tick, consecutive: 0 };
            tracking.consecutive++;
            if (tracking.firstTick === undefined) tracking.firstTick = tick;
            this.shortageTracking.set(good, tracking);

            if (tracking.consecutive >= this.config.shortagePersistenceThreshold) {
                alerts.push({
                    good,
                    type: "persistent_shortage",
                    severity: shortageRatio > 0.5 ? "critical" : "warning",
                    firstDetectedTick: tracking.firstTick,
                    consecutiveTicks: tracking.consecutive,
                    description: `${good} has experienced a shortage for ${tracking.consecutive} consecutive ticks. Shortage ratio: ${(shortageRatio * 100).toFixed(1)}%.`,
                    evidence: { shortageRatio, threshold: this.config.shortagePersistenceThreshold },
                });
            }
        } else {
            this.shortageTracking.delete(good);
        }

        return alerts;
    }

    private checkSurplus(good: keyof Goods, metrics: any, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];
        const surplusRatio = metrics.surplusRatio;

        if (surplusRatio !== null && surplusRatio > 0.3) {
            const tracking = this.surplusTracking.get(good) ?? { firstTick: tick, consecutive: 0 };
            tracking.consecutive++;
            if (tracking.firstTick === undefined) tracking.firstTick = tick;
            this.surplusTracking.set(good, tracking);

            if (tracking.consecutive >= this.config.surplusPersistenceThreshold) {
                alerts.push({
                    good,
                    type: "persistent_surplus",
                    severity: "warning",
                    firstDetectedTick: tracking.firstTick,
                    consecutiveTicks: tracking.consecutive,
                    description: `${good} has persistent excess supply for ${tracking.consecutive} consecutive ticks. Surplus ratio: ${(surplusRatio * 100).toFixed(1)}%.`,
                    evidence: { surplusRatio, threshold: this.config.surplusPersistenceThreshold },
                });
            }
        } else {
            this.surplusTracking.delete(good);
        }

        return alerts;
    }

    private checkPriceTrends(good: keyof Goods, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];
        const history = this.priceHistory.get(good);
        if (!history || history.length < this.config.priceTrendWindow) return alerts;

        const recent = history.slice(-this.config.priceTrendWindow);
        let increases = 0;
        let decreases = 0;

        for (let i = 1; i < recent.length; i++) {
            if (recent[i] > recent[i - 1]) increases++;
            else if (recent[i] < recent[i - 1]) decreases++;
        }

        const increaseRatio = increases / (recent.length - 1);
        const decreaseRatio = decreases / (recent.length - 1);

        if (increaseRatio >= 0.8) {
            alerts.push({
                good,
                type: "repeated_price_increase",
                severity: "warning",
                firstDetectedTick: tick - this.config.priceTrendWindow,
                consecutiveTicks: this.config.priceTrendWindow,
                description: `${good} price has increased in ${Math.round(increaseRatio * 100)}% of last ${this.config.priceTrendWindow} ticks.`,
                evidence: { increaseRatio, window: this.config.priceTrendWindow },
            });
        }

        if (decreaseRatio >= 0.8) {
            alerts.push({
                good,
                type: "repeated_price_decrease",
                severity: "warning",
                firstDetectedTick: tick - this.config.priceTrendWindow,
                consecutiveTicks: this.config.priceTrendWindow,
                description: `${good} price has decreased in ${Math.round(decreaseRatio * 100)}% of last ${this.config.priceTrendWindow} ticks.`,
                evidence: { decreaseRatio, window: this.config.priceTrendWindow },
            });
        }

        return alerts;
    }

    private checkOscillation(good: keyof Goods, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];
        const history = this.priceHistory.get(good);
        if (!history || history.length < this.config.oscillationDetectionWindow) return alerts;

        const recent = history.slice(-this.config.oscillationDetectionWindow);
        let directionChanges = 0;
        let lastDirection = 0;

        for (let i = 1; i < recent.length; i++) {
            const change = recent[i] - recent[i - 1];
            const direction = change > 0 ? 1 : change < 0 ? -1 : 0;
            if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
                directionChanges++;
            }
            if (direction !== 0) lastDirection = direction;
        }

        const amplitude = Math.max(...recent) - Math.min(...recent);
        const avgPrice = recent.reduce((a, b) => a + b, 0) / recent.length;
        const relativeAmplitude = avgPrice > 0 ? amplitude / avgPrice : 0;

        if (directionChanges >= 5 && relativeAmplitude >= this.config.minOscillationAmplitude) {
            alerts.push({
                good,
                type: "price_oscillation",
                severity: "warning",
                firstDetectedTick: tick - this.config.oscillationDetectionWindow,
                consecutiveTicks: this.config.oscillationDetectionWindow,
                description: `${good} price is oscillating with ${directionChanges} direction changes and ${(relativeAmplitude * 100).toFixed(1)}% amplitude over ${this.config.oscillationDetectionWindow} ticks.`,
                evidence: { directionChanges, relativeAmplitude, window: this.config.oscillationDetectionWindow },
            });
        }

        return alerts;
    }

    private checkPriceBounds(good: keyof Goods, metrics: any, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];

        if (metrics.atFloor) {
            alerts.push({
                good,
                type: "at_price_floor",
                severity: "info",
                firstDetectedTick: tick,
                consecutiveTicks: 1,
                description: `${good} price has reached the permitted floor (${(metrics.basePrice * 0.1).toFixed(2)}). This may indicate genuine oversupply or a price limit constraint.`,
                evidence: { currentPrice: metrics.currentPrice, floor: metrics.basePrice * 0.1, basePrice: metrics.basePrice },
            });
        }

        if (metrics.atCeiling) {
            alerts.push({
                good,
                type: "at_price_ceiling",
                severity: "warning",
                firstDetectedTick: tick,
                consecutiveTicks: 1,
                description: `${good} price has reached the permitted ceiling (${(metrics.basePrice * 10).toFixed(2)}). This signals genuine scarcity or a price limit constraint requiring investigation.`,
                evidence: { currentPrice: metrics.currentPrice, ceiling: metrics.basePrice * 10, basePrice: metrics.basePrice },
            });
        }

        return alerts;
    }

    private checkUnmetDemand(good: keyof Goods, metrics: any, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];

        if (metrics.unmetDemand > 0 && metrics.desiredDemand > 0) {
            const tracking = this.unmetDemandTracking.get(good) ?? { firstTick: tick, consecutive: 0 };
            tracking.consecutive++;
            if (tracking.firstTick === undefined) tracking.firstTick = tick;
            this.unmetDemandTracking.set(good, tracking);

            if (tracking.consecutive >= this.config.unmetDemandPersistenceThreshold) {
                alerts.push({
                    good,
                    type: "unmet_demand_persistent",
                    severity: "warning",
                    firstDetectedTick: tracking.firstTick,
                    consecutiveTicks: tracking.consecutive,
                    description: `${good} has had unmet demand (${metrics.unmetDemand.toFixed(1)} units) for ${tracking.consecutive} consecutive ticks. Desired: ${metrics.desiredDemand.toFixed(1)}, Fulfilled: ${metrics.fulfilledDemand.toFixed(1)}.`,
                    evidence: { unmetDemand: metrics.unmetDemand, desiredDemand: metrics.desiredDemand, fulfilledDemand: metrics.fulfilledDemand, threshold: this.config.unmetDemandPersistenceThreshold },
                });
            }
        } else {
            this.unmetDemandTracking.delete(good);
        }

        return alerts;
    }

    private checkNoDemandWithInventory(good: keyof Goods, metrics: any, tick: number): MarketStabilityAlert[] {
        const alerts: MarketStabilityAlert[] = [];

        if (metrics.desiredDemand === 0 && metrics.openingInventory > 0) {
            alerts.push({
                good,
                type: "no_demand_with_inventory",
                severity: "info",
                firstDetectedTick: tick,
                consecutiveTicks: 1,
                description: `${good} has ${metrics.openingInventory.toFixed(1)} units in inventory but zero demand. Consider production adjustment.`,
                evidence: { openingInventory: metrics.openingInventory, desiredDemand: metrics.desiredDemand },
            });
        }

        return alerts;
    }

    private computeSummary(alerts: MarketStabilityAlert[]): MarketStabilityReport["summary"] {
        let goodsWithShortage = 0;
        let goodsWithSurplus = 0;
        let goodsAtFloor = 0;
        let goodsAtCeiling = 0;
        let goodsWithOscillation = 0;

        const seenGoods = new Set<keyof Goods>();

        for (const alert of alerts) {
            if (!seenGoods.has(alert.good)) {
                seenGoods.add(alert.good);
                switch (alert.type) {
                    case "persistent_shortage": goodsWithShortage++; break;
                    case "persistent_surplus": goodsWithSurplus++; break;
                    case "at_price_floor": goodsAtFloor++; break;
                    case "at_price_ceiling": goodsAtCeiling++; break;
                    case "price_oscillation": goodsWithOscillation++; break;
                }
            }
        }

        return { goodsWithShortage, goodsWithSurplus, goodsAtFloor, goodsAtCeiling, goodsWithOscillation };
    }

    getAlertHistory(): MarketStabilityAlert[] {
        return [...this.alertHistory];
    }

    clear(): void {
        this.shortageTracking.clear();
        this.surplusTracking.clear();
        this.priceHistory.clear();
        this.unmetDemandTracking.clear();
        this.alertHistory = [];
        this.lastReportTick = -1;
        this.initializePriceHistory();
    }
}