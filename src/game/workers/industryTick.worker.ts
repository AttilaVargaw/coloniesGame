import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { getPrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { getGoodRequirementsAndQoL, getRequirementsForQol, Population, PopulationBreakdown } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { populationGrowth } from "../data/populationHelpers";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorBid } from "./SectorBid";
import type { IndustryTickInput } from "./IndustryTickInput";
import type { IndustryTickPatch } from "./IndustryTickPatch";
import type { IndustryTickResult } from "./IndustryTickResult";
import { shallowDiff } from "./shallowDiff";
import { populationDiff } from "./populationDiff";
import { populationUpdateDiff } from "./populationUpdateDiff";
import { buildSectorBid } from "./buildSectorBid";
import { executeSectors } from "./sectorExecution";
import { buildSectorResultsPatch } from "./sectorResultsPatch";
import { buildAdjustedSalaries, updateWageMemory } from "./wageSystem";
import { processCapital } from "./capitalSystem";

const lastResults = new Map<string, IndustryTickResult>();
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();
const colonyWageMemory = new Map<string, Partial<Record<keyof Population, number>>>();

const qolSmoothing = 0.03;
const wealthSmoothing = 0.5;
const expectedQolSmoothing = 0.03;
const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;
const maxDailyChangeSmoothing = 0.001;

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);

const extraRequirements = {
    student: { education: 1 },
    retired: { healthcare: 2 }
} as Readonly<Record<keyof Population, Partial<Goods>>>;

const BUY_BUFFER_TICKS = 5;
const KEEP_BUFFER_RATIO = 0.5;

function processIndustry(
    {
        entityId,
        activeSectors,
        goods,
        population,
        allowedSectors,
        techMultipliers,
        laborAssigned,
        capitalStock,
        money: startingMoney,
        sectorGoods,
        settlementType,
        workerEfficiencyMultipliers,
        materialRequirementMultipliers,
        capitalMultipliers,
        selectedMethod,
        sectorInvestment,
    }: IndustryTickInput,
    priceMemory: Map<string, Partial<Record<keyof Goods, number>>>,
    results: Map<string, IndustryTickResult>
): IndustryTickPatch | null {
    const memory = priceMemory.get(entityId) || {};
    const prices = getPrices(goods, memory);
    priceMemory.set(entityId, memory);

    const wageMemory = colonyWageMemory.get(entityId) || {};
    const adjustedSalaries = buildAdjustedSalaries(wageMemory);

    const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

    const populationConsumption = {} as Partial<Goods>;
    const populationUpdates: IndustryTickResult["populationUpdates"] = {} as IndustryTickResult["populationUpdates"];
    const populationProfits: Record<string, number> = {};

    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        const { qol: targetQol } = getGoodRequirementsAndQoL(
            adjustedSalaries[key],
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

        const income = adjustedSalaries[key] * pop.number;
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

    const last = results.get(entityId);
    const previousSectorProfits: Record<string, number> = last?.sectorProfits ?? {};

    const sectorBids: SectorBid[] = [];
    for(const name of activeSectors) {
        if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && !allowedSectorsSet.has(name)) {
            continue;
        }

        const techMultiplier = techMultipliers[name] ?? 1;
        const laborAssignedVal = laborAssigned[name] ?? 0;
        const capitalStockVal = capitalStock[name] ?? {};

        const bid = buildSectorBid(name, prices, techMultiplier, laborAssignedVal, capitalStockVal, adjustedSalaries, previousSectorProfits[name] ?? 0, {
            workerEfficiencyMultipliers,
            materialRequirementMultipliers,
            capitalMultipliers,
            selectedMethod: selectedMethod[name] ?? null,
            sectorInvestment: sectorInvestment[name] ?? 0,
            sectorStartingMoney: startingMoney[name] ?? 0,
        });
        if(bid) {
            sectorBids.push(bid);
        }
    }

    const { workerMarketRatios, goodsMarketRatios } = calculateMarketRatios(sectorBids, population, goods);

    updateWageMemory(wageMemory, workerMarketRatios);
    colonyWageMemory.set(entityId, wageMemory);

    const newMoney: Record<string, number> = { ...startingMoney };

    // Sectors buy input goods from colony pool using their own money
    const colonyGoodsAfterPurchase = { ...goods };
    const updatedSectorGoodsBeforeExec: Record<keyof IndustrialSectors, Goods> = { ...sectorGoods };
    for(const bid of sectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const config = industrySectorBlueprints.get(sectorName);
        if(!config?.goodsRequirements) continue;

        const sectorInv = { ...(updatedSectorGoodsBeforeExec[sectorName] ?? createStarterWarehouse(0)) };
        let sectorMoney = newMoney[sectorName] ?? 0;

        for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
            if(demandPerTick <= 0) continue;

            const demand = demandPerTick * BUY_BUFFER_TICKS;
            const available = colonyGoodsAfterPurchase[goodKey as keyof Goods] ?? 0;
            const price = prices[goodKey as keyof Goods] ?? 0;
            if(available <= 0 || price <= 0) continue;

            const canAfford = Math.floor(sectorMoney / price);
            const toBuy = Math.min(demand, available, canAfford);
            if(toBuy <= 0) continue;

            sectorMoney -= toBuy * price;
            colonyGoodsAfterPurchase[goodKey as keyof Goods] = Math.max(0, available - toBuy);
            sectorInv[goodKey as keyof Goods] = (sectorInv[goodKey as keyof Goods] ?? 0) + toBuy;
        }

        newMoney[sectorName] = sectorMoney;
        updatedSectorGoodsBeforeExec[sectorName] = sectorInv;
    }

    const {
        sectorResults,
        sectorProfits,
        sectorUtilization,
        workingWorkers,
        remainingWorkers,
        sectorGoods: updatedSectorGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    } = executeSectors(
        sectorBids,
        workerMarketRatios,
        goodsMarketRatios,
        population,
        updatedSectorGoodsBeforeExec,
        prices,
        adjustedSalaries
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

    // Sector profits go into per-sector money pools
    for(const [sectorName, profit] of Object.entries(sectorProfits)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + profit;
    }

    // Move goods between sectors and colony pool
    const colonyGoodsDelta: Partial<Goods> = { ...createStarterWarehouse(0) };

    for(const goodKey of Object.keys(goods)) {
        const bought = (goods[goodKey as keyof Goods] ?? 0) - (colonyGoodsAfterPurchase[goodKey as keyof Goods] ?? 0);
        if(bought > 0) {
            colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) - bought;
        }
    }

    for(const name of activeSectors) {
        const sectorResult = sectorResults[name];
        if(!sectorResult || sectorResult.productionRatio <= 0) continue;

        for(const [goodKey, amount] of Object.entries(sectorResult.producedGoods)) {
            if(amount > 0) {
                const keep = Math.floor(amount * KEEP_BUFFER_RATIO);
                const sell = amount - keep;
                if(sell > 0) {
                    colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) + sell;
                }
                const sectorInv = { ...(updatedSectorGoods[name] ?? createStarterWarehouse(0)) };
                sectorInv[goodKey as keyof Goods] = (sectorInv[goodKey as keyof Goods] ?? 0) + keep;
                updatedSectorGoods[name] = sectorInv;
            }
        }
    }

    // Capital wear, decay, replenishment, investment
    const { newCapitalStock, replenishmentDelta } = processCapital(
        activeSectors,
        capitalStock,
        sectorResults,
        prices,
        newMoney
    );

    // Merge capital replenishment into colony goods delta
    for(const [goodKey, amount] of Object.entries(replenishmentDelta)) {
        colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) + amount;
    }

    // Apply colony goods changes
    const colonyGoodsProduction = { ...createStarterWarehouse(0) };
    const colonyGoodsRequirements = { ...createStarterWarehouse(0) };
    for(const [key, value] of Object.entries(colonyGoodsDelta)) {
        if(value > 0) {
            colonyGoodsProduction[key as keyof Goods] = value;
        } else if(value < 0) {
            colonyGoodsRequirements[key as keyof Goods] = Math.abs(value);
        }
    }
    const colonyGoodsChanges = finalizeGoods(goods, colonyGoodsProduction, colonyGoodsRequirements, populationConsumption, population);

    const result: IndustryTickResult = {
        entityId,
        goodsRequirements: { ...sumGoodsRequirements, ...populationConsumption },
        goodsProduction: sumGoodsProduction,
        workingWorkers: workingWorkers as Population,
        freeWorkers: remainingWorkers,
        populationUpdates,
        goods: colonyGoodsChanges,
        sectorProfits,
        populationProfits,
        sectorUtilization,
        sectorResults,
        capitalStock: newCapitalStock,
        money: newMoney,
        sectorGoods: updatedSectorGoods,
        settlementType,
        allowedSectors,
    };

    const patch = buildPatch(last, result);
    if(patch) {
        return patch;
    }

    results.set(entityId, result);
    return null;
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

function finalizeGoods(
    currentGoods: Goods,
    sumGoodsProduction: Goods,
    sumGoodsRequirements: Goods,
    populationConsumption: Partial<Goods>,
    population: Population
): Goods {
    const finalGoods = { ...currentGoods } as Goods;

    for(const key in sumGoodsProduction) {
        const goodKey = key as keyof Goods;
        finalGoods[goodKey] = (finalGoods[goodKey] ?? 0) + (sumGoodsProduction[goodKey] ?? 0);
    }

    for(const key in sumGoodsRequirements) {
        const goodKey = key as keyof Goods;
        finalGoods[goodKey] = Math.max(0, (finalGoods[goodKey] ?? 0) - (sumGoodsRequirements[goodKey] ?? 0));
    }

    for(const key in populationConsumption) {
        const goodKey = key as keyof Goods;
        finalGoods[goodKey] = Math.max(0, (finalGoods[goodKey] ?? 0) - (populationConsumption[goodKey] ?? 0));
    }

    const totalPopulation = Object.values(population).reduce((sum, pop) => sum + pop.number, 0);
    const populationWaste = totalPopulation * wastePerPerson;

    finalGoods.waste = Math.max(0, (finalGoods.waste || 0) + populationWaste - wasteDecayRate * (currentGoods.waste || 0));

    for(const key in finalGoods) {
        const goodKey = key as keyof Goods;
        if(NON_CUMULATING_GOODS.has(goodKey)) {
            finalGoods[goodKey] = Math.max(0, finalGoods[goodKey] ?? 0);
        }
    }

    return finalGoods;
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

    const capitalStockDiff = shallowDiff(last?.capitalStock, result.capitalStock);
    if(capitalStockDiff) { patch.capitalStock = capitalStockDiff; hasChanged = true; }

    const sectorGoodsDiff = shallowDiff(last?.sectorGoods, result.sectorGoods);
    if(sectorGoodsDiff) { patch.sectorGoods = sectorGoodsDiff; hasChanged = true; }

    const sectorResultsPatch = buildSectorResultsPatch(last?.sectorResults, result.sectorResults);
    if(sectorResultsPatch) { patch.sectorResults = sectorResultsPatch; hasChanged = true; }

    return hasChanged ? patch : null;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[] }>) => {
    if(event.data.type !== "tick") {
        return;
    }

    const activeEntityIds = new Set<string>();
    for(const industry of event.data.industries) {
        activeEntityIds.add(industry.entityId);
    }

    for(const entityId of colonyPriceMemory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            colonyPriceMemory.delete(entityId);
        }
    }

    for(const entityId of lastResults.keys()) {
        if(!activeEntityIds.has(entityId)) {
            lastResults.delete(entityId);
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
