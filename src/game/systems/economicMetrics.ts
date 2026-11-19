export interface EconomicMetricsSnapshot {
    tick: number;

    production: {
        sectorOutput: Record<string, number>;
        totalOutput: number;
    };

    labor: {
        employed: number;
        available: number;
        unemployed: number;
        employmentRate: number;
    };

    households: {
        totalCash: number;
        totalPopulation: number;
        totalIncome: number;
        totalSpending: number;
    };

    industry: {
        sectorRevenue: Record<string, number>;
        sectorCosts: Record<string, number>;
        sectorProfits: Record<string, number>;
        sectorUtilization: Record<string, number>;
    };

    government: {
        treasuryBalance: number;
    };
}

export interface EconomicMetricsHistory {
    snapshots: EconomicMetricsSnapshot[];
    maxSnapshots: number;
    addSnapshot(snapshot: EconomicMetricsSnapshot): void;
    getSnapshots(maxCount?: number): EconomicMetricsSnapshot[];
    getLatest(): EconomicMetricsSnapshot | undefined;
    clear(): void;
}

export function createEconomicMetricsHistory(maxSnapshots = 1000): EconomicMetricsHistory {
    const snapshots: EconomicMetricsSnapshot[] = [];

    return {
        snapshots,
        maxSnapshots,
        addSnapshot(snapshot: EconomicMetricsSnapshot) {
            snapshots.push(snapshot);
            if (snapshots.length > maxSnapshots) {
                snapshots.shift();
            }
        },
        getSnapshots(maxCount?: number) {
            if (maxCount === undefined) return [...snapshots];
            return snapshots.slice(-maxCount);
        },
        getLatest() {
            return snapshots[snapshots.length - 1];
        },
        clear() {
            snapshots.length = 0;
        },
    };
}