import { Population } from "../data/Population.ts";
import { mortality } from "../data/populationHelpers.ts";
import { Goods } from "../data/Goods.ts";

export interface DemographicState {
    deprivation: Partial<Record<keyof Goods, number>>;
    expectedQol: Record<keyof Population, number>;
}

export const DEMOGRAPHIC_CONFIG = {
    // Mortality response to deprivation
    DEPRIVATION_MORTALITY_RATE: 0.02, // 2% additional mortality per unit of deprivation
    DEPRIVATION_DECAY: 0.1,           // Deprivation decays 10% per tick when goods are available
    DEPRIVATION_GROWTH: 0.5,          // Deprivation grows 50% of shortfall per tick
    
    // QoL smoothing
    QOL_SMOOTHING: 0.03,
    WEALTH_SMOOTHING: 0.5,
    EXPECTED_QOL_SMOOTHING: 0.03,
    
    // Population change limits
    MAX_DAILY_CHANGE: 0.001,
    
    // Wealth drawdown
    WEALTH_DRAWDOWN_RATE: 0.01,
} as const;

export interface DeprivationUpdate {
    deprivation: Partial<Record<keyof Goods, number>>;
    mortalityRate: Record<keyof Population, number>;
    totalDeaths: number;
}

/**
 * Compute deprivation from essential goods shortfall.
 * Deprivation accumulates when essential goods are below demand and decays when available.
 */
export function computeDeprivation({
    previousDeprivation,
    goodsShortfall,
    essentialGoods,
}: {
    previousDeprivation: Partial<Record<keyof Goods, number>>;
    goodsShortfall: Partial<Record<keyof Goods, number>>;
    essentialGoods: (keyof Goods)[];
}): Partial<Record<keyof Goods, number>> {
    const deprivation: Partial<Record<keyof Goods, number>> = {};

    for(const good of essentialGoods) {
        const shortfall = (goodsShortfall[good] ?? 0);
        const prev = (previousDeprivation[good] ?? 0);

        if(shortfall > 0) {
            // Deprivation grows with shortfall
            deprivation[good] = prev + shortfall * DEMOGRAPHIC_CONFIG.DEPRIVATION_GROWTH;
        } else if(prev > 0) {
            // Deprivation decays when goods are available
            deprivation[good] = Math.max(0, prev * (1 - DEMOGRAPHIC_CONFIG.DEPRIVATION_DECAY));
        } else {
            deprivation[good] = 0;
        }
    }

    return deprivation;
}

/**
 * Compute mortality rate per population type based on deprivation.
 * Higher deprivation of essential goods increases mortality.
 */
export function computeMortalityRates({
    deprivation,
    population,
}: {
    deprivation: Partial<Record<keyof Goods, number>>;
    population: Population;
}): { mortalityRate: Record<keyof Population, number>; totalDeaths: number } {
    const mortalityRate: Record<keyof Population, number> = {};
    let totalDeaths = 0;

    // Aggregate deprivation across all essential goods
    const totalDeprivation = Object.values(deprivation).reduce((sum, v) => sum + v, 0);

    for(const [key, pop] of Object.entries(population) as [keyof Population, any][]) {
        // Base mortality from QoL (using existing mortality function)
        const baseMortality = mortality(pop.qol ?? 0);
        
        // Additional mortality from deprivation
        const deprivationMortality = totalDeprivation * DEMOGRAPHIC_CONFIG.DEPRIVATION_MORTALITY_RATE;
        
        const totalMortality = Math.min(1, baseMortality + deprivationMortality);
        mortalityRate[key] = totalMortality;

        const deaths = pop.number * totalMortality / 365; // Daily mortality
        totalDeaths += deaths;
    }

    return { mortalityRate, totalDeaths };
}

/**
 * Apply mortality to population, reducing numbers.
 */
export function applyMortality({
    population,
    mortalityRate,
}: {
    population: Population;
    mortalityRate: Record<keyof Population, number>;
}): Population {
    const updated: Population = { ...population };

    for(const [key, pop] of Object.entries(population) as [keyof Population, any][]) {
        const rate = mortalityRate[key] ?? 0;
        const deaths = pop.number * rate / 365;
        updated[key] = {
            ...pop,
            number: Math.max(0, pop.number - deaths),
        };
    }

    return updated;
}
