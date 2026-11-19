import { System } from "@engine/systems/system";
import { Engine } from "@engine/core/engine";
import { IndustryComponent } from "@game/components/industryComponent";
import { IndustryUpdatedEvent } from "@/engine/lib/events";
import { Population } from "../data/Population";
import type { IndustrialSectors } from "../components/Factories";
import { EconomicMetricsSnapshot, EconomicMetricsHistory, createEconomicMetricsHistory } from "./economicMetrics";

export class EconomicMetricsSystem extends System {
    private metricsHistory: EconomicMetricsHistory;

    constructor(maxSnapshots = 1000) {
        super();
        this.metricsHistory = createEconomicMetricsHistory(maxSnapshots);
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryUpdatedEvent, this.handleIndustryUpdated);
        return this;
    }

    removeFromEngine(): this {
        if (this.engine) {
            this.engine.unsubscribe(IndustryUpdatedEvent, this.handleIndustryUpdated);
        }
        return super.removeFromEngine();
    }

    private handleIndustryUpdated = (entity: InstanceType<typeof import("@engine/entities/entity").Entity>) => {
        const industry = entity.getComponent(IndustryComponent);
        if (!industry) return;

        const snapshot = this.calculateMetrics(entity.id, industry);
        this.metricsHistory.addSnapshot(snapshot);
    };

    private calculateMetrics(_entityId: string, industry: IndustryComponent): EconomicMetricsSnapshot {
        const sectorOutput: Record<string, number> = {};
        let totalOutput = 0;
        for (const [sector, production] of Object.entries(industry.goodsProduction)) {
            const sectorTotal = Object.values(production).reduce((sum, v) => sum + v, 0);
            sectorOutput[sector] = sectorTotal;
            totalOutput += sectorTotal;
        }

        let employed = 0;
        let available = 0;
        for (const [, pop] of Object.entries(industry.population)) {
            available += pop.number;
        }
        for (const [, result] of industry.sectorResults) {
            for (const workers of Object.values(result.workersEmployed)) {
                employed += workers;
            }
        }

        const unemployed = Math.max(0, available - employed);
        const employmentRate = available > 0 ? employed / available : 0;

        let totalCash = 0;
        let totalPopulation = 0;
        let totalIncome = 0;
        let totalSpending = 0;
        for (const [popKey, pop] of Object.entries(industry.population)) {
            totalCash += pop.wealth;
            totalPopulation += pop.number;
            const income = Object.entries(industry.sectorResults).reduce((sum, [, result]) => {
                return sum + (result.workersEmployed[popKey as keyof Population] ?? 0) * (industry.wages[popKey as keyof Population] ?? 0);
            }, 0);
            totalIncome += income;
            const spending = Object.values(industry.populationRequirements[popKey as keyof Population] ?? {}).reduce((sum, v) => sum + v, 0);
            totalSpending += spending;
        }

        const sectorRevenue: Record<string, number> = {};
        const sectorCosts: Record<string, number> = {};
        const sectorProfits: Record<string, number> = {};
        const sectorUtilization: Record<string, number> = {};

        for (const [sector, profit] of Object.entries(industry.sectorProfits as Record<string, number>)) {
            sectorProfits[sector] = profit;
            sectorRevenue[sector] = industry.sectorRevenue[sector as keyof IndustrialSectors] ?? 0;
            sectorCosts[sector] = (industry.sectorInputCosts[sector as keyof IndustrialSectors] ?? 0) + (industry.sectorLaborCosts[sector as keyof IndustrialSectors] ?? 0);
            sectorUtilization[sector] = industry.sectorUtilization[sector as keyof IndustrialSectors] ?? 0;
        }

        const treasuryBalance = industry.colonyTreasury;

        return {
            tick: 0,
            production: { sectorOutput, totalOutput },
            labor: { employed, available, unemployed, employmentRate },
            households: { totalCash, totalPopulation, totalIncome, totalSpending },
            industry: { sectorRevenue, sectorCosts, sectorProfits, sectorUtilization },
            government: { treasuryBalance },
        };
    }

    getHistory(): EconomicMetricsHistory {
        return this.metricsHistory;
    }

    getLatestSnapshot(): EconomicMetricsSnapshot | undefined {
        return this.metricsHistory.getLatest();
    }

    getSnapshots(maxCount?: number): EconomicMetricsSnapshot[] {
        return this.metricsHistory.getSnapshots(maxCount);
    }

    clearHistory(): void {
        this.metricsHistory.clear();
    }
}