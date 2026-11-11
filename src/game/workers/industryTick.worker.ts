import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { getPrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
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
import { computePopulationConsumption, buySectorInputs, distributePopulationSpending, computeColonyGoodsDelta, applyGoodsModifier, pruneMemory, trySetPatchField, computeMarketRatios } from "./industryTickHelpers";

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
        // sectorGoods,
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

    let sectorBids: SectorBid[] = [];

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

    // === ITERATIVE SECTOR ALLOCATION ===
    // Run bid → buy → execute multiple times. Each round starts with carried-forward
    // sector money, goods carry forward and are depleted, so prices get recomputed
    // to reflect real scarcity. Only the final round's results are committed downstream.
    const MAX_ITERATIONS = 3;
    const CONVERGENCE_THRESHOLD = 0.005;

    let currentGoods = { ...goods };
    let currentPrices = prices;

    let execResult: ReturnType<typeof executeSectors> | null = null;
    let newMoney: Record<string, number> = { ...startingMoney };

    for(let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const goodsBeforeIteration = { ...currentGoods };

        // Carry forward money from previous round (starts as startingMoney)
        const roundMoney: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
        for(const name of activeSectors) {
            roundMoney[name] = newMoney[name] ?? startingMoney[name] ?? 0;
        }

        let roundInvestRemaining = investRemaining;

        // === SECTOR-LEVEL BEHAVIOR TREES ===
        const roundSectorBids: SectorBid[] = [];

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
            const sectorMoney = roundMoney[name] ?? 0;
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
                currentPrices,
                adjustedSalaries,
                {}, // workerMarketRatios not yet computed at this stage
                config?.capitalGoods,
                config?.workerRequirement,
                config?.goodsProduction,
                0, // outputLevel
                0, // inputLevel
                investPriority,
                roundInvestRemaining,
            );
            const tree = createSectorTree(blackboard);
            tree.tick(blackboard);

            // Track remaining investment budget across sectors
            roundInvestRemaining = blackboard.investRemaining;

            // Apply behavior tree decisions
            if(blackboard.decisions.stopProduction) {
                continue; // skip this sector entirely
            }

            const techMultiplier = techMultipliers[name] ?? 1;
            let laborAssignedVal = blackboard.decisions.laborAssigned > 0
                ? blackboard.decisions.laborAssigned
                : (laborAssigned[name] ?? 0);
            const capitalStockVal = capitalStock[name] ?? {};

            const bid = buildSectorBid(name, currentPrices, techMultiplier, laborAssignedVal, capitalStockVal, adjustedSalaries, previousSectorProfits[name] ?? 0, blackboard.decisions, {
                workerEfficiencyMultipliers,
                materialRequirementMultipliers,
                capitalMultipliers,
                selectedMethod: selectedMethod[name] ?? null,
                sectorStartingMoney: sectorMoney,
            });
            if(bid) {
                roundSectorBids.push(bid);
            }
        }

        const { workerMarketRatios } = calculateMarketRatios(roundSectorBids, population);

        updateWageMemory(wageMemory, workerMarketRatios);
        colonyWageMemory.set(entityId, wageMemory);

        // Compute actual production scale per bid (worker + inventory constrained)
        for(const bid of roundSectorBids) {
            bid.actualScale = computeActualScale(bid, workerMarketRatios);
        }

        // Sectors buy input goods from colony pool using their own money
        const { colonyGoodsAfterPurchase, newMoney: roundNewMoney } = buySectorInputs(
            roundSectorBids,
            currentGoods,
            roundMoney,
            currentPrices,
        );
        currentGoods = colonyGoodsAfterPurchase;
        newMoney = roundNewMoney;

        // Execute sectors
        execResult = executeSectors(
            roundSectorBids,
            population,
            currentGoods,
            currentPrices,
            adjustedSalaries
        );

        // Recompute prices for next iteration based on remaining goods
        currentPrices = getPrices(currentGoods, memory);

        sectorBids = roundSectorBids;
        investRemaining = roundInvestRemaining;

        // Convergence check: stop if goods barely changed this round
        if(iteration > 0) {
            let goodsDelta = 0;
            let totalScale = 0;
            for(const key of Object.keys(currentGoods)) {
                const cur = (currentGoods as Record<string, number>)[key] ?? 0;
                const prev = (goodsBeforeIteration as Record<string, number>)[key] ?? 0;
                goodsDelta += Math.abs(cur - prev);
                totalScale += Math.abs(prev);
            }
            if(totalScale > 0 && goodsDelta / totalScale < CONVERGENCE_THRESHOLD) {
                break;
            }
        }
    }

    const {
        sectorResults,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        sectorUtilization,
        sectorStopReason,
        workingWorkers,
        remainingWorkers,
        sumGoodsRequirements,
        sumGoodsProduction,
    } = execResult!;

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
        currentPrices,
        newMoney,
    );

    // Capital wear, decay, replenishment, investment
    const { newCapitalStock, replenishmentDelta, moneySpent } = processCapital(
        activeSectors,
        capitalStock,
        sectorResults,
        currentPrices,
        newMoney
    );

    // Deduct capital costs from sector money
    for(const name of activeSectors) {
        newMoney[name] = (newMoney[name] ?? 0) - (moneySpent[name] ?? 0);
    }

    const colonyGoodsDelta = computeColonyGoodsDelta(
        goods,
        currentGoods,
        activeSectors,
        sectorResults,
        replenishmentDelta,
        currentPrices,
        // updatedSectorGoods,
    );

    // Apply colony goods changes
    const colonyGoodsProduction = createEmptyWarehouse();
    const colonyGoodsRequirements = createEmptyWarehouse();
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
        goodsRequirements: { ...sumGoodsRequirements, ...populationConsumption, ...negateReplenishmentDelta(replenishmentDelta) },
        goodsProduction: sumGoodsProduction,
        workingWorkers: workingWorkers as Population,
        freeWorkers: remainingWorkers,
        population,
        populationUpdates,
        goods: colonyGoodsChanges,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        populationProfits,
        sectorUtilization,
        sectorStopReason,
        wages: adjustedSalaries,
        sectorResults,
        capitalStock: newCapitalStock,
        money: newMoney,
        // sectorGoods: updatedSectorGoods,
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
): { workerMarketRatios: Record<keyof Population, number> } {
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

    const workerAvailable = {} as Record<keyof Population, number>;
    for(const [key, pop] of Object.entries(population)) {
        workerAvailable[key as keyof Population] = pop.number;
    }

    return {
        workerMarketRatios: computeMarketRatios(totalIdealWorkerDemand, workerAvailable),
    };
}

function computeActualScale(
    bid: SectorBid,
    workerMarketRatios: Record<keyof Population, number>,
    // sectorGoods: Record<keyof IndustrialSectors, Goods>,
): number {
    // Worker availability from global market ratio
    let workerRatio = 1;
    for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
        if(value > 0) {
            const r = workerMarketRatios[key as keyof Population] ?? 1;
            workerRatio = Math.min(workerRatio, r);
        }
    }

    // Market constraint from sector inventory
    let marketConstraint = 1;
    for(const [, value] of Object.entries(bid.idealGoodsDemand)) {
        if(value <= 0) continue;
        // const sectorInv = sectorGoods[bid.name as keyof IndustrialSectors]?.[key as keyof Goods] ?? 0;
        // marketConstraint = Math.min(marketConstraint, value > 0 ? sectorInv / value : 1);
    }

    return Math.min(bid.budgetRatio, marketConstraint, workerRatio);
}

function finalizeGoods(
    currentGoods: Goods,
    sumGoodsProduction: Goods,
    sumGoodsRequirements: Goods,
    populationConsumption: Partial<Goods>,
    population: Population
): Goods {
    const finalGoods = { ...currentGoods } as Goods;

    applyGoodsModifier(finalGoods, sumGoodsProduction, (cur, d) => cur + d);
    applyGoodsModifier(finalGoods, sumGoodsRequirements, (cur, d) => Math.max(0, cur - d));
    applyGoodsModifier(finalGoods, populationConsumption, (cur, d) => Math.max(0, cur - d));

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

    hasChanged = trySetPatchField(patch, "goods", last?.goods, result.goods, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "goodsRequirements", last?.goodsRequirements, result.goodsRequirements, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "goodsProduction", last?.goodsProduction, result.goodsProduction, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "workingWorkers", last?.workingWorkers, result.workingWorkers, populationDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "freeWorkers", last?.freeWorkers, result.freeWorkers, populationDiff) || hasChanged;

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

    hasChanged = trySetPatchField(patch, "sectorProfits", last?.sectorProfits, result.sectorProfits, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "sectorRevenue", last?.sectorRevenue, result.sectorRevenue, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "wages", last?.wages, result.wages, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "sectorLaborCosts", last?.sectorLaborCosts, result.sectorLaborCosts, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "sectorInputCosts", last?.sectorInputCosts, result.sectorInputCosts, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "populationProfits", last?.populationProfits, result.populationProfits, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "sectorUtilization", last?.sectorUtilization, result.sectorUtilization, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "sectorStopReason", last?.sectorStopReason, result.sectorStopReason, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "capitalStock", last?.capitalStock, result.capitalStock, shallowDiff) || hasChanged;
    // hasChanged = trySetPatchField(patch, "sectorGoods", last?.sectorGoods, result.sectorGoods, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch, "money", last?.money, result.money, shallowDiff) || hasChanged;

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

    pruneMemory(colonyPriceMemory, activeEntityIds);
    pruneMemory(colonyWageMemory, activeEntityIds);
    pruneMemory(lastResults, activeEntityIds);

    const patches: IndustryTickPatch[] = [];
    for(const industry of event.data.industries) {
        const patch = processIndustry(industry, colonyPriceMemory, lastResults);
        if(patch) {
            patches.push(patch);
        }
    }

    self.postMessage({ type: "result", patches });
}

// ReplenishmentDelta contains negative values (goods consumed from colony pool).
// Negate them so they show as positive demand in goodsRequirements.
function negateReplenishmentDelta(replenishmentDelta: Partial<Goods>): Partial<Goods> {
    const out: Partial<Goods> = {};
    for(const [key, value] of Object.entries(replenishmentDelta)) {
        if(value < 0) {
            out[key as keyof Goods] = -value;
        }
    }
    return out;
};
