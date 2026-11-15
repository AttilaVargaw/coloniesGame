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
import { computePopulationConsumption, buySectorInputs, computeColonyGoodsDelta, applyGoodsModifier, pruneMemory, trySetPatchField, computeMarketRatios } from "./industryTickHelpers";
import { allocateLabor } from "./laborAllocation";
import { allocateGoods } from "./goodsAllocation";
import { allocateBudget } from "./budgetAllocation";
import { allocatePopulationSales, TransactionLedger } from "./transactionLedger";
import { computeDeprivation, computeMortalityRates, applyMortality } from "./demographics";
import { SectorDecisions } from "../systems/sectorBehaviorTree/bt";

const ESSENTIAL_GOODS: (keyof Goods)[] = ["food", "water", "energy", "healthcare", "agriculturalGoods"];

const lastResults = new Map<string, IndustryTickResult>();
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();
const colonyWageMemory = new Map<string, Partial<Record<keyof Population, number>>>();
const colonyDeprivationMemory = new Map<string, Partial<Record<keyof Goods, number>>>();

const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;

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
        colonyTreasury: startingTreasury,
        householdMoney: startingHouseholdMoney,
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
    const memory = { ...(priceMemory.get(entityId) ?? {}) };
    const prices = validatePrices(getPrices(goods, memory));

    const wageMemory = { ...(colonyWageMemory.get(entityId) ?? {}) };
    const adjustedSalaries = buildAdjustedSalaries(wageMemory);

    const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

    const { populationConsumption, desiredConsumptionByPop, populationUpdates } = computePopulationConsumption(
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

    // === SECTOR ALLOCATION (single pass) ===
    // Prices and wages are frozen per tick, so one allocation pass suffices.
    // Goods and money are committed once from the final allocation.

    const tickStartGoods = { ...goods };
    const tickStartMoney = { ...startingMoney };

    let currentPrices = prices;
    let finalSalaries: Record<keyof Population, number> = adjustedSalaries;
    let finalWorkerMarketRatios: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    let finalSectorBids: SectorBid[] = [];
    let finalLaborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
    let finalGoodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};
    let newMoney: Record<string, number> = { ...tickStartMoney };
    let newTreasury: number = startingTreasury;
    let newHouseholdMoney: number = startingHouseholdMoney;
    let currentGoods: Goods = { ...tickStartGoods };
    let previousDeprivation = { ...(colonyDeprivationMemory.get(entityId) ?? {}) };

    // Reserve population consumption goods before sector allocation
    const populationConsumptionQty: Partial<Goods> = {};
    for(const [goodKey, amount] of Object.entries(populationConsumption)) {
        if(amount > 0) {
            populationConsumptionQty[goodKey as keyof Goods] = amount;
        }
    }

    // === SECTOR-LEVEL BEHAVIOR TREES ===
    // Single pass: prices and wages are frozen per tick, so one allocation
    // produces the final candidate. Candidate/commit separation is preserved
    // so genuine iterative clearing can be added later.

    const roundMoney: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
    for(const name of activeSectors) {
        roundMoney[name] = tickStartMoney[name] ?? 0;
    }

    const roundSalaries = adjustedSalaries;
    let roundInvestRemaining = industryBlackboard.investTotal;

    const roundSectorBids: SectorBid[] = [];
    const sectorDecisions: Record<string, SectorDecisions> = {};

    for(const name of activeSectors) {
        if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && !allowedSectorsSet.has(name)) {
            continue;
        }

        if(industryBlackboard.emergencyStopAll) {
            continue;
        }

        if(industryBlackboard.shutdownSectors.has(name)) {
            continue;
        }

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
            roundSalaries,
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

        sectorDecisions[name] = { ...blackboard.decisions };
        roundInvestRemaining = blackboard.investRemaining;

        if(blackboard.decisions.stopProduction) {
            continue;
        }

        const techMultiplier = techMultipliers[name] ?? 1;
        let laborAssignedVal = blackboard.decisions.laborAssigned > 0
            ? blackboard.decisions.laborAssigned
            : (laborAssigned[name] ?? 0);
        const capitalStockVal = capitalStock[name] ?? {};

        const bid = buildSectorBid(name, currentPrices, techMultiplier, laborAssignedVal, capitalStockVal, roundSalaries, previousSectorProfits[name] ?? 0, blackboard.decisions, {
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
    finalWorkerMarketRatios = workerMarketRatios;

    // === PHASE 2: CENTRALIZED RESOURCE ALLOCATION ===
    const availableWorkers: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const key of Object.keys(population) as (keyof Population)[]) {
        availableWorkers[key] = population[key].number;
    }

    const laborRequests = roundSectorBids.map(bid => ({
        sectorId: bid.name as keyof IndustrialSectors,
        idealDemand: bid.idealWorkerDemand as Partial<Record<keyof Population, number>>,
        priority: industryBlackboard.investmentPriority[bid.name as keyof IndustrialSectors] ?? 0.5,
    }));

    const goodsRequests = roundSectorBids.map(bid => ({
        sectorId: bid.name as keyof IndustrialSectors,
        idealDemand: bid.idealGoodsDemand as Partial<Record<keyof Goods, number>>,
        priority: industryBlackboard.investmentPriority[bid.name as keyof IndustrialSectors] ?? 0.5,
    }));

    const budgetRequests = roundSectorBids.map(bid => ({
        sectorId: bid.name as keyof IndustrialSectors,
        sectorMoney: roundMoney[bid.name as keyof IndustrialSectors] ?? 0,
        sectorInvestment: (sectorDecisions[bid.name]?.sectorInvestment ?? 0),
        costPerUnit: bid.inputCost + bid.laborCost,
    }));

    // Reserve population consumption goods before sector allocation
    const goodsForSectors = { ...tickStartGoods };
    for(const [goodKey, amount] of Object.entries(populationConsumptionQty)) {
        const available = goodsForSectors[goodKey as keyof Goods] ?? 0;
        goodsForSectors[goodKey as keyof Goods] = Math.max(0, available - amount);
    }

    const laborResult = allocateLabor({
        availableWorkers,
        sectorRequests: laborRequests,
    });

    const goodsResult = allocateGoods({
        availableGoods: goodsForSectors,
        sectorRequests: goodsRequests,
    });

    const budgetResult = allocateBudget({
        sectorRequests: budgetRequests,
    });

    const laborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
    const goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};

    for(const bid of roundSectorBids) {
        const sectorId = bid.name as keyof IndustrialSectors;
        laborAllocations[bid.name] = laborResult.allocation[sectorId] ?? {};
        goodsAllocations[bid.name] = goodsResult.allocation[sectorId] ?? {};

        let workerRatio = 1;
        const idealWorkerDemand = bid.idealWorkerDemand as Partial<Record<keyof Population, number>>;
        for(const [popType, demand] of Object.entries(idealWorkerDemand)) {
            if(demand > 0) {
                const allocated = laborResult.allocation[sectorId]?.[popType as keyof Population] ?? 0;
                workerRatio = Math.min(workerRatio, allocated / demand);
            }
        }

        let goodsRatio = 1;
        const idealGoodsDemand = bid.idealGoodsDemand as Partial<Record<keyof Goods, number>>;
        for(const [goodKey, demand] of Object.entries(idealGoodsDemand)) {
            if(demand > 0) {
                const allocated = goodsResult.allocation[sectorId]?.[goodKey as keyof Goods] ?? 0;
                goodsRatio = Math.min(goodsRatio, allocated / demand);
            }
        }

        const budgetRatio = budgetResult.allocation[sectorId]?.budgetRatio ?? bid.budgetRatio;
        bid.actualScale = Math.min(budgetRatio, workerRatio, goodsRatio);

        if(!Number.isFinite(bid.actualScale) || bid.actualScale < 0) {
            bid.actualScale = 0;
        }
    }

    // Capture final candidate
    finalSectorBids = roundSectorBids;
    finalLaborAllocations = laborAllocations;
    finalGoodsAllocations = goodsAllocations;
    finalSalaries = adjustedSalaries;

    // === COMMIT FINAL CANDIDATE (MILESTONE 1: commit once) ===

    // One real purchase with final converged state
    // Use the exact prices and salaries from the selected candidate
    const { colonyGoodsAfterPurchase, newMoney: roundNewMoney, purchasedBySector } = buySectorInputs(
        finalSectorBids,
        tickStartGoods,
        tickStartMoney,
        prices,
        finalGoodsAllocations,
    );
    newMoney = roundNewMoney;
    currentGoods = colonyGoodsAfterPurchase;

    // Execute sectors once with final allocations
    const execResult = executeSectors(
        finalSectorBids,
        population,
        colonyGoodsAfterPurchase,
        prices,
        finalSalaries,
        finalLaborAllocations,
        purchasedBySector,
    );

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
    } = execResult;

    // Reconcile purchases vs actual consumption at finalScale.
    // Any input purchased but not consumed is returned to the colony and
    // its cost is refunded to the sector.
    for(const bid of finalSectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const purchases = purchasedBySector?.[sectorName] ?? {};
        const consumed = sectorResults[sectorName]?.consumedGoods ?? {};

        for(const [goodKey, purchasedQty] of Object.entries(purchases)) {
            const gKey = goodKey as keyof Goods;
            const purchased = Number(purchasedQty);
            const consumedQty = Number(consumed[gKey] ?? 0);

            // Invariant: consumption cannot exceed purchase
            const epsilon = 1e-8;
            if(!Number.isFinite(purchased) || !Number.isFinite(consumedQty) || purchased < 0 || consumedQty < 0) {
                throw new Error(
                    `Invalid purchase/consumption for ${sectorName}/${gKey}: ` +
                    `purchased=${purchased}, consumed=${consumedQty}`
                );
            }
            if(consumedQty > purchased + epsilon) {
                throw new Error(
                    `${sectorName} consumed more ${gKey} than it purchased: ` +
                    `${consumedQty} > ${purchased}`
                );
            }

            const unused = purchased - consumedQty;
            if(unused > epsilon) {
                // Return unused goods to colony warehouse
                currentGoods[gKey] = (currentGoods[gKey] ?? 0) + unused;
                // Refund unused purchase cost to sector
                const price = prices[gKey] ?? 0;
                if(!Number.isFinite(price) || price < 0) {
                    throw new Error(`Invalid price for ${gKey}: ${price}`);
                }
                const refund = unused * price;
                newMoney[sectorName] = (newMoney[sectorName] ?? 0) + refund;
            }
        }

        // Recompute input costs based on actual consumption (not purchase)
        let actualInputCost = 0;
        for(const [goodKey, consumedQty] of Object.entries(consumed)) {
            const qty = Number(consumedQty);
            const price = prices[goodKey as keyof Goods] ?? 0;
            if(!Number.isFinite(qty) || qty < 0 || !Number.isFinite(price) || price < 0) {
                throw new Error(`Invalid consumption/price for ${sectorName}/${goodKey}`);
            }
            actualInputCost += qty * price;
        }
        sectorInputCosts[sectorName] = actualInputCost;

        // Profit is calculated once, after population sales revenue is known.
        // Set to negative costs for now; revenue is added below.
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        sectorProfits[sectorName] = -(actualInputCost + laborCosts);
    }

    // Sector money: input costs already deducted in buySectorInputs.
    // Deduct labor costs (wages paid) only. Revenue comes from population sales below.
    for(const bid of finalSectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) - laborCosts;
    }

    // PHASE 4: Allocate population spending based on actual sales (not production share)
    // availableStock = colony warehouse goods remaining after sector purchases
    const { sectorRevenue: popSalesRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unmetDemandQty } =
        allocatePopulationSales({
            sectorBids: finalSectorBids,
            sectorResults,
            populationConsumption,
            prices: prices,
            availableStock: currentGoods,
        });

    // Actual household consumption = sector production sales + warehouse stock sales
    const fulfilledDemandQty: Partial<Goods> = {};
    for(const sectorSales of Object.values(salesQty)) {
        for(const [goodKey, qty] of Object.entries(sectorSales)) {
            fulfilledDemandQty[goodKey as keyof Goods] =
                (fulfilledDemandQty[goodKey as keyof Goods] ?? 0) + qty;
        }
    }
    for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
        fulfilledDemandQty[goodKey as keyof Goods] =
            (fulfilledDemandQty[goodKey as keyof Goods] ?? 0) + qty;
    }

    // Deduct household warehouse purchases from goods available to capital
    // (reservation order: households first, then capital)
    const goodsForCapital: Goods = { ...currentGoods };
    for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
        goodsForCapital[goodKey as keyof Goods] = Math.max(0, (goodsForCapital[goodKey as keyof Goods] ?? 0) - (qty ?? 0));
    }

    // Credit treasury for sector input purchases (money deducted in buySectorInputs)
    const totalSectorInputCosts = Object.values(sectorInputCosts).reduce((sum, v) => sum + v, 0);
    newTreasury += totalSectorInputCosts;

    // PHASE 3.B: Settle household finances — actual wages and spending
    const wealthSmoothing = 0.5;

    // Compute actual wages paid to each population category from sector employment
    const wagesByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const bid of finalSectorBids) {
        const result = sectorResults[bid.name];
        if(!result) continue;
        for(const [popType, employed] of Object.entries(result.workersEmployed ?? {})) {
            const key = popType as keyof Population;
            wagesByPop[key] = (wagesByPop[key] ?? 0) + (employed ?? 0) * (finalSalaries[key] ?? 0);
        }
    }

    // Compute total actual household spending from fulfilled demand
    const totalActualSpending = Object.entries(fulfilledDemandQty).reduce((sum, [goodKey, qty]) => {
        return sum + (qty ?? 0) * (prices[goodKey as keyof Goods] ?? 0);
    }, 0);

    // Distribute actual spending proportionally to each pop's desired consumption value
    const desiredConsumptionValueByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    let totalDesiredConsumptionValue = 0;
    for(const [popType, consumption] of Object.entries(desiredConsumptionByPop)) {
        const key = popType as keyof Population;
        let value = 0;
        for(const [goodKey, qty] of Object.entries(consumption)) {
            value += (qty ?? 0) * (prices[goodKey as keyof Goods] ?? 0);
        }
        desiredConsumptionValueByPop[key] = value;
        totalDesiredConsumptionValue += value;
    }

    const actualSpendingByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    const popKeys = Object.keys(desiredConsumptionByPop) as (keyof Population)[];
    for(const key of popKeys) {
        const share = totalDesiredConsumptionValue > 0
            ? desiredConsumptionValueByPop[key] / totalDesiredConsumptionValue
            : 1 / Math.max(popKeys.length, 1);
        actualSpendingByPop[key] = totalActualSpending * share;
    }

    // Update population wealth based on actual income and spending
    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        const k = key as keyof Population;
        const actualIncome = wagesByPop[k] ?? 0;
        const actualSpending = actualSpendingByPop[k] ?? 0;
        const targetWealth = pop.wealth + actualIncome - actualSpending;
        const smoothedWealth = Number.isFinite(targetWealth) ? pop.wealth + (targetWealth - pop.wealth) * wealthSmoothing : pop.wealth;

        if(populationUpdates[k]) {
            populationUpdates[k] = {
                ...populationUpdates[k],
                wealth: Math.max(0, smoothedWealth),
            };
        }
    }

    // PHASE 3.C: Household money settlement — wages in, spending out
    const totalLaborCosts = Object.values(sectorLaborCosts).reduce((sum, v) => sum + v, 0);

    // Wage reconciliation: wages paid to households must equal sector labor costs
    // Use the actual labor costs from sector execution as the authoritative source
    const actualWageBill = totalLaborCosts;

    // Deduct labor costs from sector money, credit household money
    for(const name of activeSectors) {
        newMoney[name] = (newMoney[name] ?? 0) - (sectorLaborCosts[name] ?? 0);
    }
    newHouseholdMoney += actualWageBill;

    // Deduct household spending from household money
    newHouseholdMoney -= totalActualSpending;

    // Credit treasury with warehouse sales revenue
    newTreasury += warehouseRevenue;

    // Reset sector revenue to actual-sales-only authority
    for(const name of activeSectors) {
        sectorRevenue[name] = 0;
        const laborCosts = sectorLaborCosts[name] ?? 0;
        const inputCosts = sectorInputCosts[name] ?? 0;
        sectorProfits[name] = -(inputCosts + laborCosts);
    }

    for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
        sectorRevenue[sectorName] = revenue;
        // Profit calculated once: revenue - actual input costs - labor costs
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        const inputCosts = sectorInputCosts[sectorName] ?? 0;
        sectorProfits[sectorName] = revenue - inputCosts - laborCosts;
    }

    // PHASE 5: Deprivation and mortality from unmet demand
    const deprivation = computeDeprivation({
        previousDeprivation,
        goodsShortfall: unmetDemandQty,
        desiredDemand: populationConsumption,
        essentialGoods: ESSENTIAL_GOODS,
    });

    // Build grown population: apply natural growth from computePopulationConsumption
    // to the original population, then apply mortality to the grown result.
    const grownPopulation: Population = { ...population };
    for(const [key, update] of Object.entries(populationUpdates) as [keyof Population, any][]) {
        if(update && update.number !== undefined) {
            grownPopulation[key] = {
                ...grownPopulation[key],
                number: update.number,
            };
        }
    }

    // Apply mortality to the grown population
    const mortalityRateMap: Partial<Record<keyof Population, number>> = {};
    const { mortalityRate } = computeMortalityRates({
        deprivation,
        population: grownPopulation,
    });
    for(const [key, rate] of Object.entries(mortalityRate)) {
        mortalityRateMap[key as keyof Population] = rate;
    }

    const mortalityAdjustedPopulation = applyMortality({
        population: grownPopulation,
        mortalityRate: mortalityRateMap,
    });

    // Apply mortality-adjusted numbers back to populationUpdates.
    // populationUpdates already has smoothed qol, expectedQol, wealth, requirements
    // from computePopulationConsumption. Only update number and populationChange.
    // populationChange is calculated against the original tick-start population.
    for(const [key, pop] of Object.entries(mortalityAdjustedPopulation) as [keyof Population, any][]) {
        const originalPop = population[key];
        if(!originalPop) continue;

        if(populationUpdates[key]) {
            populationUpdates[key] = {
                ...populationUpdates[key],
                number: pop.number,
                populationChange: pop.number - originalPop.number,
            };
        } else {
            // Category had no population update but experienced mortality
            populationUpdates[key] = {
                qol: originalPop.qol ?? 0,
                expectedQol: originalPop.expectedQol ?? 0,
                populationChange: pop.number - originalPop.number,
                wealth: originalPop.wealth ?? 0,
                number: pop.number,
                requirements: {},
            };
        }
    }

    // Capital wear, decay, replenishment, investment
    const { newCapitalStock, replenishmentDelta, moneySpent, remainingGoods } = processCapital(
        activeSectors,
        capitalStock,
        sectorResults,
        prices,
        newMoney,
        goodsForCapital
    );

    // Deduct capital costs from sector money
    for(const name of activeSectors) {
        newMoney[name] = (newMoney[name] ?? 0) - (moneySpent[name] ?? 0);
    }

    // Credit treasury for capital purchases
    const totalCapitalMoneySpent = Object.values(moneySpent).reduce((sum, v) => sum + v, 0);
    newTreasury += totalCapitalMoneySpent;

    // remainingGoods is the authoritative inventory after capital purchases
    const postCapitalGoods: Goods = { ...createEmptyWarehouse(), ...remainingGoods };

    const colonyGoodsDelta = computeColonyGoodsDelta(
        goods,
        postCapitalGoods,
        activeSectors,
        sectorResults,
        {} as Record<string, number>,
        // replenishmentDelta already reflected in postCapitalGoods; do not double-count
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
    const colonyGoodsChanges = finalizeGoods(goods, colonyGoodsProduction, colonyGoodsRequirements, fulfilledDemandQty, population);

    // PHASE 7: Transaction ledger — record all economic transfers for audit
    const ledger = new TransactionLedger();

    // Sector input purchases: sector pays, colony treasury receives
    for(const name of activeSectors) {
        const inputCost = sectorInputCosts[name] ?? 0;
        if(inputCost > 0) {
            ledger.record({
                tick: 0,
                type: "goods_purchase",
                buyerId: name,
                sellerId: "colony_treasury",
                amount: inputCost,
            });
        }
    }

    // Wage payments: sector pays, population receives
    for(const name of activeSectors) {
        const laborCost = sectorLaborCosts[name] ?? 0;
        if(laborCost > 0) {
            ledger.record({
                tick: 0,
                type: "wage_payment",
                buyerId: name,
                sellerId: "population",
                amount: laborCost,
            });
        }
    }

    // Household sales: population pays, sector receives
    for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
        if(revenue > 0) {
            ledger.record({
                tick: 0,
                type: "population_spending",
                buyerId: "population",
                sellerId: sectorName,
                amount: revenue,
            });
        }
    }

    // Capital purchases: sector pays, colony treasury receives
    for(const name of activeSectors) {
        const capitalCost = moneySpent[name] ?? 0;
        if(capitalCost > 0) {
            ledger.record({
                tick: 0,
                type: "capital_purchase",
                buyerId: name,
                sellerId: "colony_treasury",
                amount: capitalCost,
            });
        }
    }

    // Warehouse sales: population pays, colony treasury receives
    if(warehouseRevenue > 0) {
        ledger.record({
            tick: 0,
            type: "population_spending",
            buyerId: "population",
            sellerId: "colony_treasury",
            amount: warehouseRevenue,
        });
    }

    // Verify money conservation: closing balances = opening + deltas
    const openingBalances: Record<string, number> = {};
    const closingBalances: Record<string, number> = {};
    for(const name of activeSectors) {
        openingBalances[name] = tickStartMoney[name] ?? 0;
        closingBalances[name] = newMoney[name] ?? 0;
    }
    openingBalances["colony_treasury"] = startingTreasury;
    closingBalances["colony_treasury"] = newTreasury;
    openingBalances["population"] = startingHouseholdMoney;
    closingBalances["population"] = newHouseholdMoney;

    const conservation = ledger.verifyConservation(openingBalances, closingBalances);
    if(!conservation.valid) {
        console.error(`[IndustryTick] Money conservation violated: error=${conservation.error}`, conservation.accountErrors);
    }

    const result: IndustryTickResult = {
        entityId,
        goodsRequirements: aggregateGoodsRequirements(sumGoodsRequirements, populationConsumption, negateReplenishmentDelta(replenishmentDelta)),
        goodsProduction: sumGoodsProduction,
        workingWorkers: workingWorkers as Population,
        freeWorkers: remainingWorkers,
        population: mortalityAdjustedPopulation,
        populationUpdates,
        goods: colonyGoodsChanges,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        populationProfits: {},
        sectorUtilization,
        sectorStopReason,
        wages: finalSalaries,
        sectorResults,
        capitalStock: newCapitalStock,
        money: newMoney,
        colonyTreasury: newTreasury,
        householdMoney: newHouseholdMoney,
        // sectorGoods: updatedSectorGoods,
        settlementType,
        allowedSectors,
        unmetDemand: unmetDemandQty,
        deprivation,
    };

    const patch = buildPatch(last, result);

    // Commit persistent memory only after successful processing
    // Update wage memory once with final market ratios (wages frozen per tick)
    updateWageMemory(wageMemory, finalWorkerMarketRatios);
    priceMemory.set(entityId, prices);
    colonyWageMemory.set(entityId, wageMemory);
    colonyDeprivationMemory.set(entityId, deprivation);
    results.set(entityId, result);

    return patch;
}

function validatePrices(
    prices: Record<keyof Goods, number>
): Record<keyof Goods, number> {
    const validated = { ...prices };

    for(const key of Object.keys(validated) as (keyof Goods)[]) {
        const value = validated[key];

        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid price for ${key}: ${value}`);
        }
    }

    return validated;
}

function aggregateGoodsRequirements(
    ...sources: Partial<Goods>[]
): Partial<Goods> {
    const result: Partial<Goods> = {};
    for(const source of sources) {
        for(const [key, amount] of Object.entries(source)) {
            const goodKey = key as keyof Goods;
            result[goodKey] = (result[goodKey] ?? 0) + (amount ?? 0);
        }
    }
    return result;
}

function calculateMarketRatios(
    sectorBids: SectorBid[],
    population: Population,
): { workerMarketRatios: Record<keyof Population, number> } {
    const totalIdealWorkerDemand = {} as Record<keyof Population, number>;

    for(const bid of sectorBids) {
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            totalIdealWorkerDemand[key as keyof Population] = (totalIdealWorkerDemand[key as keyof Population] ?? 0) + value;
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


function finalizeGoods(
    currentGoods: Goods,
    sumGoodsProduction: Goods,
    sumGoodsRequirements: Goods,
    populationConsumption: Partial<Goods>,
    population: Population
): Goods {
    const finalGoods = { ...currentGoods } as Goods;

    applyGoodsModifier(finalGoods, sumGoodsProduction, (cur, d) => cur + d);
    applyGoodsModifier(finalGoods, sumGoodsRequirements, (cur, d) => cur - d);
    applyGoodsModifier(finalGoods, populationConsumption, (cur, d) => cur - d);

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
    hasChanged = trySetPatchField(patch, "colonyTreasury", last?.colonyTreasury, result.colonyTreasury, Object.is) || hasChanged;
    hasChanged = trySetPatchField(patch, "householdMoney", last?.householdMoney, result.householdMoney, Object.is) || hasChanged;

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
    pruneMemory(colonyDeprivationMemory, activeEntityIds);
    pruneMemory(lastResults, activeEntityIds);

    const patches: IndustryTickPatch[] = [];
    for(const industry of event.data.industries) {
        try {
            // Validate core inputs before processing
            if(!industry.entityId || !industry.goods || !industry.population) {
                console.error(`[IndustryTick] Invalid input for entity ${industry.entityId}: missing required fields`);
                continue;
            }
            // Validate goods are finite and nonnegative
            let goodsValid = true;
            for(const [key, value] of Object.entries(industry.goods)) {
                if(!Number.isFinite(value) || value < 0) {
                    console.error(`[IndustryTick] Invalid goods value for ${industry.entityId}.${key}: ${value}`);
                    goodsValid = false;
                }
            }
            if(!goodsValid) continue;
            const patch = processIndustry(industry, colonyPriceMemory, lastResults);
            if(patch) {
                patches.push(patch);
            }
        } catch(err) {
            console.error(`[IndustryTick] Industry ${industry.entityId} failed:`, err);
            // Continue processing other industries; this one keeps its previous state
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
