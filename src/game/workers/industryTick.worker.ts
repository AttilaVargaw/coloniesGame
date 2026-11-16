import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { getPrices, Goods, NON_CUMULATING_GOODS, basePrices } from "../data/Goods";
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
import { computePopulationConsumption, buySectorInputs, computeColonyGoodsDelta, pruneMemory, trySetPatchField, computeMarketRatios } from "./industryTickHelpers";
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

    // Normalize opening balances once — use these consistently for all calculations
    const openingTreasury = startingTreasury ?? 0;
    const openingHouseholdMoney = startingHouseholdMoney ?? 0;

    // Validate opening balances before any economic processing
    if(!Number.isFinite(openingTreasury) || openingTreasury < 0) {
        throw new Error(`Invalid opening treasury for ${entityId}: ${openingTreasury}`);
    }

    if(!Number.isFinite(openingHouseholdMoney) || openingHouseholdMoney < 0) {
        throw new Error(`Invalid opening household cash for ${entityId}: ${openingHouseholdMoney}`);
    }

    for(const [name, balance] of Object.entries(tickStartMoney)) {
        if(!Number.isFinite(balance) || balance < 0) {
            throw new Error(`Invalid opening sector money for ${entityId}.${name}: ${balance}`);
        }
    }

    // Validate population counts and wealth values before constructing cashByPop
    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        if(!Number.isFinite(pop.number) || pop.number < 0) {
            throw new Error(`Invalid population count for ${entityId}.${key}: ${pop.number}`);
        }

        const wealth = pop.wealth ?? 0;
        if(!Number.isFinite(wealth) || wealth < 0) {
            throw new Error(`Invalid population wealth for ${entityId}.${key}: ${wealth}`);
        }
    }

    const currentPrices = prices;
    let finalSalaries: Record<keyof Population, number> = adjustedSalaries;
    let finalWorkerMarketRatios: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    let finalSectorBids: SectorBid[] = [];
    let finalLaborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
    let finalGoodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};
    let newMoney: Record<string, number> = { ...tickStartMoney };
    let newTreasury = openingTreasury;
    let newHouseholdMoney = openingHouseholdMoney;
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
                if(!Number.isFinite(newMoney[sectorName])) {
                    throw new Error(`Sector money overflow for ${sectorName}`);
                }
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
            if(!Number.isFinite(actualInputCost)) {
                throw new Error(`Input cost overflow for ${sectorName}`);
            }
        }
        sectorInputCosts[sectorName] = actualInputCost;

        // Profit is calculated once, after population sales revenue is known.
        // Set to negative costs for now; revenue is added below.
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        sectorProfits[sectorName] = -(actualInputCost + laborCosts);
    }

    // PHASE 4: Allocate population spending based on actual sales (not production share)
    // Constrain per population group by available cash: starting wealth + wages

    // Compute actual wages paid to each population category from sector employment
    const wagesByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const bid of finalSectorBids) {
        const result = sectorResults[bid.name];
        if(!result) continue;
        for(const [popType, employed] of Object.entries(result.workersEmployed ?? {})) {
            const key = popType as keyof Population;
            const wage = (employed ?? 0) * (finalSalaries[key] ?? 0);

            if(!Number.isFinite(wage) || wage < 0) {
                throw new Error(`Invalid wage payment for ${bid.name}/${key}: ${wage}`);
            }

            wagesByPop[key] = (wagesByPop[key] ?? 0) + wage;

            if(!Number.isFinite(wagesByPop[key])) {
                throw new Error(`Wage accumulation overflow for ${key}`);
            }
        }
    }

    // Each group's available cash = starting wealth + wages earned this tick
    const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        cashByPop[key] = (pop.wealth ?? 0) + (wagesByPop[key] ?? 0);
    }

    // Reconcile opening household cash against population wealth before allocating sales.
    // The ledger and allocator must agree on how much household money exists.
    const actualStartingHouseholdMoney = Object.values(population).reduce(
        (sum, pop) => sum + (pop.wealth ?? 0),
        0,
    );
    if(Math.abs(actualStartingHouseholdMoney - openingHouseholdMoney) > 1e-6) {
        throw new Error(
            `Starting household cash mismatch: population=${actualStartingHouseholdMoney}, ` +
            `householdMoney=${openingHouseholdMoney}`,
        );
    }

    const { sectorRevenue: popSalesRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unmetDemandByPop, spendingByPop } =
        allocatePopulationSales({
            sectorBids: finalSectorBids,
            sectorResults,
            demandByPop: desiredConsumptionByPop,
            cashByPop,
            prices: prices,
            availableStock: currentGoods,
            goodPriority: ESSENTIAL_GOODS,
        });

    // Validate allocator results: total household spending must equal total sales revenue
    const totalPopulationSpending = Object.values(spendingByPop)
        .reduce((sum, value) => sum + value, 0);

    const totalSalesRevenue =
        Object.values(popSalesRevenue).reduce((sum, value) => sum + value, 0)
        + warehouseRevenue;

    if(Math.abs(totalPopulationSpending - totalSalesRevenue) > 1e-6) {
        throw new Error(
            `Household spending mismatch: spending=${totalPopulationSpending}, ` +
            `sales=${totalSalesRevenue}`,
        );
    }

    // Validate each group's spending is within its cash budget
    for(const key of Object.keys(population) as (keyof Population)[]) {
        const spending = spendingByPop[key] ?? 0;
        const available = cashByPop[key] ?? 0;

        if(spending > available + 1e-6) {
            throw new Error(
                `Population ${key} exceeded cash budget: ${spending} > ${available}`,
            );
        }
    }

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

    // Aggregate per-group unmet demand into goods-level shortfall for deprivation
    const unmetDemandQty: Partial<Goods> = {};
    for(const key of Object.keys(unmetDemandByPop) as (keyof Population)[]) {
        for(const [goodKey, qty] of Object.entries(unmetDemandByPop[key] ?? {})) {
            unmetDemandQty[goodKey as keyof Goods] =
                (unmetDemandQty[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
        }
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
    if(!Number.isFinite(newTreasury)) {
        throw new Error(`Treasury overflow after input costs`);
    }

    // PHASE 3.B: Settle household finances — actual wages and spending
    // Wealth is a cash balance (no smoothing): full income minus actual spending

    // Wage reconciliation: calculated wages from employment must equal sector labor costs
    const totalLaborCosts = Object.values(sectorLaborCosts).reduce((sum, v) => sum + v, 0);
    const calculatedWageBill = Object.values(wagesByPop).reduce((sum, v) => sum + v, 0);
    if(Math.abs(calculatedWageBill - totalLaborCosts) > 1e-6) {
        throw new Error(
            `Wage bill mismatch for ${entityId}: ` +
            `calculated=${calculatedWageBill}, sector costs=${totalLaborCosts}`,
        );
    }

    // Deduct labor costs from sector money, credit household wealth
    for(const name of activeSectors) {
        const laborCost = sectorLaborCosts[name] ?? 0;
        if(!Number.isFinite(laborCost) || laborCost < 0) {
            throw new Error(`Invalid labor cost for ${name}: ${laborCost}`);
        }
        newMoney[name] = (newMoney[name] ?? 0) - laborCost;
        if(!Number.isFinite(newMoney[name]) || newMoney[name] < -1e-6) {
            throw new Error(`Sector money deficit for ${name}: ${newMoney[name]}`);
        }
    }

    // Update population wealth based on actual income and spending (full cash balance, no smoothing)
    const CASH_EPSILON = 1e-6;

    // Every population group gets a wealth update, even groups without a consumption update,
    // so no wage credit is lost.
    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        const k = key as keyof Population;
        const actualIncome = wagesByPop[k] ?? 0;
        const actualSpending = spendingByPop[k] ?? 0;
        const targetWealth = (pop.wealth ?? 0) + actualIncome - actualSpending;

        if(!Number.isFinite(targetWealth) || targetWealth < -CASH_EPSILON) {
            throw new Error(
                `Population ${k} overspent: resulting cash=${targetWealth}, ` +
                `income=${actualIncome}, spending=${actualSpending}`,
            );
        }

        const closingWealth = targetWealth < 0 ? 0 : targetWealth;

        populationUpdates[k] = {
            ...populationUpdates[k],
            wealth: closingWealth,
        };
    }

    // Derive aggregate household money from all population wealth (authoritative source).
    // Use the final population state rather than relying on partial-update semantics.
    newHouseholdMoney = Object.keys(population).reduce((sum, key) => {
        const popKey = key as keyof Population;
        const update = populationUpdates[popKey];
        const wealth = update?.wealth ?? population[popKey].wealth ?? 0;
        return sum + wealth;
    }, 0);

    // Credit treasury with warehouse sales revenue
    newTreasury += warehouseRevenue;
    if(!Number.isFinite(newTreasury)) {
        throw new Error(`Treasury overflow after warehouse revenue`);
    }

    // Reset sector revenue to actual-sales-only authority
    for(const name of activeSectors) {
        sectorRevenue[name] = 0;
        const laborCosts = sectorLaborCosts[name] ?? 0;
        const inputCosts = sectorInputCosts[name] ?? 0;
        sectorProfits[name] = -(inputCosts + laborCosts);
    }

    for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
        if(!Number.isFinite(newMoney[sectorName])) {
            throw new Error(`Sector money overflow for ${sectorName}`);
        }
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
    // Every group's wealth update is carried forward, even groups without a number update,
    // so mortality operates on current wealth not stale wealth.
    const grownPopulation: Population = { ...population };
    for(const [key, update] of Object.entries(populationUpdates) as [keyof Population, any][]) {
        if(!update) continue;

        grownPopulation[key] = {
            ...grownPopulation[key],
            ...(update.number !== undefined ? { number: update.number } : {}),
            ...(update.wealth !== undefined ? { wealth: update.wealth } : {}),
        };
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
    for(const [key, pop] of Object.entries(mortalityAdjustedPopulation) as [keyof Population, PopulationBreakdown][]) {
        const originalPop = population[key];
        if(!originalPop) continue;

        populationUpdates[key] = {
            ...populationUpdates[key],
            number: pop.number,
            wealth: pop.wealth ?? 0,
            populationChange: pop.number - originalPop.number,
        };
    }

    // Mortality must not alter household cash — wealth is total cash per category,
    // not per capita. Verify the final population wealth matches the derived
    // householdMoney before continuing.
    const finalPopulationCash = Object.values(mortalityAdjustedPopulation)
        .reduce((sum, pop) => sum + (pop.wealth ?? 0), 0);

    if(Math.abs(finalPopulationCash - newHouseholdMoney) > 1e-6) {
        throw new Error(
            `Household cash mismatch for ${entityId}: population=${finalPopulationCash}, ` +
            `householdMoney=${newHouseholdMoney}`,
        );
    }

    // Per-category wealth must match the update entry — mortality changes
    // population count, not cash held by a category.
    for(const key of Object.keys(population) as (keyof Population)[]) {
        const actualWealth = mortalityAdjustedPopulation[key].wealth ?? 0;
        const expectedWealth = populationUpdates[key]?.wealth ?? 0;

        if(Math.abs(actualWealth - expectedWealth) > 1e-6) {
            throw new Error(
                `Population wealth mismatch for ${entityId}.${key}: ` +
                `population=${actualWealth}, update=${expectedWealth}`,
            );
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
        const capitalCost = moneySpent[name] ?? 0;
        if(!Number.isFinite(capitalCost) || capitalCost < 0) {
            throw new Error(`Invalid capital cost for ${name}: ${capitalCost}`);
        }
        newMoney[name] = (newMoney[name] ?? 0) - capitalCost;
        if(!Number.isFinite(newMoney[name]) || newMoney[name] < -1e-6) {
            throw new Error(`Sector money deficit for ${name}: ${newMoney[name]}`);
        }
    }

    // Credit treasury for capital purchases
    const totalCapitalMoneySpent = Object.values(moneySpent).reduce((sum, v) => sum + v, 0);
    newTreasury += totalCapitalMoneySpent;
    if(!Number.isFinite(newTreasury)) {
        throw new Error(`Treasury overflow after capital purchases`);
    }

    // remainingGoods is the authoritative inventory after capital purchases
    const postCapitalGoods: Goods = { ...createEmptyWarehouse(), ...remainingGoods };

    // Reject negative closing sector balances — only floating-point noise tolerated
    for(const [name, balance] of Object.entries(newMoney)) {
        if(!Number.isFinite(balance) || balance < -1e-6) {
            throw new Error(
                `Invalid closing sector balance for ${entityId}.${name}: ${balance}`,
            );
        }
        if(balance < 0) {
            newMoney[name] = 0;
        }
    }

    // Add warehouse sales back so the goods delta does not double-count them.
    // Warehouse sales are deducted once through fulfilledDemandQty in finalizeGoods.
    const goodsForDelta: Goods = { ...postCapitalGoods };
    for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
        const key = goodKey as keyof Goods;
        goodsForDelta[key] = (goodsForDelta[key] ?? 0) + (qty ?? 0);
    }

    const colonyGoodsDelta = computeColonyGoodsDelta(
        goods,
        goodsForDelta,
        activeSectors,
        sectorResults,
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

    // Reconcile reconstructed production against executeSectors() aggregate
    for(const goodKey of Object.keys(sumGoodsProduction) as (keyof Goods)[]) {
        const reconstructed = colonyGoodsProduction[goodKey] ?? 0;
        const reported = sumGoodsProduction[goodKey] ?? 0;
        if(Math.abs(reconstructed - reported) > 1e-6) {
            throw new Error(
                `Production reconciliation mismatch for ${goodKey}: ` +
                `reconstructed=${reconstructed}, reported=${reported}`,
            );
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

    // Wage payments: sector pays each population category separately
    for(const name of activeSectors) {
        const result = sectorResults[name];
        const workersEmployed = result?.workersEmployed ?? {};
        for(const key of Object.keys(population) as (keyof Population)[]) {
            const employed = workersEmployed[key] ?? 0;
            const salary = finalSalaries[key] ?? 0;
            const wage = employed * salary;

            if(!Number.isFinite(wage) || wage < 0) {
                throw new Error(`Invalid wage payment for ${name}/${key}: ${wage}`);
            }

            if(wage > 0) {
                ledger.record({
                    tick: 0,
                    type: "wage_payment",
                    buyerId: name,
                    sellerId: `population:${key}`,
                    amount: wage,
                });
            }
        }
    }

    // Household sales: each population category pays, sector receives
    for(const key of Object.keys(population) as (keyof Population)[]) {
        const spending = spendingByPop[key] ?? 0;
        if(spending > 0) {
            ledger.record({
                tick: 0,
                type: "population_spending",
                buyerId: `population:${key}`,
                sellerId: "household_sales",
                amount: spending,
            });
        }
    }

    // Sector revenue: household_sales pays each sector
    for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
        if(revenue > 0) {
            ledger.record({
                tick: 0,
                type: "population_spending",
                buyerId: "household_sales",
                sellerId: sectorName,
                amount: revenue,
            });
        }
    }

    // Warehouse sales: household_sales pays colony treasury
    if(warehouseRevenue > 0) {
        ledger.record({
            tick: 0,
            type: "population_spending",
            buyerId: "household_sales",
            sellerId: "colony_treasury",
            amount: warehouseRevenue,
        });
    }

    // Capital purchases: sector pays, colony treasury receives
    for(const name of activeSectors) {
        const capitalCost = moneySpent[name] ?? 0;
        if(!Number.isFinite(capitalCost) || capitalCost < 0) {
            throw new Error(`Invalid capital purchase cost for ${name}: ${capitalCost}`);
        }
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

    // Verify money conservation: closing balances = opening + deltas
    const openingBalances: Record<string, number> = {};
    const closingBalances: Record<string, number> = {};
    for(const name of activeSectors) {
        openingBalances[name] = tickStartMoney[name] ?? 0;
        closingBalances[name] = newMoney[name] ?? 0;
    }
    openingBalances["colony_treasury"] = openingTreasury;
    closingBalances["colony_treasury"] = newTreasury;
    openingBalances["household_sales"] = 0;
    closingBalances["household_sales"] = totalPopulationSpending;
    for(const key of Object.keys(population) as (keyof Population)[]) {
        const account = `population:${key}`;
        openingBalances[account] = population[key].wealth ?? 0;
        closingBalances[account] = mortalityAdjustedPopulation[key].wealth ?? 0;
    }

    const conservation = ledger.verifyConservation(openingBalances, closingBalances);
    if(!conservation.valid) {
        console.error(`[IndustryTick] Money conservation violated for ${entityId}: error=${conservation.error}`, conservation.accountErrors);
        return null;
    }

    const result: IndustryTickResult = {
        entityId,
        goodsRequirements: aggregateGoodsRequirements(sumGoodsRequirements, populationConsumption),
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
        accounting: {
            householdSalesByGood: (() => {
                const byGood: Partial<Goods> = {};
                for(const sectorSales of Object.values(salesQty)) {
                    for(const [goodKey, qty] of Object.entries(sectorSales)) {
                        byGood[goodKey as keyof Goods] =
                            (byGood[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
                    }
                }
                for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
                    byGood[goodKey as keyof Goods] =
                        (byGood[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
                }
                return byGood;
            })(),
            capitalPurchasesByGood: Object.fromEntries(
                Object.entries(replenishmentDelta ?? {}).map(
                    ([key, val]) => [key, -(val ?? 0)],
                ),
            ),
            wagesByPop,
            spendingByPop,
        },
    };

    // Phase 5.6: Validate all committed state before building patch
    if(!validateTickResult(result)) {
        console.error(`[IndustryTick] Invalid committed state for ${entityId}, rejecting tick`);
        return null;
    }

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
    const epsilon = 1e-9;
    const finalGoods = { ...currentGoods } as Goods;

    // Validate complete Goods schema — every good key must be present and valid
    for(const goodKey of Object.keys(basePrices) as (keyof Goods)[]) {
        const opening = currentGoods[goodKey] ?? 0;
        const production = sumGoodsProduction[goodKey] ?? 0;
        const requirements = sumGoodsRequirements[goodKey] ?? 0;
        const consumption = populationConsumption[goodKey] ?? 0;

        for(const [label, value] of [
            ["opening inventory", opening],
            ["production", production],
            ["requirements", requirements],
            ["population consumption", consumption],
        ] as const) {
            if(!Number.isFinite(value) || value < 0) {
                throw new Error(`Invalid ${label} for ${goodKey}: ${value}`);
            }
        }

        // Waste is handled separately below — exclude from main goods loop
        if(goodKey === "waste") continue;

        let closing: number;

        if(NON_CUMULATING_GOODS.has(goodKey)) {
            // Non-cumulative goods (services): opening inventory does not carry over.
            // These are non-storable flows; closing = production - requirements.
            closing = production - requirements;
        } else {
            // Cumulative goods (physical inventory): opening + production - requirements - consumption.
            closing = opening + production - requirements - consumption;
        }

        if(!Number.isFinite(closing)) {
            throw new Error(`Inventory overflow for ${goodKey}`);
        }

        if(closing < -epsilon) {
            throw new Error(`Inventory deficit for ${goodKey}: ${closing}`);
        }

        finalGoods[goodKey] = Math.max(0, closing);
    }

    // Waste calculation — validate inputs
    const totalPopulation = Object.values(population).reduce((sum, pop) => {
        if(!Number.isFinite(pop.number) || pop.number < 0) {
            throw new Error("Invalid population while calculating waste");
        }
        return sum + pop.number;
    }, 0);

    if(!Number.isFinite(totalPopulation)) {
        throw new Error("Total population overflow while calculating waste");
    }

    if(
        !Number.isFinite(wastePerPerson) ||
        wastePerPerson < 0 ||
        !Number.isFinite(wasteDecayRate) ||
        wasteDecayRate < 0 ||
        wasteDecayRate > 1
    ) {
        throw new Error("Invalid waste generation or decay configuration");
    }

    const openingWaste = currentGoods.waste ?? 0;
    if(!Number.isFinite(openingWaste) || openingWaste < 0) {
        throw new Error("Invalid opening waste inventory");
    }

    const populationWaste = totalPopulation * wastePerPerson;
    const productionWaste = sumGoodsProduction.waste ?? 0;
    const closingWaste =
        openingWaste +
        populationWaste +
        productionWaste -
        wasteDecayRate * openingWaste;

    if(!Number.isFinite(closingWaste)) {
        throw new Error("Waste inventory overflow");
    }

    finalGoods.waste = Math.max(0, closingWaste);

    return finalGoods;
}

function validateTickResult(result: IndustryTickResult): boolean {
    // Validate goods are finite and nonnegative
    for(const [key, value] of Object.entries(result.goods)) {
        if(!Number.isFinite(value) || value < 0) {
            console.error(`[IndustryTick] Invalid goods value for ${result.entityId}.${key}: ${value}`);
            return false;
        }
    }
    for(const [key, value] of Object.entries(result.goodsRequirements)) {
        if(!Number.isFinite(value) || value < 0) {
            console.error(`[IndustryTick] Invalid goodsRequirements value for ${result.entityId}.${key}: ${value}`);
            return false;
        }
    }
    for(const [key, value] of Object.entries(result.goodsProduction)) {
        if(!Number.isFinite(value) || value < 0) {
            console.error(`[IndustryTick] Invalid goodsProduction value for ${result.entityId}.${key}: ${value}`);
            return false;
        }
    }

    // Validate money balances are finite and nonnegative
    for(const [name, value] of Object.entries(result.money)) {
        if(!Number.isFinite(value) || value < 0) {
            console.error(`[IndustryTick] Invalid money value for ${result.entityId}.${name}: ${value}`);
            return false;
        }
    }
    if(!Number.isFinite(result.colonyTreasury) || result.colonyTreasury < 0) {
        console.error(`[IndustryTick] Invalid colonyTreasury for ${result.entityId}: ${result.colonyTreasury}`);
        return false;
    }
    if(!Number.isFinite(result.householdMoney) || result.householdMoney < 0) {
        console.error(`[IndustryTick] Invalid householdMoney for ${result.entityId}: ${result.householdMoney}`);
        return false;
    }

    // Validate capital stocks are finite and nonnegative
    for(const [sectorName, stock] of Object.entries(result.capitalStock)) {
        for(const [key, value] of Object.entries(stock)) {
            if(!Number.isFinite(value) || value < 0) {
                console.error(`[IndustryTick] Invalid capital stock for ${result.entityId}.${sectorName}.${key}: ${value}`);
                return false;
            }
        }
    }

    // Validate population counts are finite and nonnegative
    for(const [key, pop] of Object.entries(result.population)) {
        if(!Number.isFinite(pop.number) || pop.number < 0) {
            console.error(`[IndustryTick] Invalid population number for ${result.entityId}.${key}: ${pop.number}`);
            return false;
        }
        if(!Number.isFinite(pop.wealth) || pop.wealth < 0) {
            console.error(`[IndustryTick] Invalid population wealth for ${result.entityId}.${key}: ${pop.wealth}`);
            return false;
        }
    }

    // Validate aggregate household money matches sum of population wealth
    const populationCash = Object.values(result.population)
        .reduce((sum, pop) => sum + pop.wealth, 0);

    if(Math.abs(populationCash - result.householdMoney) > 1e-6) {
        console.error(
            `[IndustryTick] Household cash does not match population wealth for ${result.entityId}: ` +
            `population=${populationCash}, householdMoney=${result.householdMoney}`,
        );
        return false;
    }

    // Validate populationUpdates fields
    for(const [key, update] of Object.entries(result.populationUpdates)) {
        if(!update) continue;

        if(update.wealth !== undefined &&
            (!Number.isFinite(update.wealth) || update.wealth < 0)) {
            console.error(`[IndustryTick] Invalid population update wealth for ${result.entityId}.${key}`);
            return false;
        }

        if(update.number !== undefined &&
            (!Number.isFinite(update.number) || update.number < 0)) {
            console.error(`[IndustryTick] Invalid population update number for ${result.entityId}.${key}`);
            return false;
        }
    }

    // Validate prices are finite and nonnegative (wages)
    for(const [key, value] of Object.entries(result.wages)) {
        if(!Number.isFinite(value) || value < 0) {
            console.error(`[IndustryTick] Invalid wage value for ${result.entityId}.${key}: ${value}`);
            return false;
        }
    }

    return true;
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
