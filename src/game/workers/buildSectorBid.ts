import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import type { ProductionMethod } from "../systems/sectorBlueprints";
import { Goods } from "../data/Goods";
import { Population } from "../data/Population";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorBid } from "./SectorBid";
import type { SectorDecisions } from "../systems/sectorBehaviorTree/bt";

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

function adjustWorkerRequirements(
    workerRequirement: Record<string, number>,
    options: { workerEfficiencyMultipliers?: Record<keyof Population, number>; materialRequirementMultipliers?: Record<keyof Goods, number> },
    method: ProductionMethod | undefined,
): Record<string, number> {
    const workerEff = (options.workerEfficiencyMultipliers ?? {}) as Record<keyof Population, number>;
    const adjusted: Record<string, number> = {};
    for(const [key, value] of Object.entries(workerRequirement)) {
        const mult = workerEff[key as keyof Population] ?? 1;
        adjusted[key] = (value as number) / Math.max(mult, 0.01);
    }
    const workerMethodMult = method?.workerMultiplier ?? 1;
    for(const key of Object.keys(adjusted)) {
        adjusted[key] = adjusted[key] / Math.max(workerMethodMult, 0.01);
    }
    return adjusted;
}

function adjustGoodsRequirements(
    goodsRequirements: Record<string, number>,
    options: { workerEfficiencyMultipliers?: Record<keyof Population, number>; materialRequirementMultipliers?: Record<keyof Goods, number> },
    method: ProductionMethod | undefined,
): Record<string, number> {
    const materialMult = (options.materialRequirementMultipliers ?? {}) as Record<keyof Goods, number>;
    const adjusted: Record<string, number> = {};
    for(const [key, value] of Object.entries(goodsRequirements)) {
        const mult = materialMult[key as keyof Goods] ?? 1;
        adjusted[key] = (value as number) * mult;
    }
    const materialMethodMult = method?.materialMultiplier ?? 1;
    for(const key of Object.keys(adjusted)) {
        adjusted[key] = adjusted[key] * materialMethodMult;
    }
    return adjusted;
}

function calculateCosts(
    adjustedWorkerRequirement: Record<string, number>,
    adjustedGoodsRequirements: Record<string, number>,
    prices: Record<keyof Goods, number>,
    salaries: Record<keyof Population, number>,
    inputLevel: number,
): { inputCost: number; laborCost: number; costPerUnit: number } {
    const inputCost = Object.entries(adjustedGoodsRequirements).reduce((sum, [key, value]) => {
        return sum + value * prices[key as keyof Goods];
    }, 0) * inputLevel;

    const laborCost = Object.entries(adjustedWorkerRequirement).reduce((sum, [key, value]) => {
        return sum + value * salaries[key as keyof Population];
    }, 0) * inputLevel;

    return { inputCost, laborCost, costPerUnit: inputCost + laborCost };
}

function scaleLaborDemand(
    adjustedWorkerRequirement: Record<string, number>,
    inputLevel: number,
    laborAssigned: number,
): Record<string, number> {
    const idealWorkerDemand = scaleMap(adjustedWorkerRequirement, inputLevel);
    const totalWorkerDemand = Object.values(idealWorkerDemand).reduce((a, b) => a + b, 0);

    let laborScale = 1;
    if(laborAssigned > 0 && totalWorkerDemand > 0) {
        laborScale = Math.min(1, laborAssigned / totalWorkerDemand);
    }

    return scaleMap(idealWorkerDemand as Record<string, number>, laborScale);
}

export function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
    _capitalStock: Partial<Goods>,
    salaries: Record<keyof Population, number>,
    _previousProfit: number,
    decisions: SectorDecisions,
    options?: {
        workerEfficiencyMultipliers?: Record<keyof Population, number>;
        materialRequirementMultipliers?: Record<keyof Goods, number>;
        capitalMultipliers?: Record<keyof IndustrialSectors, number>;
        selectedMethod?: string | null;
        sectorStartingMoney?: number;
    },
): SectorBid | null {
    const config = industrySectorBlueprints.get(name);

    if(!config) return null;

    const method = options?.selectedMethod ? config.productionMethods?.get(options.selectedMethod) : undefined;
    const effective = mergeMethodOverrides(config, method);

    const workerRequirement = effective.workerRequirement || {};
    const goodsRequirements = effective.goodsRequirements || {};
    const goodsProduction = effective.goodsProduction || {};

    const adjustedWorkerRequirement = adjustWorkerRequirements(workerRequirement, options ?? {}, method);
    const adjustedGoodsRequirements = adjustGoodsRequirements(goodsRequirements, options ?? {}, method);

    // BT-driven levels (no compounding constraint math)
    const inputLevel = decisions.stopProduction ? 0 : 1;
    const effMult = method?.efficiencyMultiplier ?? 1;
    const outputLevel = decisions.stopProduction ? 0 : techMultiplier * (effMult > 0 ? effMult : 1);

    const { inputCost, laborCost, costPerUnit } = calculateCosts(
        adjustedWorkerRequirement,
        adjustedGoodsRequirements,
        prices,
        salaries,
        inputLevel,
    );

    const sectorInvestment = decisions.sectorInvestment ?? 0;
    const sectorMoney = Math.max(options?.sectorStartingMoney ?? 0, 0);
    const budgetRatio = costPerUnit > 0 ? Math.min(1, (sectorMoney + sectorInvestment) / Math.max(costPerUnit, 1)) : 1;

    const scaledWorkerDemand = scaleLaborDemand(adjustedWorkerRequirement, inputLevel, laborAssigned);

    return {
        name: name as string,
        level: 1,
        budgetRatio,
        inputCost,
        laborCost,
        idealWorkerDemand: scaledWorkerDemand,
        idealGoodsDemand: scaleMap(adjustedGoodsRequirements, inputLevel),
        idealGoodsProduction: scaleMap(goodsProduction as Record<string, number>, outputLevel),
        outputLevel,
        inputLevel,
    };
}
