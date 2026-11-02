import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import type { ProductionMethod } from "../systems/sectorBlueprints";
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

function mergeMethodOverrides(base: any, method: ProductionMethod | undefined): any {
    if(!method) return base;
    const out: any = { ...base };
    if(method.goodsRequirements) out.goodsRequirements = { ...base.goodsRequirements, ...method.goodsRequirements };
    if(method.workerRequirement) out.workerRequirement = { ...base.workerRequirement, ...method.workerRequirement };
    if(method.goodsProduction) out.goodsProduction = { ...base.goodsProduction, ...method.goodsProduction };
    if(method.capitalGoods) out.capitalGoods = { ...base.capitalGoods, ...method.capitalGoods };
    return out;
}

export function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
    capitalStock: Partial<Goods>,
    salaries: Record<keyof Population, number>,
    previousProfit: number,
    options?: {
        workerEfficiencyMultipliers?: Record<keyof Population, number>;
        materialRequirementMultipliers?: Record<keyof Goods, number>;
        capitalMultipliers?: Record<keyof IndustrialSectors, number>;
        selectedMethod?: string | null;
        sectorInvestment?: number;
        sectorStartingMoney?: number;
    },
): SectorBid | null {
    const config = industrySectorBlueprints.get(name);

    if(!config) return null;

    const method = options?.selectedMethod ? config.productionMethods?.get(options.selectedMethod) : undefined;
    const effective = mergeMethodOverrides(config, method);

    const capitalGoods = effective.capitalGoods || {};

    // Capital adequacy: capital stock relative to reference consumption.
    // 0 stock = 0 production, reference stock = 1.0x production,
    // excess capital increases max production with diminishing sqrt returns.
    let capitalAdequacy = Infinity;
    let hasCapitalGoods = false;
    const capitalMult = options?.capitalMultipliers?.[name] ?? 1;
    for(const goodKey of Object.keys(capitalGoods)) {
        hasCapitalGoods = true;
        const stock = (capitalStock[goodKey as keyof Goods] ?? 0) * capitalMult;
        const rate = capitalGoods[goodKey as keyof Goods] as number;
        const referenceConsumption = rate * 100;
        if(referenceConsumption <= 0) continue;

        const ratio = stock / referenceConsumption;
        const adequacy = ratio >= 1 ? 1 + Math.sqrt(ratio) : ratio;
        capitalAdequacy = Math.min(capitalAdequacy, adequacy);
    }
    if(!hasCapitalGoods) capitalAdequacy = 1;

    const workerRequirement = effective.workerRequirement || {};
    const goodsRequirements = effective.goodsRequirements || {};
    const goodsProduction = effective.goodsProduction || {};

    // Apply worker efficiency: more efficient workers = fewer needed
    const workerEff = (options?.workerEfficiencyMultipliers ?? {}) as Record<keyof Population, number>;
    const adjustedWorkerRequirement: Record<string, number> = {};
    for(const [key, value] of Object.entries(workerRequirement)) {
        const mult = workerEff[key as keyof Population] ?? 1;
        adjustedWorkerRequirement[key] = (value as number) / Math.max(mult, 0.01);
    }

    // Apply material requirement multiplier
    const materialMult = (options?.materialRequirementMultipliers ?? {}) as Record<keyof Goods, number>;
    const adjustedGoodsRequirements: Record<string, number> = {};
    for(const [key, value] of Object.entries(goodsRequirements)) {
        const mult = materialMult[key as keyof Goods] ?? 1;
        adjustedGoodsRequirements[key] = (value as number) * mult;
    }

    // Apply production method multipliers
    const effMult = method?.efficiencyMultiplier ?? 1;
    const workerMethodMult = method?.workerMultiplier ?? 1;
    const materialMethodMult = method?.materialMultiplier ?? 1;

    for(const key of Object.keys(adjustedWorkerRequirement)) {
        adjustedWorkerRequirement[key] = adjustedWorkerRequirement[key] / Math.max(workerMethodMult, 0.01);
    }
    for(const key of Object.keys(adjustedGoodsRequirements)) {
        adjustedGoodsRequirements[key] = adjustedGoodsRequirements[key] * materialMethodMult;
    }

    const inputCost = Object.entries(adjustedGoodsRequirements).reduce((sum, [key, value]) => {
        return sum + value * prices[key as keyof Goods];
    }, 0);

    const laborCost = Object.entries(adjustedWorkerRequirement).reduce((sum, [key, value]) => {
        return sum + value * salaries[key as keyof Population];
    }, 0);

    const costPerUnit = inputCost + laborCost;
    const operatingCost = costPerUnit;

    // Budget ratio: how much of full operation the sector can afford.
    // Player investment + sector's own cash fund production.
    // Clamp sectorMoney at 0 so broke sectors can't go negative budget.
    const sectorInvestment = options?.sectorInvestment ?? 0;
    const sectorMoney = Math.max(options?.sectorStartingMoney ?? 0, 0);
    let budgetRatio = operatingCost > 0 ? Math.min(1, (sectorMoney + sectorInvestment) / Math.max(operatingCost, 1)) : 1;

    // Profitability-based scaling: unprofitable sectors reduce output next tick
    const profitabilityFactor = previousProfit > 0 ? 1 : Math.max(0.1, 1 + previousProfit / Math.max(costPerUnit, 1));

    const outputLevel = techMultiplier * capitalAdequacy * efficiencyBonus(effective) * effMult * profitabilityFactor;
    const inputLevel = capitalAdequacy * profitabilityFactor;

    // Apply laborAssigned as a hard cap on worker demand
    const idealWorkerDemand = scaleMap(adjustedWorkerRequirement, inputLevel);
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
        idealGoodsDemand: scaleMap(adjustedGoodsRequirements, inputLevel),
        idealGoodsProduction: scaleMap(goodsProduction as Record<string, number>, outputLevel),
        outputLevel,
        inputLevel,
    };
}

function efficiencyBonus(config: any): number {
    return config.efficiencyBonus ?? 0;
}
