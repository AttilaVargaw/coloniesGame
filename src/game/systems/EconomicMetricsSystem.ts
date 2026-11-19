import { System } from "@engine/systems/system";
import { Engine } from "@engine/core/engine";
import { IndustryTickCompletedEvent, IndustryTickCompletedData, IndustryTickMetricsData } from "@/engine/lib/events/IndustryTickCompletedEvent";
import { EconomicMetricsSnapshot, EconomicMetricsHistory, createEconomicMetricsHistory } from "./economicMetrics";

export class EconomicMetricsSystem extends System {
    private metricsHistory: EconomicMetricsHistory;

    constructor(maxSnapshots = 1000) {
        super();
        this.metricsHistory = createEconomicMetricsHistory(maxSnapshots);
    }

    addToEngine(engine: Engine): this {
        super.addToEngine(engine);
        engine.subscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        return this;
    }

    removeFromEngine(): this {
        if (this.engine) {
            this.engine.unsubscribe(IndustryTickCompletedEvent, this.handleTickCompleted);
        }
        return super.removeFromEngine();
    }

    private handleTickCompleted = (data: IndustryTickCompletedData) => {
        const snapshot = this.calculateMetrics(data.metrics);
        this.metricsHistory.addSnapshot(snapshot);
    };

    private calculateMetrics(data: IndustryTickMetricsData): EconomicMetricsSnapshot {
        const sectorOutput: Record<string, number> = {};
        let totalOutput = 0;
        for (const [sector, production] of Object.entries(data.goodsProduction)) {
            const sectorTotal = Object.values(production).reduce((sum: number, v: number) => sum + v, 0);
            sectorOutput[sector] = sectorTotal;
            totalOutput += sectorTotal;
        }

        let employed = 0;
        let available = 0;
        for (const [, pop] of Object.entries(data.workingWorkers)) {
            employed += pop.number;
        }
        for (const [, pop] of Object.entries(data.freeWorkers)) {
            available += pop.number;
        }
        available += employed;

        const unemployed = Math.max(0, available - employed);
        const employmentRate = available > 0 ? employed / available : 0;

        let totalCash = 0;
        let totalPopulation = 0;
        let totalIncome = 0;
        let totalSpending = 0;
        for (const [, pop] of Object.entries(data.workingWorkers)) {
            totalCash += pop.wealth;
            totalPopulation += pop.number;
        }
        for (const [, pop] of Object.entries(data.freeWorkers)) {
            totalCash += pop.wealth;
            totalPopulation += pop.number;
        }
        
        const wagesByPop = data.accounting.wagesByPop;
        const spendingByPop = data.accounting.spendingByPop;
        
        for (const [, wages] of Object.entries(wagesByPop)) {
            totalIncome += wages;
        }
        for (const [, spending] of Object.entries(spendingByPop)) {
            totalSpending += spending;
        }

        const sectorRevenue: Record<string, number> = {};
        const sectorCosts: Record<string, number> = {};
        const sectorProfits: Record<string, number> = {};
        const sectorUtilization: Record<string, number> = {};

        for (const [sector, utilization] of Object.entries(data.sectorUtilization)) {
            sectorUtilization[sector] = utilization;
            const laborCost = data.sectorLaborCosts[sector] ?? 0;
            const inputCost = data.sectorInputCosts[sector] ?? 0;
            sectorCosts[sector] = laborCost + inputCost;
            // Revenue would need to be calculated from accounting data
            sectorRevenue[sector] = 0; // placeholder
            sectorProfits[sector] = -(laborCost + inputCost);
        }

        const treasuryBalance = data.colonyTreasury;

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