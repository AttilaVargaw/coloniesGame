import { Goods } from "@game/data/Goods";
import { Population } from "@game/data/Population";
import type { IndustrialSectors } from "@game/components/Factories";
import { EconomicHealthMetrics, IndustrySectorMetrics } from "./economicHealthMetrics";

export type IndustryHealthStatus = "healthy" | "under_pressure" | "unprofitable" | "resource_constrained" | "inactive";

export interface IndustryHealthAssessment {
    sectorId: string;
    tick: number;
    status: IndustryHealthStatus;
    operatingResultPreSubsidy: number;
    operatingResultPostSubsidy: number;
    profitMarginPreSubsidy: number | null;
    profitMarginPostSubsidy: number | null;
    utilization: number;
    consecutiveStoppedTicks: number;
    inputAvailabilityScore: number;
    laborAvailabilityScore: number;
    restartCount: number;
    assessmentDetails: string[];
}

export interface IndustryHealthReport {
    tick: number;
    entityId: string;
    assessments: IndustryHealthAssessment[];
    summary: {
        healthy: number;
        underPressure: number;
        unprofitable: number;
        resourceConstrained: number;
        inactive: number;
    };
}

export interface IndustryHealthAnalyzerConfig {
    rollingWindowTicks: number;
    unprofitableThreshold: number;
    lowUtilizationThreshold: number;
    lowInputAvailabilityThreshold: number;
    lowLaborAvailabilityThreshold: number;
    inactiveThresholdTicks: number;
}

export const DEFAULT_INDUSTRY_HEALTH_CONFIG: IndustryHealthAnalyzerConfig = {
    rollingWindowTicks: 20,
    unprofitableThreshold: -0.05,
    lowUtilizationThreshold: 0.3,
    lowInputAvailabilityThreshold: 0.5,
    lowLaborAvailabilityThreshold: 0.5,
    inactiveThresholdTicks: 10,
};

export class IndustryHealthAnalyzer {
    private config: IndustryHealthAnalyzerConfig;
    private healthMetrics: EconomicHealthMetrics;
    private restartTracking: Map<string, { lastStopTick: number; restartCount: number }> = new Map();
    private assessmentHistory: Map<string, IndustryHealthAssessment[]> = new Map();

    constructor(healthMetrics: EconomicHealthMetrics, config: Partial<IndustryHealthAnalyzerConfig> = {}) {
        this.healthMetrics = healthMetrics;
        this.config = { ...DEFAULT_INDUSTRY_HEALTH_CONFIG, ...config };
    }

    analyze(tick: number, entityId: string): IndustryHealthReport {
        const industryHistory = this.healthMetrics.getIndustryHistory(entityId);
        const currentTickMetrics = industryHistory.filter(m => m.tick === tick);
        
        if (currentTickMetrics.length === 0) {
            return {
                tick,
                entityId,
                assessments: [],
                summary: { healthy: 0, underPressure: 0, unprofitable: 0, resourceConstrained: 0, inactive: 0 },
            };
        }

        const assessments: IndustryHealthAssessment[] = [];

        for (const metrics of currentTickMetrics) {
            assessments.push(this.assessSector(metrics, tick, entityId));
        }

        this.storeAssessments(entityId, assessments);
        const summary = this.computeSummary(assessments);

        return { tick, entityId, assessments, summary };
    }

    private assessSector(metrics: IndustrySectorMetrics, tick: number, _entityId: string): IndustryHealthAssessment {
        const details: string[] = [];
        
        // Calculate input availability score (average across inputs)
        let inputAvailSum = 0;
        let inputCount = 0;
        for (const avail of Object.values(metrics.inputAvailability)) {
            inputAvailSum += avail;
            inputCount++;
        }
        const inputAvailabilityScore = inputCount > 0 ? inputAvailSum / inputCount : 1;

        // Calculate labor availability score
        let laborAvailSum = 0;
        let laborCount = 0;
        for (const avail of Object.values(metrics.laborAvailability)) {
            laborAvailSum += avail;
            laborCount++;
        }
        const laborAvailabilityScore = laborCount > 0 ? laborAvailSum / laborCount : 1;

        // Track restarts
        const restartInfo = this.restartTracking.get(metrics.sectorId) ?? { lastStopTick: -1, restartCount: 0 };
        if (metrics.stopReason && metrics.consecutiveStoppedTicks === 1) {
            // Just stopped
            if (restartInfo.lastStopTick >= 0 && tick - restartInfo.lastStopTick <= 50) {
                restartInfo.restartCount++;
            }
            restartInfo.lastStopTick = tick;
        } else if (!metrics.stopReason && restartInfo.lastStopTick === tick - 1) {
            // Just restarted
        }
        this.restartTracking.set(metrics.sectorId, restartInfo);

        // Determine status
        let status: IndustryHealthStatus = "healthy";
        
        if (metrics.stopReason && metrics.consecutiveStoppedTicks >= this.config.inactiveThresholdTicks) {
            status = "inactive";
            details.push(`Stopped for ${metrics.consecutiveStoppedTicks} ticks (reason: ${metrics.stopReason})`);
        } else if (metrics.stopReason) {
            status = "resource_constrained";
            details.push(`Currently stopped: ${metrics.stopReason}`);
        } else if (metrics.operatingResultPreSubsidy < 0 && metrics.profitMarginPreSubsidy !== null && metrics.profitMarginPreSubsidy < this.config.unprofitableThreshold) {
            status = "unprofitable";
            details.push(`Negative operating result: ${metrics.operatingResultPreSubsidy.toFixed(1)} (margin: ${(metrics.profitMarginPreSubsidy * 100).toFixed(1)}%)`);
        } else if (metrics.utilization < this.config.lowUtilizationThreshold) {
            status = "under_pressure";
            details.push(`Low utilization: ${(metrics.utilization * 100).toFixed(1)}%`);
        } else if (inputAvailabilityScore < this.config.lowInputAvailabilityThreshold) {
            status = "resource_constrained";
            details.push(`Low input availability: ${(inputAvailabilityScore * 100).toFixed(1)}%`);
        } else if (laborAvailabilityScore < this.config.lowLaborAvailabilityThreshold) {
            status = "resource_constrained";
            details.push(`Low labor availability: ${(laborAvailabilityScore * 100).toFixed(1)}%`);
        } else if (metrics.operatingResultPreSubsidy < 0) {
            status = "under_pressure";
            details.push(`Operating at a loss: ${metrics.operatingResultPreSubsidy.toFixed(1)}`);
        } else {
            details.push("Operating normally");
        }

        if (restartInfo.restartCount > 0) {
            details.push(`Restarted ${restartInfo.restartCount} time(s) recently`);
        }

        return {
            sectorId: metrics.sectorId,
            tick,
            status,
            operatingResultPreSubsidy: metrics.operatingResultPreSubsidy,
            operatingResultPostSubsidy: metrics.operatingResultPostSubsidy,
            profitMarginPreSubsidy: metrics.profitMarginPreSubsidy,
            profitMarginPostSubsidy: metrics.profitMarginPostSubsidy,
            utilization: metrics.utilization,
            consecutiveStoppedTicks: metrics.consecutiveStoppedTicks,
            inputAvailabilityScore,
            laborAvailabilityScore,
            restartCount: restartInfo.restartCount,
            assessmentDetails: details,
        };
    }

    private storeAssessments(entityId: string, assessments: IndustryHealthAssessment[]): void {
        if (!this.assessmentHistory.has(entityId)) {
            this.assessmentHistory.set(entityId, []);
        }
        const history = this.assessmentHistory.get(entityId)!;
        history.push(...assessments);
        if (history.length > this.config.rollingWindowTicks * 50) { // rough cap
            history.splice(0, history.length - this.config.rollingWindowTicks * 50);
        }
    }

    private computeSummary(assessments: IndustryHealthAssessment[]): IndustryHealthReport["summary"] {
        const summary = { healthy: 0, underPressure: 0, unprofitable: 0, resourceConstrained: 0, inactive: 0 };
        for (const a of assessments) {
            switch (a.status) {
                case "healthy": summary.healthy++; break;
                case "under_pressure": summary.underPressure++; break;
                case "unprofitable": summary.unprofitable++; break;
                case "resource_constrained": summary.resourceConstrained++; break;
                case "inactive": summary.inactive++; break;
            }
        }
        return summary;
    }

    getAssessmentHistory(entityId: string): IndustryHealthAssessment[] {
        return [...(this.assessmentHistory.get(entityId) ?? [])];
    }

    getSectorAssessmentHistory(entityId: string, sectorId: string): IndustryHealthAssessment[] {
        const history = this.assessmentHistory.get(entityId);
        if (!history) return [];
        return history.filter(a => a.sectorId === sectorId);
    }

    clear(): void {
        this.restartTracking.clear();
        this.assessmentHistory.clear();
    }
}