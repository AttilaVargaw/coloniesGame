import { industrySectorBlueprints } from "../systems/factoryBlueprints";
import { baseSalaries, getGoodRequirementsAndQoL, getRequirementsForQol, Population, PopulationBreakdown } from "../data/Population";
import { getPrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { populationGrowth } from "../data/populationHelpers";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { IndustryTickInput } from "./IndustryTickInput";
import { IndustryTickPatch } from "./IndustryTickPatch";
import { IndustryTickResult } from "./IndustryTickResult";
import { SectorBid } from "./SectorBid";
import { SectorExecutionResult } from "./SectorExecutionResult";

const lastResults = new Map<string, IndustryTickResult>();

function shallowDiff<T extends Record<string, number>>(oldObj: T | undefined, newObj: T): Partial<T> | null {
    if(!oldObj) return newObj;
    const changed: Partial<T> = {};
    let hasChanged = false;
    for(const key in newObj) {
        if(oldObj[key as keyof T] !== newObj[key as keyof T]) {
            changed[key as keyof T] = newObj[key as keyof T];
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}

function populationGroupDiff(old: PopulationBreakdown | undefined, newGroup: PopulationBreakdown): Partial<PopulationBreakdown> | null {
    if(!old) return newGroup as Partial<PopulationBreakdown>;
    const changed: Partial<PopulationBreakdown> = {};
    let hasChanged = false;
    for(const key in newGroup) {
        if(old[key as keyof PopulationBreakdown] !== newGroup[key as keyof PopulationBreakdown]) {
            changed[key as keyof PopulationBreakdown] = newGroup[key as keyof PopulationBreakdown];
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}

function populationDiff(old: Population | undefined, newPop: Population): Partial<Population> | null {
    if(!old) return newPop as Partial<Population>;
    const changed: Partial<Population> = {};
    let hasChanged = false;
    for(const key in newPop) {
        const oldGroup = old[key as keyof Population];
        const newGroup = newPop[key as keyof Population];
        const groupDiff = populationGroupDiff(oldGroup, newGroup);
        if(groupDiff) {
            changed[key as keyof Population] = groupDiff as PopulationBreakdown;
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}

function shallowObjectsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if(keysA.length !== keysB.length) return false;
    for(const key of keysA) {
        if(a[key] !== b[key]) return false;
    }
    return true;
}

function sectorResultChanged(old: SectorResult, newSector: SectorResult): boolean {
    if(old.productionRatio !== newSector.productionRatio) return true;
    if(old.inputLevel !== newSector.inputLevel) return true;
    if(old.outputLevel !== newSector.outputLevel) return true;
    if(!shallowObjectsEqual(old.consumedGoods, newSector.consumedGoods)) return true;
    if(!shallowObjectsEqual(old.producedGoods, newSector.producedGoods)) return true;
    if(!shallowObjectsEqual(old.workersEmployed, newSector.workersEmployed)) return true;
    return false;
}

function buildSectorResultsPatch(old: Record<string, SectorResult> | undefined, newResults: Record<string, SectorResult>): { changed: Record<string, SectorResult>; removed: string[] } | null {
    const changed: Record<string, SectorResult> = {};
    const removed: string[] = [];
    let hasChanged = false;

    for(const key in newResults) {
        const oldSector = old?.[key];
        const newSector = newResults[key];
        if(!oldSector || sectorResultChanged(oldSector, newSector)) {
            changed[key] = newSector;
            hasChanged = true;
        }
    }

    if(old) {
        for(const key in old) {
            if(!(key in newResults)) {
                removed.push(key);
                hasChanged = true;
            }
        }
    }

    return hasChanged ? { changed, removed } : null;
}

function populationUpdateDiff(old: IndustryTickResult["populationUpdates"][keyof Population], newUpdate: IndustryTickResult["populationUpdates"][keyof Population]): boolean {
    if(old.qol !== newUpdate.qol) return true;
    if(old.expectedQol !== newUpdate.expectedQol) return true;
    if(old.populationChange !== newUpdate.populationChange) return true;
    if(old.wealth !== newUpdate.wealth) return true;
    if(old.number !== newUpdate.number) return true;
    if(!shallowObjectsEqual(old.requirements, newUpdate.requirements)) return true;
    return false;
}

function buildPatch(last: IndustryTickResult | undefined, result: IndustryTickResult): IndustryTickPatch | null {
    const patch: IndustryTickPatch = { entityId: result.entityId };
    let hasChanged = false;

    const goodsDiff = shallowDiff(last?.goods, result.goods);
    if(goodsDiff) { patch.goods = goodsDiff; hasChanged = true; }

    const goodsReqDiff = shallowDiff(last?.goodsRequirements, result.goodsRequirements);
    if(goodsReqDiff) { patch.goodsRequirements = goodsReqDiff; hasChanged = true; }

    const goodsProdDiff = shallowDiff(last?.goodsProduction, result.goodsProduction);
    if(goodsProdDiff) { patch.goodsProduction = goodsProdDiff; hasChanged = true; }

    const workingWorkersDiff = populationDiff(last?.workingWorkers, result.workingWorkers);
    if(workingWorkersDiff) { patch.workingWorkers = workingWorkersDiff; hasChanged = true; }

    const freeWorkersDiff = populationDiff(last?.freeWorkers, result.freeWorkers);
    if(freeWorkersDiff) { patch.freeWorkers = freeWorkersDiff; hasChanged = true; }

    if(last?.populationUpdates !== result.populationUpdates) {
        const updatedPop: IndustryTickPatch["populationUpdates"] = {};
        let popChanged = false;
        for(const key in result.populationUpdates) {
            const oldUpdate = last?.populationUpdates[key as keyof Population];
            const newUpdate = result.populationUpdates[key as keyof Population];
            if(!oldUpdate || populationUpdateDiff(oldUpdate, newUpdate)) {
                updatedPop[key as keyof Population] = newUpdate;
                popChanged = true;
            }
        }
        if(popChanged) {
            patch.populationUpdates = updatedPop;
            hasChanged = true;
        }
    }

    const sectorProfitsDiff = shallowDiff(last?.sectorProfits, result.sectorProfits);
    if(sectorProfitsDiff) { patch.sectorProfits = sectorProfitsDiff; hasChanged = true; }

    const popProfitsDiff = shallowDiff(last?.populationProfits, result.populationProfits);
    if(popProfitsDiff) { patch.populationProfits = popProfitsDiff; hasChanged = true; }

    const sectorUtilDiff = shallowDiff(last?.sectorUtilization, result.sectorUtilization);
    if(sectorUtilDiff) { patch.sectorUtilization = sectorUtilDiff; hasChanged = true; }

    const sectorResultsPatch = buildSectorResultsPatch(last?.sectorResults, result.sectorResults);
    if(sectorResultsPatch) { patch.sectorResults = sectorResultsPatch; hasChanged = true; }

    return hasChanged ? patch : null;
}

const qolSmoothing = 0.03;
const wealthSmoothing = 0.5;
const expectedQolSmoothing = 0.03;
const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;
const maxDailyChangeSmoothing = 0.001

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();

const extraRequirements = {
    student: {
        education: 1
    },
    retired: {
        healthcare: 2
    }
} as Readonly<Record<keyof Population, Partial<Goods>>>

function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
): SectorBid | null {
    const config = industrySectorBlueprints.get(name);
    if(!config) return null;

    const outputLevel = techMultiplier;
    const inputLevel = 1;

    const workerRequirement = config.workerRequirement || {};
    const goodsRequirements = config.goodsRequirements || {};
    const goodsProduction = config.goodsProduction || {};

    const inputCost = Object.entries(goodsRequirements).reduce((sum, [key, value]) => {
        return sum + (value as number) * prices[key as keyof Goods];
    }, 0);

    const laborCost = Object.entries(workerRequirement).reduce((sum, [key, value]) => {
        return sum + (value as number) * baseSalaries[key as keyof Population];
    }, 0);

    const costPerUnit = inputCost + laborCost;
    const budgetRatio = costPerUnit > 0 ? Math.min(1, Math.max(0, 1)) : 1;

    // Apply laborAssigned as a hard cap on worker demand
    const idealWorkerDemand = Object.fromEntries(
        Object.entries(workerRequirement).map(([k, v]) => [k, (v as number) * inputLevel])
    ) as Partial<Record<keyof Population, number>>;

    // If laborAssigned is set, scale worker demand down proportionally
    let totalWorkerDemand = 0;
    for(const v of Object.values(idealWorkerDemand)) {
        totalWorkerDemand += v as number;
    }
    let laborScale = 1;
    if(laborAssigned > 0 && totalWorkerDemand > 0) {
        laborScale = Math.min(1, laborAssigned / totalWorkerDemand);
    }

    const scaledWorkerDemand = Object.fromEntries(
        Object.entries(idealWorkerDemand).map(([k, v]) => [k, (v as number) * laborScale])
    ) as Partial<Record<keyof Population, number>>;

    return {
        name: name as string,
        level: 1,
        budgetRatio,
        inputCost: inputCost * inputLevel,
        laborCost: laborCost * inputLevel,
        idealWorkerDemand: scaledWorkerDemand,
        idealGoodsDemand: Object.fromEntries(
            Object.entries(goodsRequirements).map(([k, v]) => [k, (v as number) * inputLevel])
        ) as Partial<Record<keyof Goods, number>>,
        idealGoodsProduction: Object.fromEntries(
            Object.entries(goodsProduction).map(([k, v]) => [k, (v as number) * outputLevel])
        ) as Partial<Record<keyof Goods, number>>,
        outputLevel,
        inputLevel,
    };
}

function calculateMarketRatios(
    sectorBids: SectorBid[],
    population: Population,
    goods: Goods
): { workerMarketRatios: Record<keyof Population, number>; goodsMarketRatios: Record<keyof Goods, number> } {
    const totalIdealWorkerDemand = {} as Record<keyof Population, number>;
    const totalIdealGoodsDemand = {} as Record<keyof Goods, number>;

    for(const bid of sectorBids) {
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            totalIdealWorkerDemand[key as keyof Population] = (totalIdealWorkerDemand[key as keyof Population] ?? 0) + value;
        }
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            totalIdealGoodsDemand[key as keyof Goods] = (totalIdealGoodsDemand[key as keyof Goods] ?? 0) + value;
        }
    }

    const workerMarketRatios = {} as Record<keyof Population, number>;
    for(const [key, totalDemand] of Object.entries(totalIdealWorkerDemand)) {
        const available = population[key as keyof Population].number;
        workerMarketRatios[key as keyof Population] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
    }

    const goodsMarketRatios = {} as Record<keyof Goods, number>;
    for(const [key, totalDemand] of Object.entries(totalIdealGoodsDemand)) {
        const available = Math.max(0, goods[key as keyof Goods]);
        goodsMarketRatios[key as keyof Goods] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
    }

    return { workerMarketRatios, goodsMarketRatios };
}

function executeSectors(
    sectorBids: SectorBid[],
    workerMarketRatios: Record<keyof Population, number>,
    goodsMarketRatios: Record<keyof Goods, number>,
    population: Population,
    goods: Goods,
    prices: Record<keyof Goods, number>
): SectorExecutionResult {
    const sumGoodsRequirements = createStarterWarehouse(0);
    const sumGoodsProduction = createStarterWarehouse(0);
    const workingWorkers = createStarterPopulation(0);
    const remainingWorkers = structuredClone(population);
    const remainingGoods = { ...goods };

    const sectorResults: Record<string, SectorResult> = {};
    const sectorProfits: Record<string, number> = {};
    const sectorUtilization: Record<string, number> = {};

    for(const bid of sectorBids) {
        let marketConstraint = 1;
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            if(value > 0) {
                marketConstraint = Math.min(marketConstraint, workerMarketRatios[key as keyof Population] ?? 1);
            }
        }
        const sectorConfig = industrySectorBlueprints.get(bid.name as keyof IndustrialSectors);
        const nonEssentialGoods = new Set<keyof Goods>((sectorConfig?.nonEssentialGoods || sectorConfig?.optionalGoods || []) as (keyof Goods)[]);
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            if(value > 0) {
                const ratio = goodsMarketRatios[key as keyof Goods] ?? 1;
                if(nonEssentialGoods.has(key as keyof Goods)) {
                    marketConstraint = Math.min(marketConstraint, 0.25 + 0.75 * ratio);
                } else {
                    marketConstraint = Math.min(marketConstraint, ratio);
                }
            }
        }

        const budgetRatio = bid.inputCost + bid.laborCost > 0 ? Math.min(1, Math.max(0, 1)) : 1;
        const actualScale = Math.min(budgetRatio, marketConstraint);

        if(actualScale <= 0) {
            sectorResults[bid.name] = {
                name: bid.name,
                consumedGoods: {},
                producedGoods: {},
                workersEmployed: {},
                productionRatio: 0,
                inputLevel: bid.inputLevel,
                outputLevel: bid.outputLevel,
            };
            sectorProfits[bid.name] = 0;
            continue;
        }

        const workersEmployed: Partial<Record<keyof Population, number>> = {};
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            const employed = value * actualScale;
            workersEmployed[key as keyof Population] = employed;
            remainingWorkers[key as keyof Population] = {
                ...remainingWorkers[key as keyof Population],
                number: remainingWorkers[key as keyof Population].number - employed,
            };
            workingWorkers[key as keyof Population] = {
                ...workingWorkers[key as keyof Population],
                number: workingWorkers[key as keyof Population].number + employed,
            };
        }

        const consumedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            const consumed = value * actualScale;
            consumedGoods[key as keyof Goods] = consumed;
            remainingGoods[key as keyof Goods] -= consumed;
            sumGoodsRequirements[key as keyof Goods] = (sumGoodsRequirements[key as keyof Goods] ?? 0) + consumed;
        }

        const producedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsProduction)) {
            const produced = value * actualScale;
            producedGoods[key as keyof Goods] = produced;
            remainingGoods[key as keyof Goods] += produced;
            sumGoodsProduction[key as keyof Goods] = (sumGoodsProduction[key as keyof Goods] ?? 0) + produced;
        }

        const revenue = Object.entries(producedGoods).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key as keyof Goods];
        }, 0);
        const inputCosts = Object.entries(consumedGoods).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key as keyof Goods];
        }, 0);
        const laborCosts = Object.entries(workersEmployed).reduce((sum, [key, amount]) => {
            return sum + (amount) * baseSalaries[key as keyof Population];
        }, 0);

        sectorResults[bid.name] = {
            name: bid.name,
            consumedGoods,
            producedGoods,
            workersEmployed,
            productionRatio: actualScale,
            inputLevel: bid.inputLevel,
            outputLevel: bid.outputLevel,
        };
        sectorProfits[bid.name] = revenue - inputCosts - laborCosts;
        sectorUtilization[bid.name] = actualScale;
    }

    return {
        sectorResults,
        sectorProfits,
        sectorUtilization,
        workingWorkers,
        remainingWorkers,
        remainingGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    };
}

function finalizeGoods(
    currentGoods: Goods,
    sumGoodsProduction: Goods,
    sumGoodsRequirements: Goods,
    populationConsumption: Partial<Goods>,
    population: Population
): Goods {
    const goodsRequirements = { ...sumGoodsRequirements };
    for(const key in populationConsumption) {
        goodsRequirements[key as keyof Goods] = (goodsRequirements[key as keyof Goods] ?? 0) + (populationConsumption[key as keyof Goods] ?? 0);
    }

    const goodsProduction = { ...sumGoodsProduction };
    const goodsChange = Object.entries({ ...sumGoodsProduction, ...goodsRequirements }).reduce(
        (acc, [key]) => {
            acc[key as keyof Goods] = (goodsProduction[key as keyof Goods] ?? 0) - (goodsRequirements[key as keyof Goods] ?? 0);
            return acc;
        },
        createStarterWarehouse(0)
    );

    const totalPopulation = Object.values(population).reduce((sum, pop) => sum + pop.number, 0);
    const populationWaste = totalPopulation * wastePerPerson;

    goodsChange.waste = Math.max(0, (goodsChange.waste || 0) + populationWaste - wasteDecayRate * (currentGoods.waste || 0));

    const finalGoods = { ...currentGoods } as Goods;

    for(const key in goodsChange) {
        const goodKey = key as keyof Goods;
        const delta = goodsChange[goodKey] || 0;

        if(NON_CUMULATING_GOODS.has(goodKey)) {
            finalGoods[goodKey] = Math.max(0, delta);
        } else {
            finalGoods[goodKey] = Math.max(0, (finalGoods[goodKey] ?? 0) + delta);
        }
    }

    return finalGoods;
}

function processIndustry(
    industry: IndustryTickInput,
    priceMemory: Map<string, Partial<Record<keyof Goods, number>>>,
    results: Map<string, IndustryTickResult>
): IndustryTickPatch | null {
    const { entityId, activeSectors, goods, population, techMultipliers, laborAssigned, settlementType, allowedSectors } = industry;

    const memory = priceMemory.get(entityId) || {};
    const prices = getPrices(goods, memory);
    priceMemory.set(entityId, memory);

    const currentGoods: Goods = { ...goods };
    const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

    const populationConsumption = {} as Partial<Goods>;
    const populationUpdates: IndustryTickResult["populationUpdates"] = {};
    const populationProfits: Record<string, number> = {};

    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        const { qol: targetQol } = getGoodRequirementsAndQoL(
            baseSalaries[key],
            prices,
            pop
        );

        const smoothedQol = Math.max(0, Math.min(80, pop.qol + (targetQol - pop.qol) * qolSmoothing));
        const requirements = getRequirementsForQol(smoothedQol, pop.number);

        const extra = extraRequirements[key];

        if(extra) {
            for(const [good, amount] of Object.entries(extra)) {
                requirements[good as keyof Goods] = (requirements[good as keyof Goods] ?? 0) + amount * pop.number;
            }
        }

        for(const it in requirements) {
            populationConsumption[it as keyof Goods] =
                (requirements[it as keyof Goods] ?? 0) +
                (populationConsumption[it as keyof Goods] ?? 0);
        }

        const income = baseSalaries[key] * pop.number;
        const expenses = Object.entries(requirements).reduce((sum, [good, amount]) => {
            if(!amount) return sum;
            return sum + amount * prices[good as keyof Goods];
        }, 0);

        const targetWealth = pop.wealth + income - expenses;
        const smoothedWealth = Number.isFinite(targetWealth) ? pop.wealth + (targetWealth - pop.wealth) * wealthSmoothing : pop.wealth;

        const expectedQol = (pop.expectedQol ?? smoothedQol) + (smoothedQol - (pop.expectedQol ?? smoothedQol)) * expectedQolSmoothing;

        const rawPopulationChange = populationGrowth(expectedQol) * pop.number / 365 * pop.birthRate;
        const maxDailyChange = pop.number * maxDailyChangeSmoothing;
        const clampedPopulationChange = Math.max(-maxDailyChange, Math.min(maxDailyChange, Number.isFinite(rawPopulationChange) ? rawPopulationChange : 0));
        const clampedPopulationNumber = Math.max(0, pop.number + clampedPopulationChange);

        populationUpdates[key] = {
            qol: smoothedQol,
            expectedQol,
            populationChange: clampedPopulationChange,
            wealth: Math.max(0, smoothedWealth),
            number: clampedPopulationNumber,
            requirements: requirements as Record<string, number>,
        };

        populationProfits[key] = income - expenses;
    }

    const sectorBids: SectorBid[] = [];
    for(const name of activeSectors) {
        if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && !allowedSectorsSet.has(name)) {
            continue;
        }

        const techMultiplier = techMultipliers[name] ?? 1;
        const laborAssignedVal = laborAssigned[name] ?? 0;

        const bid = buildSectorBid(name, prices, techMultiplier, laborAssignedVal);
        if(bid) {
            sectorBids.push(bid);
        }
    }

    const { workerMarketRatios, goodsMarketRatios } = calculateMarketRatios(sectorBids, population, goods);

    const {
        sectorResults,
        sectorProfits,
        sectorUtilization,
        workingWorkers,
        remainingWorkers,
        sumGoodsRequirements,
        sumGoodsProduction,
    } = executeSectors(
        sectorBids,
        workerMarketRatios,
        goodsMarketRatios,
        population,
        goods,
        prices
    );

    for(const key of alwaysWorking) {
        const key2 = key as keyof Population;

        workingWorkers[key2] = {
            ...workingWorkers[key2],
            number: population[key2].number
        };
        remainingWorkers[key as keyof Population] = {
            ...remainingWorkers[key2],
            number: 0
        };
    }

    const finalGoods = finalizeGoods(currentGoods, sumGoodsProduction, sumGoodsRequirements, populationConsumption, population);

    const result: IndustryTickResult = {
        entityId,
        goodsRequirements: { ...sumGoodsRequirements, ...populationConsumption },
        goodsProduction: sumGoodsProduction,
        workingWorkers: workingWorkers as Population,
        freeWorkers: remainingWorkers,
        populationUpdates,
        goods: finalGoods,
        sectorProfits,
        populationProfits,
        sectorUtilization,
        sectorResults,
        settlementType,
        allowedSectors,
    };

    const last = results.get(entityId);
    const patch = buildPatch(last, result);
    if(patch) {
        return patch;
    }

    results.set(entityId, result);
    return null;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[] }>) => {
    if(event.data.type !== "tick") {
        return
    }

    const activeEntityIds = new Set<string>()
    for(const industry of event.data.industries) {
        activeEntityIds.add(industry.entityId)
    }

    for(const entityId of colonyPriceMemory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            colonyPriceMemory.delete(entityId)
        }
    }

    for(const entityId of lastResults.keys()) {
        if(!activeEntityIds.has(entityId)) {
            lastResults.delete(entityId)
        }
    }

    const patches: IndustryTickPatch[] = [];

    for(const industry of event.data.industries) {
        const patch = processIndustry(industry, colonyPriceMemory, lastResults);
        if(patch) {
            patches.push(patch);
        }
    }

    self.postMessage({ type: "result", patches });
};
