import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { getPrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
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
import { createSectorTree, buildBlackboard } from "../systems/sectorBehaviorTree/sectorTree";
import { createIndustryTree } from "./industryBehaviorTree/industryTree";
import { defaultIndustryBlackboard } from "./industryBehaviorTree/industryBT";
import { computePopulationConsumption, computeBidConstraints, buySectorInputs, distributePopulationSpending, computeColonyGoodsDelta } from "./industryTickHelpers";

const lastResults = new Map<string, IndustryTickResult>();
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();
const colonyWageMemory = new Map<string, Partial<Record<keyof Population, number>>>();

const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);

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

    const { populationConsumption, populationUpdates, populationProfits } = computePopulationConsumption(
        population,
        adjustedSalaries,
        prices,
    );

    const last = results.get(entityId);
    const previousSectorProfits: Record<string, number> = last?.sectorProfits ?? {};
    const previousSectorRevenue: Record<string, number> = last?.sectorRevenue ?? {};
    const previousSectorLaborCosts: Record<string, number> = last?.sectorLaborCosts ?? {};
    const previousSectorInputCosts: Record<string, number> = last?.sectorInputCosts ?? {};
    const previousSectorUtilization: Record<string, number> = last?.sectorUtilization ?? {};

    const sectorBids: SectorBid[] = [];

    const industryBlackboard = defaultIndustryBlackboard(entityId, settlementType);

    // Aggregate sector data from previous tick
    for(const name of activeSectors) {
        industryBlackboard.sectorProfits[name] = previousSectorProfits[name] ?? 0;
        industryBlackboard.sectorRevenue[name] = previousSectorRevenue[name] ?? 0;
        industryBlackboard.sectorLaborCosts[name] = previousSectorLaborCosts[name] ?? 0;
        industryBlackboard.sectorUtilization[name] = previousSectorUtilization[name] ?? 0;
        industryBlackboard.totalSectorProfits += previousSectorProfits[name] ?? 0;
        industryBlackboard.totalSectorRevenue += previousSectorRevenue[name] ?? 0;
        industryBlackboard.totalSectorLaborCosts += previousSectorLaborCosts[name] ?? 0;
        industryBlackboard.totalSectorInputCosts += previousSectorInputCosts[name] ?? 0;
    }

    // Aggregate money
    for(const name of activeSectors) {
        industryBlackboard.totalMoney += startingMoney[name] ?? 0;
    }

    // Aggregate population
    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        industryBlackboard.totalPopulation += pop.number;
        if(key === "worker") {
            industryBlackboard.totalFreeWorkers = pop.number; // will be refined below
        }
    }

    // Colony goods state (production/requirements refined after executeSectors)
    industryBlackboard.colonyGoods = { ...goods };
    industryBlackboard.colonyGoodsProduction = {};
    industryBlackboard.colonyGoodsRequirements = {};

    // Wages
    for(const [key, wage] of Object.entries(adjustedSalaries)) {
        industryBlackboard.wages[key] = wage;
    }

    const industryTree = createIndustryTree(industryBlackboard);
    industryTree.tick(industryBlackboard);

    let investRemaining = industryBlackboard.investTotal;

    for(const name of activeSectors) {
        if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && !allowedSectorsSet.has(name)) {
            continue;
        }

        // Industry-wide emergency stop: skip all sectors
        if(industryBlackboard.emergencyStopAll) {
            continue;
        }

        // Industry-wide sector shutdown: skip unprofitable sectors
        if(industryBlackboard.shutdownSectors.has(name)) {
            continue;
        }

        // Run behavior tree to make sector-level decisions
        const config = industrySectorBlueprints.get(name as keyof IndustrialSectors);
        const sectorMoney = startingMoney[name] ?? 0;
        const investPriority = industryBlackboard.investmentPriority[name] ?? 0.5;
        const blackboard = buildBlackboard(
            name,
            sectorMoney,
            capitalStock[name] ?? {},
            previousSectorProfits[name] ?? 0,
            previousSectorRevenue[name] ?? 0,
            previousSectorLaborCosts[name] ?? 0,
            previousSectorInputCosts[name] ?? 0,
            previousSectorUtilization[name] ?? 0,
            laborAssigned[name] ?? 0,
            population.worker.number,
            prices,
            adjustedSalaries,
            {}, // workerMarketRatios not yet computed at this stage
            config?.capitalGoods,
            config?.workerRequirement,
            config?.goodsProduction,
            0, // outputLevel
            0, // inputLevel
            investPriority,
            investRemaining,
        );
        const tree = createSectorTree(blackboard);
        tree.tick(blackboard);

        // Track remaining investment budget across sectors
        investRemaining = blackboard.investRemaining;

        // Apply behavior tree decisions
        if(blackboard.decisions.stopProduction) {
            continue; // skip this sector entirely
        }

        const techMultiplier = techMultipliers[name] ?? 1;
        let laborAssignedVal = blackboard.decisions.laborAssigned > 0
            ? blackboard.decisions.laborAssigned
            : (laborAssigned[name] ?? 0);
        const capitalStockVal = capitalStock[name] ?? {};

        const bid = buildSectorBid(name, prices, techMultiplier, laborAssignedVal, capitalStockVal, adjustedSalaries, previousSectorProfits[name] ?? 0, blackboard.decisions, {
            workerEfficiencyMultipliers,
            materialRequirementMultipliers,
            capitalMultipliers,
            selectedMethod: selectedMethod[name] ?? null,
            sectorStartingMoney: startingMoney[name] ?? 0,
        });
        if(bid) {
            sectorBids.push(bid);
        }
    }

    const { workerMarketRatios, goodsMarketRatios } = calculateMarketRatios(sectorBids, population, goods);

    updateWageMemory(wageMemory, workerMarketRatios);
    colonyWageMemory.set(entityId, wageMemory);

    let newMoney: Record<string, number> = { ...startingMoney };

    const updatedSectorGoodsBeforeExec: Record<keyof IndustrialSectors, Goods> = { ...sectorGoods };

    // Compute market constraint per bid so sectors only buy what they can actually consume.
    // Without this, sectors buy inputs at full bid scale but execute at actualScale (which may be 0 due to bottlenecks),
    // draining money on inputs that sit unused in inventory.
    const bidConstraints = computeBidConstraints(
        sectorBids,
        workerMarketRatios,
        goodsMarketRatios,
        updatedSectorGoodsBeforeExec,
    );

    // Sectors buy input goods from colony pool using their own money
    const { colonyGoodsAfterPurchase } = buySectorInputs(
        sectorBids,
        bidConstraints,
        goods,
        updatedSectorGoodsBeforeExec,
        newMoney,
        prices,
    );

    const {
        sectorResults,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
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

    // Sector money: revenue minus labor costs go into per-sector money pools.
    // Input costs were already deducted during the buying loop above, so we add
    // revenue - laborCosts (not full profit which re-subtracts input costs).
    for(const bid of sectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const revenue = sectorRevenue[sectorName] ?? 0;
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue - laborCosts;
    }

    newMoney = distributePopulationSpending(
        sectorBids,
        sectorResults,
        populationConsumption,
        prices,
        newMoney,
    );

    // Capital wear, decay, replenishment, investment
    const { newCapitalStock, replenishmentDelta } = processCapital(
        activeSectors,
        capitalStock,
        sectorResults,
        prices,
        newMoney
    );

    const colonyGoodsDelta = computeColonyGoodsDelta(
        goods,
        colonyGoodsAfterPurchase,
        activeSectors,
        sectorResults,
        replenishmentDelta,
        prices,
        updatedSectorGoods,
    );

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
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        populationProfits,
        sectorUtilization,
        wages: adjustedSalaries,
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

    const sectorRevenueDiff = shallowDiff(last?.sectorRevenue, result.sectorRevenue);
    if(sectorRevenueDiff) { patch.sectorRevenue = sectorRevenueDiff; hasChanged = true; }

    const wagesDiff = shallowDiff(last?.wages, result.wages);
    if(wagesDiff) { patch.wages = wagesDiff; hasChanged = true; }

    const sectorLaborCostsDiff = shallowDiff(last?.sectorLaborCosts, result.sectorLaborCosts);
    if(sectorLaborCostsDiff) { patch.sectorLaborCosts = sectorLaborCostsDiff; hasChanged = true; }

    const sectorInputCostsDiff = shallowDiff(last?.sectorInputCosts, result.sectorInputCosts);
    if(sectorInputCostsDiff) { patch.sectorInputCosts = sectorInputCostsDiff; hasChanged = true; }

    const popProfitsDiff = shallowDiff(last?.populationProfits, result.populationProfits);
    if(popProfitsDiff) { patch.populationProfits = popProfitsDiff; hasChanged = true; }

    const sectorUtilDiff = shallowDiff(last?.sectorUtilization, result.sectorUtilization);
    if(sectorUtilDiff) { patch.sectorUtilization = sectorUtilDiff; hasChanged = true; }

    const capitalStockDiff = shallowDiff(last?.capitalStock, result.capitalStock);
    if(capitalStockDiff) { patch.capitalStock = capitalStockDiff; hasChanged = true; }

    const sectorGoodsDiff = shallowDiff(last?.sectorGoods, result.sectorGoods);
    if(sectorGoodsDiff) { patch.sectorGoods = sectorGoodsDiff; hasChanged = true; }

    const moneyDiff = shallowDiff(last?.money, result.money);
    if(moneyDiff) { patch.money = moneyDiff; hasChanged = true; }

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

    for(const entityId of colonyWageMemory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            colonyWageMemory.delete(entityId);
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
