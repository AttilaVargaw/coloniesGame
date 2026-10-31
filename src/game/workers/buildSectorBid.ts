import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorBid } from "./SectorBid";

function scaleMap(obj: Record<string, number>, factor: number): Record<string, number> {
    const result: Record<string, number> = {};
    for(const [k, v] of Object.entries(obj)) {
        result[k] = v * factor;
    }
    return result;
}

export function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
    capitalStock: Partial<Goods>,
    salaries: Record<keyof Population, number>,
    previousProfit: number,
): SectorBid | null {
    const config = industrySectorBlueprints.get(name);

    if(!config) return null;

    const capitalGoods = config.capitalGoods || {};

    // Capital adequacy: capital stock relative to reference consumption.
    // 0 stock = 0 production, reference stock = 1.0x production,
    // excess capital increases max production with diminishing sqrt returns.
    let capitalAdequacy = Infinity;
    let hasCapitalGoods = false;
    for(const goodKey of Object.keys(capitalGoods)) {
        hasCapitalGoods = true;
        const stock = capitalStock[goodKey as keyof Goods] ?? 0;
        const rate = capitalGoods[goodKey as keyof Goods] as number;
        const referenceConsumption = rate * 100;
        if(referenceConsumption <= 0) continue;

        const ratio = stock / referenceConsumption;
        const adequacy = ratio >= 1 ? 1 + Math.sqrt(ratio) : ratio;
        capitalAdequacy = Math.min(capitalAdequacy, adequacy);
    }
    if(!hasCapitalGoods) capitalAdequacy = 1;

    const workerRequirement = config.workerRequirement || {};
    const goodsRequirements = config.goodsRequirements || {};
    const goodsProduction = config.goodsProduction || {};

    const inputCost = Object.entries(goodsRequirements).reduce((sum, [key, value]) => {
        return sum + (value as number) * prices[key as keyof Goods];
    }, 0);

    const laborCost = Object.entries(workerRequirement).reduce((sum, [key, value]) => {
        return sum + (value as number) * salaries[key as keyof Population];
    }, 0);

    const costPerUnit = inputCost + laborCost;
    const budgetRatio = costPerUnit > 0 ? Math.min(1, Math.max(0, 1)) : 1;

    // Profitability-based scaling: unprofitable sectors reduce output next tick
    const profitabilityFactor = previousProfit > 0 ? 1 : Math.max(0.1, 1 + previousProfit / Math.max(costPerUnit, 1));

    const outputLevel = techMultiplier * capitalAdequacy * profitabilityFactor;
    const inputLevel = capitalAdequacy * profitabilityFactor;

    // Apply laborAssigned as a hard cap on worker demand
    const idealWorkerDemand = scaleMap(workerRequirement as Record<string, number>, inputLevel);
    const totalWorkerDemand = Object.values(idealWorkerDemand).reduce((a, b) => a + b, 0);

    let laborScale = 1;
    if(laborAssigned > 0 && totalWorkerDemand > 0) {
        laborScale = Math.min(1, laborAssigned / totalWorkerDemand);
    }

    const scaledWorkerDemand = scaleMap(idealWorkerDemand as Record<string, number>, laborScale);

    return {
        name: name as string,
        level: 1,
        budgetRatio,
        inputCost: inputCost * inputLevel,
        laborCost: laborCost * inputLevel,
        idealWorkerDemand: scaledWorkerDemand,
        idealGoodsDemand: scaleMap(goodsRequirements as Record<string, number>, inputLevel),
        idealGoodsProduction: scaleMap(goodsProduction as Record<string, number>, outputLevel),
        outputLevel,
        inputLevel,
    };
}
