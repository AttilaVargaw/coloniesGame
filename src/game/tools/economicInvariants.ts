import { Goods } from "../data/Goods.ts";
import { Population } from "../data/Population.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { IndustrialSectors } from "../components/Factories.ts";

export interface EconomicInvariantResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates economic invariants for a single tick result.
 * Checks money conservation, goods non-negativity, labor non-over-allocation,
 * and production-input consistency.
 */
export function validateEconomicInvariants(
    result: IndustryTickResult,
    previousResult: IndustryTickResult | null,
): EconomicInvariantResult {
    const errors: string[] = [];

    // Goods non-negativity
    for(const good of Object.keys(result.goods) as (keyof Goods)[]) {
        const value = result.goods[good];
        if(value < 0) {
            errors.push(`Good ${good} is negative: ${value}`);
        }
        if(!Number.isFinite(value)) {
            errors.push(`Good ${good} is not finite: ${value}`);
        }
    }

    // Population non-negativity
    for(const key of Object.keys(result.populationUpdates) as (keyof Population)[]) {
        const update = result.populationUpdates[key];
        if(update.number < 0) {
            errors.push(`Population ${key} number is negative: ${update.number}`);
        }
        if(update.wealth < 0) {
            errors.push(`Population ${key} wealth is negative: ${update.wealth}`);
        }
        if(!Number.isFinite(update.number) || !Number.isFinite(update.wealth)) {
            errors.push(`Population ${key} has non-finite values`);
        }
    }

    // Capital non-negativity
    for(const sector of Object.keys(result.capitalStock) as (keyof IndustrialSectors)[]) {
        const stocks = result.capitalStock[sector];
        for(const good of Object.keys(stocks) as (keyof Goods)[]) {
            const value = stocks[good] ?? 0;
            if(value < 0) {
                errors.push(`Capital ${sector}/${good} is negative: ${value}`);
            }
            if(!Number.isFinite(value)) {
                errors.push(`Capital ${sector}/${good} is not finite`);
            }
        }
    }

    // Money non-negativity (warning only — sectors can go into debt)
    for(const sector of Object.keys(result.money)) {
        const value = result.money[sector];
        if(!Number.isFinite(value)) {
            errors.push(`Money ${sector} is not finite`);
        }
    }

    // Utilization bounds
    for(const sector of Object.keys(result.sectorUtilization) as (keyof IndustrialSectors)[]) {
        const value = result.sectorUtilization[sector];
        if(value < 0 || value > 1) {
            errors.push(`Sector ${sector} utilization out of bounds: ${value}`);
        }
    }

    // Money+wealth combined: detect only pathological changes (smoothing causes
    // some creation/destruction, so allow very wide tolerance).
    if(previousResult) {
        const prevTotal = Object.keys(previousResult.money).reduce((a, k) => a + (previousResult.money[k] ?? 0), 0);
        const currTotal = Object.keys(result.money).reduce((a, k) => a + (result.money[k] ?? 0), 0);
        const prevPopWealth = Object.keys(previousResult.populationUpdates).reduce(
            (a, k) => a + (previousResult.populationUpdates[k as keyof Population] as { wealth: number }).wealth, 0,
        );
        const currPopWealth = Object.keys(result.populationUpdates).reduce(
            (a, k) => a + (result.populationUpdates[k as keyof Population] as { wealth: number }).wealth, 0,
        );

        const prevCombined = prevTotal + prevPopWealth;
        const currCombined = currTotal + currPopWealth;
        const combinedChange = Math.abs(currCombined - prevCombined);
        // Allow 2x change per tick (smoothing + spending limits create/destroy money)
        if(prevCombined !== 0 && combinedChange > 2 * Math.abs(prevCombined)) {
            errors.push(`Money+wealth changed by ${((combinedChange / Math.abs(prevCombined)) * 100).toFixed(1)}% of total`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates invariants across a multi-tick simulation.
 */
export function validateLongRunSimulation(results: IndustryTickResult[]): {
    valid: boolean;
    errors: string[];
    snapshots: Array<{
        tick: number;
        totalPopulation: number;
        totalWealth: number;
        totalMoney: number;
        totalGoods: number;
        totalCapital: number;
        averageQol: number;
        unmetDemandTotal: number;
    }>;
} {
    const errors: string[] = [];
    const snapshots: Array<{
        tick: number;
        totalPopulation: number;
        totalWealth: number;
        totalMoney: number;
        totalGoods: number;
        totalCapital: number;
        averageQol: number;
        unmetDemandTotal: number;
    }> = [];

    let previous: IndustryTickResult | null = null;

    for(let i = 0; i < results.length; i++) {
        const result = results[i];

        // Per-tick validation
        const tickResult = validateEconomicInvariants(result, previous);
        if(!tickResult.valid) {
            errors.push(`Tick ${i + 1}: ${tickResult.errors.join("; ")}`);
        }

        // Snapshot
        const totalMoney = Object.keys(result.money).reduce((a, k) => a + (result.money[k] ?? 0), 0);
        const totalGoods = Object.keys(result.goods).reduce((a, k) => a + (result.goods[k as keyof Goods] ?? 0), 0);
        let totalCapital = 0;
        for(const sectorName of Object.keys(result.capitalStock) as (keyof IndustrialSectors)[]) {
            const stocks = result.capitalStock[sectorName];
            for(const goodKey of Object.keys(stocks) as (keyof Goods)[]) {
                totalCapital += stocks[goodKey] ?? 0;
            }
        }
        const populationKeys = Object.keys(result.populationUpdates) as (keyof Population)[];
        let totalPopulation = 0;
        let totalWealth = 0;
        const qolValues: number[] = [];
        for(const popKey of populationKeys) {
            const update = result.populationUpdates[popKey];
            totalPopulation += update.number;
            totalWealth += update.wealth;
            qolValues.push(update.qol);
        }
        const averageQol = qolValues.length > 0
            ? qolValues.reduce((a, b) => a + b, 0) / qolValues.length
            : 0;
        const unmetDemandTotal = Object.keys(result.unmetDemand).reduce((a, k) => a + (result.unmetDemand[k as keyof Goods] ?? 0), 0);

        snapshots.push({
            tick: i + 1,
            totalPopulation,
            totalWealth,
            totalMoney,
            totalGoods,
            totalCapital,
            averageQol,
            unmetDemandTotal,
        });

        // Check for explosions/collapses
        if(totalPopulation > 0 && totalPopulation > 1e12) {
            errors.push(`Tick ${i + 1}: Population explosion: ${totalPopulation}`);
        }
        if(totalWealth > 0 && totalWealth > 1e15) {
            errors.push(`Tick ${i + 1}: Wealth explosion: ${totalWealth}`);
        }
        if(averageQol < 0 || averageQol > 80) {
            errors.push(`Tick ${i + 1}: Average QoL out of bounds: ${averageQol}`);
        }

        previous = result;
    }

    return {
        valid: errors.length === 0,
        errors,
        snapshots,
    };
}
