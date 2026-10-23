import { baseSalaries, Population } from "../data/Population";

export const wageDamping = 0.3;
export const wageMinMultiplier = 0.5;
export const wageMaxMultiplier = 2.0;

export function buildAdjustedSalaries(
    wageMemory: Partial<Record<keyof Population, number>>
): Record<keyof Population, number> {
    const adjustedSalaries: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const key of Object.keys(baseSalaries) as (keyof Population)[]) {
        adjustedSalaries[key] = wageMemory[key] ?? baseSalaries[key];
    }
    return adjustedSalaries;
}

export function updateWageMemory(
    wageMemory: Partial<Record<keyof Population, number>>,
    workerMarketRatios: Record<keyof Population, number>
): Partial<Record<keyof Population, number>> {
    for(const [workerType, ratio] of Object.entries(workerMarketRatios)) {
        const wt = workerType as keyof Population;
        const currentWage = wageMemory[wt] ?? baseSalaries[wt];
        let wageMultiplier = 1.0;
        if(ratio > 0) {
            wageMultiplier = 1.0 / ratio;
        } else {
            wageMultiplier = wageMaxMultiplier;
        }
        wageMultiplier = Math.max(wageMinMultiplier, Math.min(wageMaxMultiplier, wageMultiplier));
        const targetWage = baseSalaries[wt] * wageMultiplier;
        const dampedWage = currentWage + (targetWage - currentWage) * wageDamping;
        wageMemory[wt] = dampedWage;
    }
    return wageMemory;
}
