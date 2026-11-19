import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import { EconomicHealthMetrics, HouseholdCategoryMetrics } from "./economicHealthMetrics";

export interface HouseholdHealthAssessment {
    category: keyof Population;
    tick: number;
    cashWealth: number;
    wageIncome: number;
    actualSpending: number;
    desiredConsumptionValue: number;
    affordableConsumptionValue: number;
    fulfilledConsumptionValue: number;
    consumptionFulfillmentRatio: number | null;
    affordabilityRatio: number | null;
    qol: number;
    expectedQol: number;
    purchasingPower: number | null;
    wealthChange: number;
    status: "prosperous" | "stable" | "stressed" | "destitute";
    assessmentDetails: string[];
}

export interface HouseholdHealthReport {
    tick: number;
    entityId: string;
    assessments: HouseholdHealthAssessment[];
    summary: {
        prosperous: number;
        stable: number;
        stressed: number;
        destitute: number;
        totalPopulation: number;
        totalWealth: number;
        averageFulfillment: number | null;
    };
}

export interface HouseholdHealthAnalyzerConfig {
    rollingWindowTicks: number;
    prosperityWealthThreshold: number;
    stressWealthThreshold: number;
    destituteWealthThreshold: number;
    fulfillmentStressThreshold: number;
    fulfillmentDestituteThreshold: number;
}

export const DEFAULT_HOUSEHOLD_HEALTH_CONFIG: HouseholdHealthAnalyzerConfig = {
    rollingWindowTicks: 20,
    prosperityWealthThreshold: 10000,
    stressWealthThreshold: 1000,
    destituteWealthThreshold: 100,
    fulfillmentStressThreshold: 0.8,
    fulfillmentDestituteThreshold: 0.5,
};

export class HouseholdHealthAnalyzer {
    private config: HouseholdHealthAnalyzerConfig;
    private healthMetrics: EconomicHealthMetrics;
    private wealthHistory: Map<keyof Population, number[]> = new Map();
    private assessmentHistory: Map<string, HouseholdHealthAssessment[]> = new Map();

    constructor(healthMetrics: EconomicHealthMetrics, config: Partial<HouseholdHealthAnalyzerConfig> = {}) {
        this.healthMetrics = healthMetrics;
        this.config = { ...DEFAULT_HOUSEHOLD_HEALTH_CONFIG, ...config };
        this.initializeWealthHistory();
    }

    private initializeWealthHistory(): void {
        const allCategories = Object.keys({} as Population) as (keyof Population)[];
        for (const cat of allCategories) {
            this.wealthHistory.set(cat, []);
        }
    }

    analyze(tick: number, entityId: string): HouseholdHealthReport {
        const householdHistory = this.healthMetrics.getHouseholdHistory(entityId);
        const currentTickMetrics = householdHistory.filter(m => m.tick === tick);
        
        if (currentTickMetrics.length === 0) {
            return {
                tick,
                entityId,
                assessments: [],
                summary: { prosperous: 0, stable: 0, stressed: 0, destitute: 0, totalPopulation: 0, totalWealth: 0, averageFulfillment: null },
            };
        }

        const assessments: HouseholdHealthAssessment[] = [];
        let totalPopulation = 0;
        let totalWealth = 0;
        let fulfillmentSum = 0;
        let fulfillmentCount = 0;

        for (const metrics of currentTickMetrics) {
            const assessment = this.assessHousehold(metrics, tick, entityId);
            assessments.push(assessment);
            
            totalPopulation += metrics.population;
            totalWealth += metrics.cashWealth;
            if (assessment.consumptionFulfillmentRatio !== null) {
                fulfillmentSum += assessment.consumptionFulfillmentRatio;
                fulfillmentCount++;
            }
        }

        this.storeAssessments(entityId, assessments);
        this.updateWealthHistory(assessments);

        const averageFulfillment = fulfillmentCount > 0 ? fulfillmentSum / fulfillmentCount : null;
        const summary = this.computeSummary(assessments, totalPopulation, totalWealth, averageFulfillment);

        return { tick, entityId, assessments, summary };
    }

    private assessHousehold(metrics: HouseholdCategoryMetrics, tick: number, _entityId: string): HouseholdHealthAssessment {
        const details: string[] = [];
        
        // Calculate desired consumption value from desiredConsumption quantities
        // Since we don't have prices here, we estimate using the consumptionFulfillmentRatio
        // and actual spending as a proxy
        const desiredValue = metrics.actualSpending / Math.max(metrics.consumptionFulfillmentRatio ?? 0.001, 0.001);
        const affordableValue = metrics.cashWealth + metrics.wageIncome;
        const fulfilledValue = metrics.actualSpending;
        
        const consumptionFulfillmentRatio = metrics.consumptionFulfillmentRatio;
        const affordabilityRatio = desiredValue > 0 ? affordableValue / desiredValue : null;
        
        // Determine status
        let status: "prosperous" | "stable" | "stressed" | "destitute";
        
        const wealth = metrics.cashWealth;
        const fulfillment = consumptionFulfillmentRatio ?? 1;
        
        if (wealth >= this.config.prosperityWealthThreshold && fulfillment >= this.config.fulfillmentStressThreshold) {
            status = "prosperous";
            details.push(`High wealth (${wealth.toFixed(0)}) and good fulfillment (${(fulfillment * 100).toFixed(1)}%)`);
        } else if (wealth <= this.config.destituteWealthThreshold || fulfillment <= this.config.fulfillmentDestituteThreshold) {
            status = "destitute";
            details.push(`Critical: wealth=${wealth.toFixed(0)}, fulfillment=${(fulfillment * 100).toFixed(1)}%`);
        } else if (wealth <= this.config.stressWealthThreshold || fulfillment < this.config.fulfillmentStressThreshold) {
            status = "stressed";
            details.push(`Stressed: wealth=${wealth.toFixed(0)}, fulfillment=${(fulfillment * 100).toFixed(1)}%`);
        } else {
            status = "stable";
            details.push(`Stable: wealth=${wealth.toFixed(0)}, fulfillment=${(fulfillment * 100).toFixed(1)}%`);
        }

        // Add QoL context
        details.push(`QoL: ${metrics.qol.toFixed(1)} (expected: ${metrics.expectedQol.toFixed(1)})`);
        
        // Wealth trend
        const history = this.wealthHistory.get(metrics.category);
        if (history && history.length >= 2) {
            const change = wealth - history[history.length - 2];
            if (change > 0) details.push(`Wealth increasing (+${change.toFixed(1)})`);
            else if (change < 0) details.push(`Wealth decreasing (${change.toFixed(1)})`);
        }

        // Purchasing power
        if (metrics.purchasingPower !== null) {
            details.push(`Purchasing power: ${(metrics.purchasingPower * 100).toFixed(1)}% of desired basket`);
        }

        // Affordability gap
        if (affordabilityRatio !== null && affordabilityRatio < 1) {
            details.push(`Cannot afford full desired consumption (${(affordabilityRatio * 100).toFixed(1)}% affordable)`);
        }

        // Calculate wealth change
        let wealthChange = 0;
        if (history && history.length >= 2) {
            wealthChange = wealth - history[history.length - 2];
        }

        return {
            category: metrics.category,
            tick,
            cashWealth: wealth,
            wageIncome: metrics.wageIncome,
            actualSpending: metrics.actualSpending,
            desiredConsumptionValue: desiredValue,
            affordableConsumptionValue: affordableValue,
            fulfilledConsumptionValue: fulfilledValue,
            consumptionFulfillmentRatio: fulfillment,
            affordabilityRatio,
            qol: metrics.qol,
            expectedQol: metrics.expectedQol,
            purchasingPower: metrics.purchasingPower,
            wealthChange,
            status,
            assessmentDetails: details,
        };
    }

    private updateWealthHistory(assessments: HouseholdHealthAssessment[]): void {
        for (const a of assessments) {
            const history = this.wealthHistory.get(a.category);
            if (history) {
                history.push(a.cashWealth);
                if (history.length > this.config.rollingWindowTicks) {
                    history.shift();
                }
            }
        }
    }

    private storeAssessments(entityId: string, assessments: HouseholdHealthAssessment[]): void {
        if (!this.assessmentHistory.has(entityId)) {
            this.assessmentHistory.set(entityId, []);
        }
        const history = this.assessmentHistory.get(entityId)!;
        history.push(...assessments);
        if (history.length > this.config.rollingWindowTicks * 20) {
            history.splice(0, history.length - this.config.rollingWindowTicks * 20);
        }
    }

    private computeSummary(
        assessments: HouseholdHealthAssessment[],
        totalPopulation: number,
        totalWealth: number,
        averageFulfillment: number | null
    ): HouseholdHealthReport["summary"] {
        const summary = { prosperous: 0, stable: 0, stressed: 0, destitute: 0, totalPopulation, totalWealth, averageFulfillment };
        for (const a of assessments) {
            switch (a.status) {
                case "prosperous": summary.prosperous++; break;
                case "stable": summary.stable++; break;
                case "stressed": summary.stressed++; break;
                case "destitute": summary.destitute++; break;
            }
        }
        return summary;
    }

    getAssessmentHistory(entityId: string): HouseholdHealthAssessment[] {
        return [...(this.assessmentHistory.get(entityId) ?? [])];
    }

    getCategoryAssessmentHistory(entityId: string, category: keyof Population): HouseholdHealthAssessment[] {
        const history = this.assessmentHistory.get(entityId);
        if (!history) return [];
        return history.filter(a => a.category === category);
    }

    clear(): void {
        this.wealthHistory.clear();
        this.assessmentHistory.clear();
        this.initializeWealthHistory();
    }
}