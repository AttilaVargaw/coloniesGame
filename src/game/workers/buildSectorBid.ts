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

// Capital productivity: diminishing returns on capital adequacy.
// capitalRatio is kept uncapped; capitalMultiplier applies diminishing returns.
export const CAPITAL_ELASTICITY = 0.5;

function capitalMultiplierFromRatio(capitalRatio: number): number {
    return Math.pow(Math.max(capitalRatio, 0), CAPITAL_ELASTICITY);
}

function mergeMethodOverrides<T extends { goodsRequirements?: Record<string, number>; workerRequirement?: Record<string, number>, goodsProduction?: Record<string, number>, capitalGoods?: Record<string, number> }>(base: any, method: ProductionMethod | undefined): T {
    if(!method) return base;
    const out: T = { ...base };
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
        adjusted[key] = value / Math.max(mult, 0.01);
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
        adjusted[key] = value * mult;
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
    _laborAssigned: number,
): Record<string, number> {
    return scaleMap(adjustedWorkerRequirement, inputLevel);
}

export function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
    capitalStock: Partial<Goods>,
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

    // Capital goods scaling: more capital = more employable workers, less = fewer
    let capitalRatio = 1;
    const capitalGoods = effective.capitalGoods ?? {};
    if(Object.keys(capitalGoods).length > 0) {
        capitalRatio = Infinity;
        for(const [goodKey, requiredPerUnit] of Object.entries(capitalGoods)) {
            const gKey = goodKey as keyof Goods;
            const stock = capitalStock[gKey] ?? 0;
            const req = requiredPerUnit ?? 0;
            const ratio = req > 0 ? stock / req : Infinity;
            capitalRatio = Math.min(capitalRatio, ratio);
        }
        if(capitalRatio === Infinity) capitalRatio = 1;
    }

    const capitalAdjustedWorkerDemand: Record<string, number> = {};
    const capitalMult = capitalMultiplierFromRatio(capitalRatio);
    for(const [key, value] of Object.entries(scaledWorkerDemand)) {
        capitalAdjustedWorkerDemand[key] = value * capitalMult;
    }

    return {
        name: name as string,
        level: 1,
        budgetRatio,
        actualScale: budgetRatio,
        inputCost,
        laborCost,
        idealWorkerDemand: capitalAdjustedWorkerDemand,
        idealGoodsDemand: scaleMap(adjustedGoodsRequirements, inputLevel * capitalMult),
        idealGoodsProduction: scaleMap(goodsProduction as Record<string, number>, outputLevel * capitalMult),
        outputLevel,
        inputLevel,
    };
}
