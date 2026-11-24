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

export const CAPITAL_ELASTICITY = 0.5;

export const MAX_CAPITAL_MULTIPLIER = 100;

function capitalMultiplierFromRatio(capitalRatio: number): number {
    if(!Number.isFinite(capitalRatio) || capitalRatio < 0) {
        throw new Error(`Invalid capital ratio: ${capitalRatio}`);
    }

    return Math.min(
        MAX_CAPITAL_MULTIPLIER,
        Math.pow(capitalRatio, CAPITAL_ELASTICITY),
    );
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

    for(const [key, mult] of Object.entries(workerEff)) {
        if(!Number.isFinite(mult) || mult <= 0) {
            throw new Error(`Invalid worker efficiency multiplier for ${key}: ${mult}`);
        }
    }

    const workerMethodMult = method?.workerMultiplier ?? 1;
    if(!Number.isFinite(workerMethodMult) || workerMethodMult <= 0) {
        throw new Error(
            `Invalid worker multiplier for selected production method: ${workerMethodMult}`,
        );
    }

    const adjusted: Record<string, number> = {};
    for(const [key, value] of Object.entries(workerRequirement)) {
        const mult = workerEff[key as keyof Population] ?? 1;
        adjusted[key] = value / Math.max(mult, 0.01);
    }
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

    for(const [key, mult] of Object.entries(materialMult)) {
        if(!Number.isFinite(mult) || mult <= 0) {
            throw new Error(`Invalid material requirement multiplier for ${key}: ${mult}`);
        }
    }

    const materialMethodMult = method?.materialMultiplier ?? 1;
    if(!Number.isFinite(materialMethodMult) || materialMethodMult <= 0) {
        throw new Error(
            `Invalid material multiplier for selected production method: ${materialMethodMult}`,
        );
    }

    const adjusted: Record<string, number> = {};
    for(const [key, value] of Object.entries(goodsRequirements)) {
        const mult = materialMult[key as keyof Goods] ?? 1;
        adjusted[key] = value * mult;
    }
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
): Record<string, number> {
    return scaleMap(adjustedWorkerRequirement, inputLevel);
}

export function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    _laborAssigned: number,
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

    if(!Number.isFinite(techMultiplier) || techMultiplier < 0) {
        throw new Error(`Invalid tech multiplier for ${name}: ${techMultiplier}`);
    }

    const sectorMoney = options?.sectorStartingMoney ?? 0;
    if(!Number.isFinite(sectorMoney) || sectorMoney < 0) {
        throw new Error(`Invalid sector starting money for ${name}: ${sectorMoney}`);
    }

    for(const [key, value] of Object.entries(prices)) {
        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid price for ${key}: ${value}`);
        }
    }

    for(const [key, value] of Object.entries(salaries)) {
        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid salary for ${key}: ${value}`);
        }
    }

    let method: ProductionMethod | undefined;
    if(options?.selectedMethod) {
        method = config.productionMethods?.get(options.selectedMethod);
        if(!method) {
            throw new Error(
                `Unknown production method ${options.selectedMethod} for ${name}`,
            );
        }
    } else if(config.productionMethods && config.productionMethods.size > 0) {
        // Default to first production method (matches IndustryComponent initialization)
        const firstMethodKey = config.productionMethods.keys().next().value!;
        method = config.productionMethods.get(firstMethodKey);
    }

    const effective = mergeMethodOverrides(config, method);

    // Non-essential goods from blueprint (not overridden by methods)
    const nonEssentialGoods = config.nonEssentialGoods ?? new Set<keyof Goods>();

    const workerRequirement = effective.workerRequirement || {};
    const goodsRequirements = effective.goodsRequirements || {};
    const goodsProduction = effective.goodsProduction || {};

    for(const [key, value] of Object.entries(workerRequirement)) {
        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid worker requirement for ${name}/${key}: ${value}`);
        }
    }

    for(const [key, value] of Object.entries(goodsRequirements)) {
        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid goods requirement for ${name}/${key}: ${value}`);
        }
    }

    for(const [key, value] of Object.entries(goodsProduction)) {
        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid goods production for ${name}/${key}: ${value}`);
        }
    }

    // Validate requirement keys exist in prices and salaries
    const validGoods = new Set(Object.keys(prices) as (keyof Goods)[]);
    const validPopulation = new Set(Object.keys(salaries) as (keyof Population)[]);

    for(const key of Object.keys(goodsRequirements)) {
        if(!validGoods.has(key as keyof Goods)) {
            throw new Error(`Unknown required good for ${name}: ${key}`);
        }
    }

    for(const key of Object.keys(workerRequirement)) {
        if(!validPopulation.has(key as keyof Population)) {
            throw new Error(`Unknown worker category for ${name}: ${key}`);
        }
    }

    const adjustedWorkerRequirement = adjustWorkerRequirements(workerRequirement, options ?? {}, method);
    const adjustedGoodsRequirements = adjustGoodsRequirements(goodsRequirements, options ?? {}, method);

    // BT-driven levels (no compounding constraint math)
    const inputLevel = decisions.stopProduction ? 0 : 1;
    const effMult = method?.efficiencyMultiplier ?? 1;
    if(!Number.isFinite(effMult) || effMult <= 0) {
        throw new Error(
            `Invalid efficiency multiplier for selected production method: ${effMult}`,
        );
    }
    const outputLevel = decisions.stopProduction ? 0 : techMultiplier * effMult;

    if(!Number.isFinite(outputLevel) || outputLevel < 0) {
        throw new Error(`Invalid output level for ${name}: ${outputLevel}`);
    }

    const { inputCost, laborCost } = calculateCosts(
        adjustedWorkerRequirement,
        adjustedGoodsRequirements,
        prices,
        salaries,
        inputLevel,
    );

    if(
        !Number.isFinite(inputCost) ||
        inputCost < 0 ||
        !Number.isFinite(laborCost) ||
        laborCost < 0
    ) {
        throw new Error(`Invalid operating costs for ${name}: inputCost=${inputCost}, laborCost=${laborCost}`);
    }

    // Capital goods scaling: more capital = more employable workers, less = fewer
    // Calculated before budget so the capital-adjusted input cost is accounted for.
    let capitalRatio = 1;
    const capitalGoods = effective.capitalGoods ?? {};
    if(Object.keys(capitalGoods).length > 0) {
        capitalRatio = Infinity;
        for(const [goodKey, requiredPerUnit] of Object.entries(capitalGoods)) {
            const gKey = goodKey as keyof Goods;
            const stock = capitalStock[gKey] ?? 0;
            const req = requiredPerUnit ?? 0;

            if(!Number.isFinite(stock) || stock < 0) {
                throw new Error(`Invalid capital stock for ${name}/${gKey}: ${stock}`);
            }
            if(!Number.isFinite(req) || req < 0) {
                throw new Error(`Invalid capital requirement for ${name}/${gKey}: ${req}`);
            }

            const ratio = req > 0 ? stock / req : Infinity;
            capitalRatio = Math.min(capitalRatio, ratio);
        }
        if(capitalRatio === Infinity) capitalRatio = 1;
    }

    const capitalMult = capitalMultiplierFromRatio(capitalRatio);

    // Total operating cost: inputs + wages, capital-adjusted.
    // The budget must cover both goods purchases and wage payments.
    const totalOperatingCostAtFullScale = (inputCost + laborCost) * capitalMult;

    // Input + labor affordability: operating cash only — investment money is
    // reserved for capital purchases and must not silently subsidize operations.
    const budgetRatio = totalOperatingCostAtFullScale > 0
        ? Math.min(1, sectorMoney / totalOperatingCostAtFullScale)
        : 1;

// Essential sectors get a minimum budget floor to ensure they can produce
	// even with low money (treasury subsidies will cover the deficit).
	// Only applies if sector has enough money for at least the minimum floor.
	const ESSENTIAL_SECTORS = new Set([
		"powerPlant",
		"waterTreatment",
		"healthcare",
		"education",
		"lawEnforcement",
		"governance",
		"logistics",
		"government",
	]);
	const minBudgetRatio = ESSENTIAL_SECTORS.has(name) ? 0.5 : 0;
	const minRequiredMoney = minBudgetRatio * totalOperatingCostAtFullScale;
	// Only apply min floor if sector has money for at least that level of production
	const effectiveBudgetRatio = sectorMoney >= minRequiredMoney
		? Math.max(budgetRatio, minBudgetRatio)
		: budgetRatio;

    const scaledWorkerDemand = scaleLaborDemand(adjustedWorkerRequirement, inputLevel);

    const capitalAdjustedWorkerDemand: Record<string, number> = {};
    for(const [key, value] of Object.entries(scaledWorkerDemand)) {
        capitalAdjustedWorkerDemand[key] = value * capitalMult;
    }

    return {
        name: name as string,
        level: 1,
        budgetRatio: effectiveBudgetRatio,
        actualScale: effectiveBudgetRatio,
        inputCost,
        laborCost,
        capitalMultiplier: capitalMult,
        idealWorkerDemand: capitalAdjustedWorkerDemand,
        idealGoodsDemand: scaleMap(adjustedGoodsRequirements, inputLevel * capitalMult),
        idealGoodsProduction: scaleMap(goodsProduction as Record<string, number>, outputLevel * capitalMult),
        nonEssentialGoods,
        outputLevel,
        inputLevel,
    };
}
