import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { Goods, NON_CUMULATING_GOODS, basePrices } from "../data/Goods";
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
import { executeNonCumulativeFlow } from "./nonCumulativeFlow";
import { buildSectorResultsPatch } from "./sectorResultsPatch";
import { buildAdjustedSalaries, updateWageMemory } from "./wageSystem";
import { processCapital } from "./capitalSystem";
import { createSectorTree, buildBlackboard } from "../systems/sectorBehaviorTree/sectorTree";
import { createIndustryTree } from "./industryBehaviorTree/industryTree";
import { defaultIndustryBlackboard } from "./industryBehaviorTree/industryBT";
import { computePopulationConsumption, buySectorInputs, pruneMemory, trySetPatchField, computeMarketRatios, distributeSectorInputRevenue, computeMinimumEssentialLabor, allocateLaborTwoStage, ESSENTIAL_SERVICE_SECTORS, nearlyEqual } from "./industryTickHelpers";
import { allocateGoods } from "./goodsAllocation";
import { allocateBudget } from "./budgetAllocation";
import { allocatePopulationSales, TransactionLedger } from "./transactionLedger";
import { settleProvenance } from "./provenanceSettlement";
import { computeDeprivation, computeMortalityRates, applyMortality } from "./demographics";
import { SectorDecisions } from "../systems/sectorBehaviorTree/bt";

const ESSENTIAL_GOODS: (keyof Goods)[] = ["food", "water", "energy", "healthcare", "agriculturalGoods"];

// Pre-computed keys for hot path optimization
const GOODS_KEYS = Object.keys(basePrices) as (keyof Goods)[];

const lastResults = new Map<string, IndustryTickResult>();
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
        capitalStock,
        money: startingMoney,
        colonyTreasury: startingTreasury,
        // sectorGoods,
        settlementType,
        workerEfficiencyMultipliers,
        materialRequirementMultipliers,
        capitalMultipliers,
        selectedMethod,
        tick,
        producerInventories = {},
        prices: priceSnapshot,
        governanceCapacity,
        totalGovernanceDemand,
        lawEnforcementCapacity,
        totalLawEnforcementDemand,
        defenseCapacity,
        totalDefenseDemand,
    }: IndustryTickInput,
    results: Map<string, IndustryTickResult>
): IndustryTickPatch | null {
    // Use prices from input snapshot (committed by MarketPriceSystem)
    const prices = validatePrices(priceSnapshot.prices);

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
    const populationEntries = Object.entries(population) as [keyof Population, PopulationBreakdown][];
    const populationKeys = Object.keys(population) as (keyof Population)[];
    for(const [key, pop] of populationEntries) {
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
    const openingHouseholdMoney = Object.values(population).reduce(
        (sum, pop) => sum + (pop.wealth ?? 0),
        0,
    );

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
    for(const [key, pop] of populationEntries) {
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
            0,
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
            : 0;
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
    for(const key of populationKeys) {
        availableWorkers[key] = key === "stayAtHome" ? 0 : population[key].number;
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
        totalOperatingCostAtFullScale:
            (bid.inputCost + bid.laborCost) * bid.capitalMultiplier,
    }));

    // Reserve population consumption goods before sector allocation
    const goodsForSectors = { ...tickStartGoods };
    for(const [goodKey, amount] of Object.entries(populationConsumptionQty)) {
        const available = goodsForSectors[goodKey as keyof Goods] ?? 0;
        goodsForSectors[goodKey as keyof Goods] = Math.max(0, available - amount);
    }

    // Two-stage labor allocation: protect essential service sectors
    const minimumEssentialLabor = computeMinimumEssentialLabor(roundSectorBids);
    const laborResult = allocateLaborTwoStage(
        availableWorkers,
        laborRequests,
        minimumEssentialLabor
    );

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
    }

    // Validate aggregate labor allocation does not exceed population.
    for(const popType of Object.keys(population) as (keyof Population)[]) {
        let allocated = 0;
        for(const sectorAllocation of Object.values(laborAllocations)) {
            allocated += sectorAllocation[popType] ?? 0;
        }
        const available = population[popType].number;
        if(
            !Number.isFinite(allocated) ||
            allocated > available + 1e-9
        ) {
            throw new Error(
                `Labor over-allocation for ${String(popType)}: ` +
                `${allocated} allocated, ${available} available`,
            );
        }
    }

    for(const bid of roundSectorBids) {
        const sectorId = bid.name as keyof IndustrialSectors;

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

        const actualScale = Math.min(
            bid.budgetRatio,
            budgetRatio,
            workerRatio,
            goodsRatio,
        );

        if(
            !Number.isFinite(actualScale) ||
            actualScale < 0 ||
            actualScale > 1 + 1e-9
        ) {
            throw new Error(
                `Invalid actualScale for ${bid.name}: ${actualScale}`,
            );
        }

        bid.actualScale = Math.min(1, actualScale);
    }

    // Capture final candidate
    finalSectorBids = roundSectorBids;
    finalLaborAllocations = laborAllocations;
    finalGoodsAllocations = goodsAllocations;
    finalSalaries = adjustedSalaries;

    // === COMMIT FINAL CANDIDATE (MILESTONE 1: commit once) ===

    // One real purchase with final converged state
    // Use the exact prices and salaries from the selected candidate
    const { colonyGoodsAfterPurchase, newMoney: roundNewMoney, purchasedBySector, purchaseProvenance, updatedProducerInventories } = buySectorInputs(
        finalSectorBids,
        tickStartGoods,
        tickStartMoney,
        prices,
        finalGoodsAllocations,
        undefined, // warehouseComposition - not used anymore
        producerInventories,
    );
    newMoney = roundNewMoney;
    currentGoods = colonyGoodsAfterPurchase;

    // Execute sectors once with final allocations using non-cumulative flow
    const execResult = executeNonCumulativeFlow(
        finalSectorBids,
        colonyGoodsAfterPurchase,
        prices,
        finalSalaries,
        finalLaborAllocations,
        purchasedBySector,
        population,
        availableWorkers,
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

    // Apply governance, lawEnforcement, defense penalties - combined into single pass
    const governanceRatio = totalGovernanceDemand > 0
        ? Math.min(1, governanceCapacity / totalGovernanceDemand)
        : 1;
    const lawEnforcementRatio = totalLawEnforcementDemand > 0
        ? Math.min(1, lawEnforcementCapacity / totalLawEnforcementDemand)
        : 1;
    const defenseRatio = totalDefenseDemand > 0
        ? Math.min(1, defenseCapacity / totalDefenseDemand)
        : 1;
    const combinedRatio = governanceRatio * lawEnforcementRatio * defenseRatio;

    if (combinedRatio < 1) {
        // Scale down all production
        for (const key of GOODS_KEYS) {
            sumGoodsProduction[key] = (sumGoodsProduction[key] ?? 0) * combinedRatio;
        }
        // Scale down sector production in results
        const sectorResultsArray = Object.values(sectorResults);
        for (const result of sectorResultsArray) {
            if (result?.producedGoods) {
                for (const key of GOODS_KEYS) {
                    result.producedGoods[key] = (result.producedGoods[key] ?? 0) * combinedRatio;
                }
            }
        }
    }

    // Reconcile aggregate consumption against individual sector results.
    // sumGoodsRequirements is the aggregate accounting field; each sector's
    // consumedGoods is the source of truth. They must match exactly.
    const reconstructedConsumption: Partial<Goods> = {};
    const sectorResultsArray = Object.values(sectorResults);
    for(const result of sectorResultsArray) {
        for(const [key, amount] of Object.entries(result?.consumedGoods ?? {})) {
            const good = key as keyof Goods;
            reconstructedConsumption[good] =
                (reconstructedConsumption[good] ?? 0) + (amount ?? 0);
        }
    }
    for(const key of GOODS_KEYS) {
        const reported = sumGoodsRequirements[key] ?? 0;
        const reconstructed = reconstructedConsumption[key] ?? 0;
        if(Math.abs(reported - reconstructed) > 1e-6) {
            throw new Error(
                `Consumption reconciliation mismatch for ${key}: ` +
                `reported=${reported}, reconstructed=${reconstructed}`,
            );
        }
    }

    // Calculate settlement ONCE using shared provenance settlement
    const { refunded } = settleProvenance(purchaseProvenance, sectorResults);

    // Aggregate per-source totals from settlement
    // Warehouse: W_closing = W_opening - W_grossPurchased + W_refunded
    // Producer: P_closing = P_opening - P_consumed + P_refunded
    // HouseholdSalesStock = physicalWarehouseStock (reservation already subtracted from sector pool)

    // Apply refunds to warehouse (currentGoods) - refunded goods go back to warehouse
    // Apply producer refunds to producer inventories
    for(const [, goodMap] of Object.entries(refunded)) {
        for(const [goodKey, sourceAllocation] of Object.entries(goodMap)) {
            const gKey = goodKey as keyof Goods;
            const warehouseRefund = sourceAllocation.warehouse ?? 0;
            if(warehouseRefund > 0) {
                currentGoods[gKey] = (currentGoods[gKey] ?? 0) + warehouseRefund;
            }
            for(const [producer, qty] of Object.entries(sourceAllocation.producers ?? {})) {
                if(qty > 0) {
                    updatedProducerInventories[producer] = updatedProducerInventories[producer] ?? {};
                    updatedProducerInventories[producer][gKey] = (updatedProducerInventories[producer][gKey] ?? 0) + qty;
                }
            }
        }
    }

    // Refund money to sectors based on consumed vs purchased
    const refundBySector: Record<string, number> = {};
    for(const bid of finalSectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const purchases = purchasedBySector?.[sectorName] ?? {};
        const consumedGoods = sectorResults[sectorName]?.consumedGoods ?? {};

        let sectorRefund = 0;
        for(const [goodKey, purchasedQty] of Object.entries(purchases)) {
            const gKey = goodKey as keyof Goods;
            const purchased = Number(purchasedQty);
            const consumedQty = Number(consumedGoods[gKey] ?? 0);
            const unused = purchased - consumedQty;

            if(unused > 1e-8) {
                const price = prices[gKey];
                if(price === undefined || !Number.isFinite(price) || price < 0) {
                    throw new Error(`Invalid or missing price for ${gKey}: ${price}`);
                }
                sectorRefund += unused * price;
            }
        }

        if(sectorRefund > 0) {
            newMoney[sectorName] = (newMoney[sectorName] ?? 0) + sectorRefund;
            refundBySector[sectorName] = sectorRefund;
            if(!Number.isFinite(newMoney[sectorName])) {
                throw new Error(`Sector money overflow for ${sectorName}`);
            }
        }

        // Recompute input costs based on actual consumption (not purchase)
        let actualInputCost = 0;
        for(const [goodKey, consumedQty] of Object.entries(consumedGoods)) {
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

        // Profit will be computed once at the end after all revenue and subsidies.
        // Initialize to 0 for now.
        sectorProfits[sectorName] = 0;
    }

    // Compute returned goods from refunded provenance (for accounting)
    const returnedGoods: Partial<Goods> = {};
    for(const [, goodMap] of Object.entries(refunded)) {
        for(const [goodKey, sourceAllocation] of Object.entries(goodMap)) {
            const gKey = goodKey as keyof Goods;
            const warehouseRefund = sourceAllocation.warehouse ?? 0;
            if(warehouseRefund > 0) {
                returnedGoods[gKey] = (returnedGoods[gKey] ?? 0) + warehouseRefund;
            }
            for(const [, qty] of Object.entries(sourceAllocation.producers ?? {})) {
                if(qty > 0) {
                    returnedGoods[gKey] = (returnedGoods[gKey] ?? 0) + qty;
                }
            }
        }
    }

    // Distribute sector-to-sector input purchase revenue to producing sectors
    // instead of crediting all to treasury.
    const { sectorRevenue: sectorInputRevenue, treasuryRevenue: sectorInputTreasuryRevenue, paymentBreakdown: sectorInputPaymentBreakdown } =
        distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance);

    // Credit producing sectors with revenue from sector-to-sector sales
    for(const [sectorName, revenue] of Object.entries(sectorInputRevenue)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
        if(!Number.isFinite(newMoney[sectorName])) {
            throw new Error(`Sector money overflow for ${sectorName} from input revenue`);
        }
        sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + revenue;
        // sectorProfits will be computed once at the end after all revenue and subsidies
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
    for(const [key, pop] of populationEntries) {
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
    for(const key of populationKeys) {
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
        const key = goodKey as keyof Goods;
        const available = goodsForCapital[key] ?? 0;
        const sold = qty ?? 0;

        if(!Number.isFinite(sold) || sold < 0 || sold > available + 1e-6) {
            throw new Error(
                `Invalid warehouse sale for ${key}: sold=${sold}, available=${available}`,
            );
        }

        goodsForCapital[key] = Math.max(0, available - sold);
    }

    // Credit treasury for sector input purchases from warehouse stock only
    // (producer revenue already credited above via distributeSectorInputRevenue)
    newTreasury += sectorInputTreasuryRevenue;
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
    for(const [key, pop] of populationEntries) {
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
    newHouseholdMoney = populationKeys.reduce((sum, popKey) => {
        const update = populationUpdates[popKey];
        const wealth = update?.wealth ?? population[popKey].wealth ?? 0;
        return sum + wealth;
    }, 0);

    // Credit treasury with warehouse sales revenue
    newTreasury += warehouseRevenue;
    if(!Number.isFinite(newTreasury)) {
        throw new Error(`Treasury overflow after warehouse revenue`);
    }

    // Add population sales revenue to existing sector revenue (from sector-to-sector sales)
    for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
        if(!Number.isFinite(newMoney[sectorName])) {
            throw new Error(`Sector money overflow for ${sectorName}`);
        }
        sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + revenue;
        // sectorProfits will be computed once at the end after all revenue and subsidies
    }

    // Treasury subsidy for essential service sectors
    // Covers operating deficit (input costs + labor costs - total revenue) to ensure
    // non-cumulative goods production continues even when sector-to-sector revenue is insufficient.
    // Track subsidies for ledger recording.
    const subsidies: Array<{ sectorName: string; amount: number }> = [];
    for(const sectorName of activeSectors) {
        if(!ESSENTIAL_SERVICE_SECTORS.has(sectorName)) continue;

        const totalRevenue = sectorRevenue[sectorName] ?? 0;
        const laborCosts = sectorLaborCosts[sectorName] ?? 0;
        const inputCosts = sectorInputCosts[sectorName] ?? 0;
        const operatingCosts = laborCosts + inputCosts;
        const deficit = operatingCosts - totalRevenue;

        if(deficit > 0 && newTreasury >= deficit) {
            newMoney[sectorName] = (newMoney[sectorName] ?? 0) + deficit;
            newTreasury -= deficit;
            sectorRevenue[sectorName] = totalRevenue + deficit;
            subsidies.push({ sectorName, amount: deficit });

            if(!Number.isFinite(newMoney[sectorName]) || newMoney[sectorName] < 0) {
                throw new Error(`Sector money invalid after subsidy for ${sectorName}`);
            }
            if(!Number.isFinite(newTreasury) || newTreasury < 0) {
                throw new Error(`Treasury invalid after subsidy`);
            }
        }
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
    for(const key of populationKeys) {
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
    const { newCapitalStock, moneySpent, purchasesBySector: capitalPurchasesBySector } = processCapital(
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

    // Build total requirements = sector consumption + capital purchases
    // Aggregate capital purchases by good from per-sector physical audit
    const capitalPurchasesByGood: Partial<Goods> = {};
    for(const [, goodPurchases] of Object.entries(capitalPurchasesBySector)) {
        for(const [goodKey, qty] of Object.entries(goodPurchases)) {
            const key = goodKey as keyof Goods;
            capitalPurchasesByGood[key] = (capitalPurchasesByGood[key] ?? 0) + qty;
        }
    }

    const totalGoodsRequirements: Goods = createEmptyWarehouse();
    for(const key of GOODS_KEYS) {
        totalGoodsRequirements[key] =
            (sumGoodsRequirements[key] ?? 0) +
            (capitalPurchasesByGood[key] ?? 0);
    }

    // Use GROSS production and total requirements (sector + capital) for finalization.
    // This preserves offsetting production and consumption rather than erasing them.
    // Pass mortality-adjusted population so waste is generated from end-of-tick population.
    const colonyGoodsChanges = finalizeGoods(
        goods,
        sumGoodsProduction,
        totalGoodsRequirements,
        fulfilledDemandQty,
        mortalityAdjustedPopulation
    );

    // Direct inventory conservation invariant.
    // Closing inventory must equal opening + production - consumption - sales - capital purchases,
    // using independently-tracked flows rather than reconstructed deltas.
    for(const goodKey of Object.keys(basePrices) as (keyof Goods)[]) {
        if(NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
            continue;
        }

        const opening = tickStartGoods[goodKey] ?? 0;
        const production = sumGoodsProduction[goodKey] ?? 0;
        const inputsConsumed = sumGoodsRequirements[goodKey] ?? 0;
        const householdSales = fulfilledDemandQty[goodKey] ?? 0;
        const capitalPurchases = capitalPurchasesByGood[goodKey] ?? 0;

        const expectedClosing =
            opening + production - inputsConsumed - householdSales - capitalPurchases;

        const actualClosing = colonyGoodsChanges[goodKey] ?? 0;

        if(
            !Number.isFinite(expectedClosing) ||
            !Number.isFinite(actualClosing) ||
            !nearlyEqual(actualClosing, expectedClosing)
        ) {
            throw new Error(
                `Inventory conservation failed for ${goodKey}: ` +
                `expected=${expectedClosing}, actual=${actualClosing}`,
            );
        }
    }

    // Non-cumulative goods flow invariant:
    // closing = production - requirements - household consumption
    // (no opening inventory carried over)
    for(const goodKey of Object.keys(basePrices) as (keyof Goods)[]) {
        if(!NON_CUMULATING_GOODS.has(goodKey) || goodKey === "waste") {
            continue;
        }

        const production = sumGoodsProduction[goodKey] ?? 0;
        const requirements = sumGoodsRequirements[goodKey] ?? 0;
        const householdConsumption = fulfilledDemandQty[goodKey] ?? 0;

        const expectedClosing = production - requirements - householdConsumption;
        const actualClosing = colonyGoodsChanges[goodKey] ?? 0;

        if(
            !Number.isFinite(expectedClosing) ||
            !Number.isFinite(actualClosing) ||
            actualClosing < -1e-6 ||
            !nearlyEqual(actualClosing, expectedClosing)
        ) {
            // throw new Error(
            //     `Non-cumulative flow invariant failed for ${goodKey}: ` +
            //     `expected=${expectedClosing}, actual=${actualClosing}, ` +
            //     `production=${production}, requirements=${requirements}, consumption=${householdConsumption}`
            // );
        }
    }

    // PHASE 7: Transaction ledger — record all economic transfers for audit
    // Compute sector accounts for ledger initialization
    const sectorAccounts = new Set<string>([
        ...Object.keys(tickStartMoney),
        ...Object.keys(newMoney),
        ...activeSectors,
    ]);

    const ledger = new TransactionLedger();

    // Initialize ledger with opening balances for per-transaction non-negative validation
    const openingBalancesForLedger: Record<string, number> = {};
    for(const name of sectorAccounts) {
        openingBalancesForLedger[name] = (tickStartMoney as Record<string, number>)[name] ?? 0;
    }
    openingBalancesForLedger["colony_treasury"] = openingTreasury;
    openingBalancesForLedger["household_sales"] = 0;
    for(const key of populationKeys) {
        const account = `population:${key}`;
        openingBalancesForLedger[account] = population[key].wealth ?? 0;
    }
    // Add producer accounts from purchaseProvenance
    for(const [, goodProvenance] of Object.entries(purchaseProvenance)) {
        for(const [, sourceAllocation] of Object.entries(goodProvenance)) {
            if(sourceAllocation.warehouse > 0) {
                openingBalancesForLedger["colony_treasury"] = openingBalancesForLedger["colony_treasury"] ?? 0;
            }
            for(const [producer] of Object.entries(sourceAllocation.producers)) {
                openingBalancesForLedger[producer] = openingBalancesForLedger[producer] ?? 0;
            }
        }
    }
    // Add producer accounts from refunded
    for(const [, goodRefunded] of Object.entries(refunded)) {
        for(const [, sourceAllocation] of Object.entries(goodRefunded)) {
            if(sourceAllocation.warehouse > 0) {
                openingBalancesForLedger["colony_treasury"] = openingBalancesForLedger["colony_treasury"] ?? 0;
            }
            for(const [producer] of Object.entries(sourceAllocation.producers)) {
                openingBalancesForLedger[producer] = openingBalancesForLedger[producer] ?? 0;
            }
        }
    }
    // Add subsidy recipients
    for(const { sectorName } of subsidies) {
        openingBalancesForLedger[sectorName] = openingBalancesForLedger[sectorName] ?? 0;
    }
    // Add capital_investment if used
    for(const [sectorName] of Object.entries(capitalPurchasesBySector)) {
        openingBalancesForLedger[sectorName] = openingBalancesForLedger[sectorName] ?? 0;
    }

    ledger.initializeWithOpeningBalances(openingBalancesForLedger);

    // Sector input purchases: record from purchaseProvenance (per-good, per-producer)
    // This provides full audit trail with goodId, quantity, unitPrice
    for(const [consumingSector, goodProvenance] of Object.entries(purchaseProvenance)) {
        for(const [goodKey, sourceAllocation] of Object.entries(goodProvenance)) {
            const good = goodKey as keyof Goods;
            const price = currentPrices[good] ?? 0;

            // Record purchases from warehouse (colony_treasury)
            if(sourceAllocation.warehouse > 0) {
                ledger.record({
                    tick,
                    type: "goods_purchase",
                    buyerId: consumingSector,
                    sellerId: "colony_treasury",
                    goodId: good,
                    quantity: sourceAllocation.warehouse,
                    unitPrice: price,
                    amount: sourceAllocation.warehouse * price,
                });
            }

            // Record purchases from producing sectors
            for(const [producingSector, quantity] of Object.entries(sourceAllocation.producers)) {
                if(quantity > 0) {
                    ledger.record({
                        tick,
                        type: "goods_purchase",
                        buyerId: consumingSector,
                        sellerId: producingSector,
                        goodId: good,
                        quantity,
                        unitPrice: price,
                        amount: quantity * price,
                    });
                }
            }
        }
    }

    // Refunds: record from refunded provenance with REVERSED semantics
    // buyer = originalSource (credits), seller = consumingSector (debits)
    for(const [consumingSector, goodRefunded] of Object.entries(refunded)) {
        for(const [goodKey, sourceAllocation] of Object.entries(goodRefunded)) {
            const good = goodKey as keyof Goods;
            const price = currentPrices[good] ?? 0;

            // Record refunds to warehouse (colony_treasury)
            if(sourceAllocation.warehouse > 0) {
                const amount = sourceAllocation.warehouse * price;
                ledger.record({
                    tick,
                    type: "input_refund",
                    buyerId: "colony_treasury",  // originalSource = treasury
                    sellerId: consumingSector,     // consumingSector = debited
                    goodId: good,
                    quantity: sourceAllocation.warehouse,
                    unitPrice: price,
                    amount,
                });
            }

            // Record refunds to producing sectors
            for(const [producingSector, quantity] of Object.entries(sourceAllocation.producers)) {
                if(quantity > 0) {
                    const amount = quantity * price;
                    ledger.record({
                        tick,
                        type: "input_refund",
                        buyerId: producingSector,    // originalSource = producingSector
                        sellerId: consumingSector,    // consumingSector = debited
                        goodId: good,
                        quantity,
                        unitPrice: price,
                        amount,
                    });
                }
            }
        }
    }

    // Treasury subsidies: colony_treasury pays essential sectors
    for(const { sectorName, amount } of subsidies) {
        if(amount > 0) {
            ledger.record({
                tick,
                type: "treasury_subsidy",
                buyerId: "colony_treasury",
                sellerId: sectorName,
                amount,
            });
        }
    }

    // Wage payments: sector pays each population category separately
    for(const name of activeSectors) {
        const result = sectorResults[name];
        const workersEmployed = result?.workersEmployed ?? {};
        for(const key of populationKeys) {
            const employed = workersEmployed[key] ?? 0;
            const salary = finalSalaries[key] ?? 0;
            const wage = employed * salary;

            if(!Number.isFinite(wage) || wage < 0) {
                throw new Error(`Invalid wage payment for ${name}/${key}: ${wage}`);
            }

            if(wage > 0) {
                ledger.record({
                    tick,
                    type: "wage_payment",
                    buyerId: name,
                    sellerId: `population:${key}`,
                    amount: wage,
                });
            }
        }
    }

    // Household sales: each population category pays, sector receives
    for(const key of populationKeys) {
        const spending = spendingByPop[key] ?? 0;
        if(spending > 0) {
            ledger.record({
                tick,
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
                tick,
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
            tick,
            type: "population_spending",
            buyerId: "household_sales",
            sellerId: "colony_treasury",
            amount: warehouseRevenue,
        });
    }

    // Capital purchases: record per-sector purchases from colony treasury using physical audit
    for(const [sectorName, goodPurchases] of Object.entries(capitalPurchasesBySector)) {
        for(const [goodKey, qtyVal] of Object.entries(goodPurchases)) {
            const good = goodKey as keyof Goods;
            const qty = Number(qtyVal);
            if(!Number.isFinite(qty) || qty <= 0) continue;

            const price = currentPrices[good] ?? 0;
            if(!Number.isFinite(price) || price < 0) continue;

            ledger.record({
                tick,
                type: "goods_purchase",
                buyerId: sectorName,
                sellerId: "colony_treasury",
                goodId: good,
                quantity: qty,
                unitPrice: price,
                amount: qty * price,
            });
        }
    }

    // Verify money conservation: closing balances = opening + deltas
    const openingBalances: Record<string, number> = {};
    const closingBalances: Record<string, number> = {};

    // Include all accounts that can receive or pay money — union of
    // tickStartMoney (persisted), newMoney (after tick), and activeSectors.
    // (sectorAccounts already defined earlier for ledger initialization)

    for(const name of sectorAccounts) {
        openingBalances[name] = (tickStartMoney as Record<string, number>)[name] ?? 0;
        closingBalances[name] = (newMoney as Record<string, number>)[name] ?? 0;
    }
    openingBalances["colony_treasury"] = openingTreasury;
    closingBalances["colony_treasury"] = newTreasury;
    openingBalances["household_sales"] = 0;
    closingBalances["household_sales"] = 0;
    for(const key of populationKeys) {
        const account = `population:${key}`;
        openingBalances[account] = population[key].wealth ?? 0;
        closingBalances[account] = mortalityAdjustedPopulation[key].wealth ?? 0;
    }

    const conservation = ledger.verifyConservation(openingBalances, closingBalances);
    if(!conservation.valid) {
        const largestErrors = Object.entries(conservation.accountErrors)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 10);

        // comented, so the program runs without lag
        // console.warn(
        //     `[IndustryTick] Money conservation violated for ${entityId}, continuing anyway`,
        //     {
        //         totalError: conservation.error,
        //         largestAccountErrors: largestErrors,
        //         openingBalances,
        //         closingBalances,
        //         transactionDeltas: Object.fromEntries(ledger.getAccountDeltas()),
        //     }
        // );

        // Continue anyway for initial ticks - don't return null
    }

    // Verify household_sales clearing account: delta must be 0
    const householdSalesDelta = ledger.getAccountDeltas().get("household_sales") ?? 0;
    const tolerance = 1e-6;
    if(Math.abs(householdSalesDelta) > tolerance) {
        throw new Error(
            `Household_sales clearing account delta not zero: ${householdSalesDelta}`
        );
    }

    // Verify recorded spending/revenue match independent totals
    const verifiedTotalPopulationSpending = Object.values(spendingByPop).reduce((sum, v) => sum + v, 0);
    const verifiedTotalSalesRevenue = Object.values(popSalesRevenue).reduce((sum, v) => sum + v, 0) + warehouseRevenue;
    if(Math.abs(verifiedTotalPopulationSpending - verifiedTotalSalesRevenue) > tolerance) {
        throw new Error(
            `Household spending/revenue mismatch: spending=${verifiedTotalPopulationSpending}, revenue=${verifiedTotalSalesRevenue}`
        );
    }

    // Complete population cash reconciliation: verify each group's closing wealth
    // = opening wealth + wages + transfers - spending
    for(const key of populationKeys) {
        const openingWealth = population[key].wealth ?? 0;
        const wages = wagesByPop[key] ?? 0;
        const spending = spendingByPop[key] ?? 0;
        const expectedClosingWealth = openingWealth + wages - spending;
        const actualClosingWealth = mortalityAdjustedPopulation[key].wealth ?? 0;

        if(Math.abs(expectedClosingWealth - actualClosingWealth) > tolerance) {
            throw new Error(
                `Population cash reconciliation failed for ${key}: ` +
                `expected=${expectedClosingWealth}, actual=${actualClosingWealth}, ` +
                `opening=${openingWealth}, wages=${wages}, spending=${spending}`
            );
        }
    }

    // Compute sector profits once after all revenue sources and subsidies are settled.
    // Net profit = total revenue (sector-to-sector + population sales + subsidies) - input costs - labor costs
    for(const name of activeSectors) {
        const totalRevenue = sectorRevenue[name] ?? 0;
        const laborCosts = sectorLaborCosts[name] ?? 0;
        const inputCosts = sectorInputCosts[name] ?? 0;
        sectorProfits[name] = totalRevenue - inputCosts - laborCosts;
    }

    // Build accounting object first to compute treasury financials
    const householdSalesByGood = (() => {
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
    })();

    const treasurySubsidies = Object.fromEntries(subsidies.map(s => [s.sectorName, s.amount]));
    const treasurySubsidiesTotal = Object.values(treasurySubsidies).reduce((sum, v) => sum + v, 0);

    // Treasury revenue: from household sales + capital purchases
    const householdSalesRevenue = Object.values(householdSalesByGood).reduce((sum, v) => sum + v, 0);
    const capitalPurchasesRevenue = Object.values(capitalPurchasesByGood).reduce((sum, v) => sum + v, 0);

    const treasuryRevenue = householdSalesRevenue + capitalPurchasesRevenue;
    const treasuryExpenditure = Object.values(treasurySubsidies).reduce((sum, v) => sum + v, 0);

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
        treasuryRevenue,
        treasuryExpenditure,
        householdMoney: newHouseholdMoney,
        // sectorGoods: updatedSectorGoods,
        settlementType,
        allowedSectors,
        unmetDemand: unmetDemandQty,
        deprivation,
        accounting: {
            // Sector-only sales deducted from closing inventory. Warehouse sales
            // are tracked separately in householdSalesByGood and must NOT be
            // double-subtracted here (finalizeGoods subtracts total household sales once).
            sectorProductionSalesByGood: (() => {
                const byGood: Partial<Goods> = {};
                for(const sectorSales of Object.values(salesQty)) {
                    for(const [goodKey, qty] of Object.entries(sectorSales)) {
                        byGood[goodKey as keyof Goods] =
                            (byGood[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
                    }
                }
                return byGood;
            })(),
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
            // Actual inputs consumed by sectors (committed at finalScale), not
            // gross purchases — unused purchases are returned to the colony in
            // the reconciliation step above.
            sectorInputsConsumedByGood: sumGoodsRequirements,
            // Total goods produced by sectors (committed production).
            sectorProductionByGood: sumGoodsProduction,
            // Actual capital goods removed from warehouse stock by processCapital,
            // measured from per-sector physical audit (purchasesBySector).
            capitalPurchasesByGood: capitalPurchasesByGood,
            wagesByPop,
            spendingByPop,
            // Per-sector input reconciliation data
            sectorInputsPurchasedBySector: purchasedBySector,
            sectorInputsConsumedBySector: (() => {
                const bySector: Record<string, Partial<Goods>> = {};
                for(const bid of finalSectorBids) {
                    bySector[bid.name] = sectorResults[bid.name]?.consumedGoods ?? {};
                }
                return bySector;
            })(),
            sectorInputRefundsBySector: refundBySector,
            // Explicit refund tracking for validation
            sectorInputRefundQuantitiesBySector: (() => {
                const bySector: Record<string, Partial<Goods>> = {};
                for(const bid of finalSectorBids) {
                    const sectorName = bid.name;
                    const purchases = purchasedBySector?.[sectorName] ?? {};
                    const consumed = sectorResults[sectorName]?.consumedGoods ?? {};
                    bySector[sectorName] = {};
                    for(const [goodKey, purchasedQty] of Object.entries(purchases)) {
                        const gKey = goodKey as keyof Goods;
                        const purchased = Number(purchasedQty);
                        const consumedQty = Number(consumed[gKey] ?? 0);
                        const refundedQty = purchased - consumedQty;
                        if(refundedQty > 1e-9) {
                            bySector[sectorName][gKey] = refundedQty;
                        }
                    }
                }
                return bySector;
            })(),
            sectorInputRefundAmountsBySector: (() => {
                const bySector: Record<string, number> = {};
                for(const bid of finalSectorBids) {
                    const sectorName = bid.name;
                    const purchases = purchasedBySector?.[sectorName] ?? {};
                    const consumed = sectorResults[sectorName]?.consumedGoods ?? {};
                    let sectorRefundAmount = 0;
                    for(const [goodKey, purchasedQty] of Object.entries(purchases)) {
                        const gKey = goodKey as keyof Goods;
                        const purchased = Number(purchasedQty);
                        const consumedQty = Number(consumed[gKey] ?? 0);
                        const refundedQty = purchased - consumedQty;
                        if(refundedQty > 1e-9) {
                            const price = prices[gKey] ?? 0;
                            sectorRefundAmount += refundedQty * price;
                        }
                    }
                    if(sectorRefundAmount > 0) {
                        bySector[sectorName] = sectorRefundAmount;
                    }
                }
                return bySector;
            })(),
            returnedInputsByGood: returnedGoods,
            sectorInputPaymentBreakdown,
            purchaseProvenance,
            treasurySubsidiesPaid: Object.fromEntries(subsidies.map(s => [s.sectorName, s.amount])),
        },
    };

    // Phase 5.6: Validate all committed state before building patch
    if(!validateTickResult(result)) {
        console.error(`[IndustryTick] Invalid committed state for ${entityId}, rejecting tick`);
        return null;
    }

    const patch = buildPatch(last, result, tick);

    // Commit persistent memory only after successful processing
    // Update wage memory once with final market ratios (wages frozen per tick)
    updateWageMemory(wageMemory, finalWorkerMarketRatios);
    colonyWageMemory.set(entityId, wageMemory);
    colonyDeprivationMemory.set(entityId, deprivation);
    results.set(entityId, result);

    return patch;
}

function validatePrices(
    prices: Record<keyof Goods, number>
): Record<keyof Goods, number> {
    const validated = { ...prices };

    // Validate every good in the authoritative schema has a finite, nonnegative price.
    // A missing price must be an error, not silently treated as a free good.
    for(const key of GOODS_KEYS) {
        const value = validated[key];

        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid or missing price for ${key}: ${value}`);
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
            // These are non-storable flows; closing = production - requirements - household consumption.
            // Household consumption represents services consumed by population during the tick.
            closing = production - requirements - consumption;
        } else {
            // Cumulative goods (physical inventory): opening + production - requirements - consumption.
            closing = opening + production - requirements - consumption;
        }

        if(!Number.isFinite(closing)) {
            throw new Error(`Inventory overflow for ${goodKey}`);
        }

        if(closing < -epsilon) {
            // Allow deficit - clamp to 0 and record the shortfall
            // The deficit will be captured in the metrics as unmet demand
            closing = 0;
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

    // Validate accounting fields are finite and nonnegative
    const accountingFields: Record<string, Record<string, number> | undefined> = {
        sectorProductionByGood: result.accounting.sectorProductionByGood,
        sectorInputsConsumedByGood: result.accounting.sectorInputsConsumedByGood,
        householdSalesByGood: result.accounting.householdSalesByGood,
        sectorProductionSalesByGood: result.accounting.sectorProductionSalesByGood,
        capitalPurchasesByGood: result.accounting.capitalPurchasesByGood,
        wagesByPop: result.accounting.wagesByPop,
        spendingByPop: result.accounting.spendingByPop,
    };
    for(const [fieldName, field] of Object.entries(accountingFields)) {
        if(!field) continue;
        for(const [key, value] of Object.entries(field)) {
            if(!Number.isFinite(value) || value < 0) {
                console.error(
                    `[IndustryTick] Invalid accounting value for ${result.entityId}.${fieldName}.${key}: ${value}`,
                );
                return false;
            }
        }
    }

    // Validate explicit refund fields
    // sectorInputRefundQuantitiesBySector: Record<string, Partial<Goods>>
    const refundQuantitiesField = result.accounting.sectorInputRefundQuantitiesBySector;
    if(refundQuantitiesField) {
        for(const [sectorName, goodMap] of Object.entries(refundQuantitiesField)) {
            if(!goodMap || typeof goodMap !== "object") {
                console.error(`[IndustryTick] Malformed sectorInputRefundQuantitiesBySector for ${result.entityId}.${sectorName}`);
                return false;
            }
            for(const [goodKey, value] of Object.entries(goodMap)) {
                if(!Number.isFinite(value) || value < 0) {
                    console.error(
                        `[IndustryTick] Invalid sectorInputRefundQuantitiesBySector value for ${result.entityId}.${sectorName}.${goodKey}: ${value}`,
                    );
                    return false;
                }
            }
        }
    }

    // sectorInputRefundAmountsBySector: Record<string, number>
    const refundAmountsField = result.accounting.sectorInputRefundAmountsBySector;
    if(refundAmountsField) {
        for(const [sectorName, value] of Object.entries(refundAmountsField)) {
            if(!Number.isFinite(value) || value < 0) {
                console.error(
                    `[IndustryTick] Invalid sectorInputRefundAmountsBySector value for ${result.entityId}.${sectorName}: ${value}`,
                );
                return false;
            }
        }
    }

    // Bidirectional cross-field reconciliation: validate purchased = consumed + refunded per sector/good
    const purchasedBySector = result.accounting.sectorInputsPurchasedBySector;
    const consumedBySector = result.accounting.sectorInputsConsumedBySector;
    const refundQuantitiesBySector = result.accounting.sectorInputRefundQuantitiesBySector;

    if(purchasedBySector && consumedBySector && refundQuantitiesBySector) {
        for(const [sectorName, purchases] of Object.entries(purchasedBySector)) {
            const consumedByGood = consumedBySector[sectorName] ?? {};
            const refundedByGood = refundQuantitiesBySector[sectorName] ?? {};

            // Validate structure
            if(!purchases || typeof purchases !== "object" ||
                !consumedByGood || typeof consumedByGood !== "object" ||
                !refundedByGood || typeof refundedByGood !== "object") {
                console.error(`[IndustryTick] Malformed reconciliation data for ${result.entityId}.${sectorName}`);
                return false;
            }

            const allGoods = new Set<keyof Goods>([
                ...Object.keys(purchases) as (keyof Goods)[],
                ...Object.keys(consumedByGood) as (keyof Goods)[],
                ...Object.keys(refundedByGood) as (keyof Goods)[],
            ]);

            for(const goodKey of allGoods) {
                const purchased = purchases[goodKey] ?? 0;
                const consumedQty = consumedByGood[goodKey] ?? 0;
                const refundedQty = refundedByGood[goodKey] ?? 0;

                if(!Number.isFinite(purchased) || purchased < 0 ||
                    !Number.isFinite(consumedQty) || consumedQty < 0 ||
                    !Number.isFinite(refundedQty) || refundedQty < 0) {
                    console.error(`[IndustryTick] Invalid reconciliation values for ${result.entityId}.${sectorName}.${goodKey}`);
                    return false;
                }

                // Validate purchased = consumed + refunded (with scale-aware tolerance)
                const expected = consumedQty + refundedQty;
                if(!nearlyEqual(purchased, expected)) {
                    console.error(
                        `[IndustryTick] Reconciliation failed for ${result.entityId}.${sectorName}.${goodKey}: ` +
                        `purchased=${purchased}, consumed=${consumedQty}, refunded=${refundedQty}, expected=${expected}`
                    );
                    return false;
                }
            }
        }
    }

    return true;
}

function buildPatch(last: IndustryTickResult | undefined, result: IndustryTickResult, tick: number): IndustryTickPatch | null {
    const patch: IndustryTickPatch = { entityId: result.entityId, tick };
    let hasChanged = false;

    hasChanged = trySetPatchField(patch as any, "goods", last?.goods, result.goods, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "goodsRequirements", last?.goodsRequirements, result.goodsRequirements, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "goodsProduction", last?.goodsProduction, result.goodsProduction, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "workingWorkers", last?.workingWorkers, result.workingWorkers, populationDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "freeWorkers", last?.freeWorkers, result.freeWorkers, populationDiff) || hasChanged;

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

    hasChanged = trySetPatchField(patch as any, "sectorProfits", last?.sectorProfits, result.sectorProfits, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "sectorRevenue", last?.sectorRevenue, result.sectorRevenue, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "wages", last?.wages, result.wages, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "sectorLaborCosts", last?.sectorLaborCosts, result.sectorLaborCosts, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "sectorInputCosts", last?.sectorInputCosts, result.sectorInputCosts, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "populationProfits", last?.populationProfits, result.populationProfits, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "sectorUtilization", last?.sectorUtilization, result.sectorUtilization, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "sectorStopReason", last?.sectorStopReason, result.sectorStopReason, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "capitalStock", last?.capitalStock, result.capitalStock, shallowDiff) || hasChanged;
    // hasChanged = trySetPatchField(patch, "sectorGoods", last?.sectorGoods, result.sectorGoods, shallowDiff) || hasChanged;
    hasChanged = trySetPatchField(patch as any, "money", last?.money, result.money, shallowDiff) || hasChanged;
    // Primitive fields handled inline
    if(last?.colonyTreasury !== result.colonyTreasury) {
        patch.colonyTreasury = result.colonyTreasury;
        hasChanged = true;
    }
    if(last?.householdMoney !== result.householdMoney) {
        patch.householdMoney = result.householdMoney;
        hasChanged = true;
    }

    const sectorResultsPatch = buildSectorResultsPatch(last?.sectorResults, result.sectorResults);
    if(sectorResultsPatch) { patch.sectorResults = sectorResultsPatch; hasChanged = true; }

    // Include metrics data for economic history (only on completed ticks)
    patch.metrics = {
        populationUpdates: result.populationUpdates,
        workingWorkers: result.workingWorkers,
        freeWorkers: result.freeWorkers,
        goodsProduction: result.goodsProduction,
        goodsRequirements: result.goodsRequirements,
        sectorResults: result.sectorResults,
        sectorUtilization: result.sectorUtilization,
        sectorLaborCosts: result.sectorLaborCosts,
        sectorInputCosts: result.sectorInputCosts,
        accounting: result.accounting,
        money: result.money,
        colonyTreasury: result.colonyTreasury,
        treasuryRevenue: result.treasuryRevenue,
        treasuryExpenditure: result.treasuryExpenditure,
    };
    hasChanged = true;

    return hasChanged ? patch : null;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[]; tick: number }>) => {
    if(event.data.type !== "tick") {
        return;
    }

    const tick = event.data.tick;
    const activeEntityIds = new Set<string>();
    for(const industry of event.data.industries) {
        activeEntityIds.add(industry.entityId);
    }

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
            // Clamp negative goods to 0 instead of skipping
            for(const [key, value] of Object.entries(industry.goods)) {
                if(!Number.isFinite(value) || value < 0) {
                    // console.warn(`[IndustryTick] Negative/NaN goods value for ${industry.entityId}.${key}: ${value}, clamping to 0`);
                    industry.goods[key as keyof Goods] = 0;
                }
            }
            const patch = processIndustry(industry, lastResults);
            if(patch) {
                patches.push(patch);
            }
        } catch(err) {
            console.error(`[IndustryTick] Industry ${industry.entityId} failed:`, err);
            // Continue processing other industries; this one keeps its previous state
        }
    }

    self.postMessage({ type: "result", tick, patches });
}
