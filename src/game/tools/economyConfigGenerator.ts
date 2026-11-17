import { basePrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods.ts";
import { Population, PopulationBreakdown } from "../data/Population.ts";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse.ts";
import { industrySectorBlueprints } from "../systems/sectorBlueprints.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { SectorBid } from "../workers/SectorBid.ts";
import { buildSectorBid } from "../workers/buildSectorBid.ts";
import { executeSectors } from "../workers/sectorExecution.ts";
import {
	computePopulationConsumption,
	buySectorInputs,
	computeColonyGoodsDelta,
	applyGoodsModifier,
	computeMarketRatios,
} from "../workers/industryTickHelpers.ts";
import { allocatePopulationSales } from "../workers/transactionLedger.ts";
import { processCapital } from "../workers/capitalSystem.ts";
import { buildAdjustedSalaries, updateWageMemory } from "../workers/wageSystem.ts";
import { createSectorTree, buildBlackboard } from "../systems/sectorBehaviorTree/sectorTree.ts";
import { createIndustryTree } from "../workers/industryBehaviorTree/industryTree.ts";
import { defaultIndustryBlackboard } from "../workers/industryBehaviorTree/industryBT.ts";
import { PER_CAPITA_SECTOR_RATIOS } from "../factories/createStarterIndustry.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";

export const sectors = new Set<keyof IndustrialSectors>(
	(Object.keys(PER_CAPITA_SECTOR_RATIOS) as unknown) as (keyof IndustrialSectors)[]
);

export const ESSENTIAL_GOODS: (keyof Goods)[] = [
	"food",
	"water",
	"energy",
	"agriculturalGoods",
	"oil",
	"buildings",
	"consumerGoods",
];

export const ESSENTIAL_SECTORS: (keyof IndustrialSectors)[] = [
	"powerPlant",
	"waterTreatment",
	"farm",
	"foodFactory",
	"oilRig",
	"religion",
	"defense",
	"consumerFactory",
	"lawEnforcement",
	"mobility",
	"healthcare",
	"paperFactory",
	"logistics",
	"services",
];

export interface ColonyConfig {
	populationSize: number;
	activeSectors: (keyof IndustrialSectors)[];
	starterMoneyPerSector: number;
	capitalStockMultiplier: number;
	initialGoodsMultipliers: Map<keyof Goods, number>;
	capitalStockMultipliers: Map<keyof IndustrialSectors, number>;
}

export const DEFAULT_CONFIG: ColonyConfig = {
	populationSize: 50_000_000,
	activeSectors: Array.from(sectors),
	starterMoneyPerSector: 50_000_000,
	capitalStockMultiplier: 1,
	initialGoodsMultipliers: new Map(),
	capitalStockMultipliers: new Map(),
} as const;

export interface ColonyValidationResult {
	viable: boolean;
	ticksSurvived: number;
	failedGood?: { good: keyof Goods; tick: number; value: number };
	failedSector?: { sector: keyof IndustrialSectors; tick: number; money: number };
	minGoods: Partial<Record<keyof Goods, number>>;
	maxMoneyDeficit: Partial<Record<keyof IndustrialSectors, number>>;
}

const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;

export interface SimState {
	priceMemory: Partial<Record<keyof Goods, number>>;
	wageMemory: Partial<Record<keyof Population, number>>;
	lastResult: IndustryTickResult | null;
	tick: number;
}

export function createSimState(): SimState {
	return {
		priceMemory: {},
		wageMemory: {},
		lastResult: null,
		tick: 0,
	};
}

/**
 * Throws if any sector money balance goes negative after all deductions.
 * Sectors cannot overspend — purchases are constrained by available cash.
 */
function validateSectorMoney(
	newMoney: Record<string, number>,
	activeSectors: Iterable<keyof IndustrialSectors>,
	entityId: string,
): void {
	for(const name of activeSectors) {
		const balance = newMoney[name] ?? 0;
		if(!Number.isFinite(balance) || balance < -1e-6) {
			throw new Error(
				`Invalid sector cash balance for ${entityId}.${name}: ${balance}`,
			);
		}
		newMoney[name] = Math.max(0, balance);
	}
}

/**
 * Subtracts a consumption amount from inventory, throwing on meaningful deficit.
 */
function subtractChecked(current: number, amount: number, good: keyof Goods): number {
	const result = current - amount;
	if(!Number.isFinite(result) || result < -1e-6) {
		throw new Error(
			`Inventory deficit for ${good}: opening=${current}, consumed=${amount}`,
		);
	}
	return Math.max(0, result);
}

export function simulateTick(input: IndustryTickInput, state: SimState): IndustryTickResult {
	const {
		entityId,
		activeSectors,
		goods,
		population,
		techMultipliers,
		capitalStock,
		money: startingMoney,
		colonyTreasury: startingTreasury,
		settlementType,
		allowedSectors,
		workerEfficiencyMultipliers,
		materialRequirementMultipliers,
		capitalMultipliers,
		selectedMethod,
	} = input;

	// Use temp memory copies for this tick; commit once at the end.
	// Prevents price/wage memory from being updated multiple times per tick
	// by the iterative allocation loop.
	const tempPriceMemory = { ...state.priceMemory };
	const tempWageMemory = { ...state.wageMemory };

	const prices = getPrices(goods, tempPriceMemory);
	const adjustedSalaries = buildAdjustedSalaries(tempWageMemory);

	const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

	const { desiredConsumptionByPop, populationUpdates } = computePopulationConsumption(
		population,
		adjustedSalaries,
		prices,
	);

	const last = state.lastResult;
	const previousSectorProfits: Record<string, number> = last?.sectorProfits ?? {};
	const previousSectorRevenue: Record<string, number> = last?.sectorRevenue ?? {};
	const previousSectorLaborCosts: Record<string, number> = last?.sectorLaborCosts ?? {};
	const previousSectorInputCosts: Record<string, number> = last?.sectorInputCosts ?? {};
	const previousSectorUtilization: Record<string, number> = last?.sectorUtilization ?? {};

	// === INDUSTRY-LEVEL BEHAVIOR TREE (matches live worker pipeline) ===
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
	for(const [key, pop] of Object.entries(population) as [keyof Population, any][]) {
		industryBlackboard.totalPopulation += pop.number;
		if(key === "worker") {
			industryBlackboard.totalFreeWorkers += pop.number;
		}
	}

	// Colony goods state
	industryBlackboard.colonyGoods = { ...goods };
	industryBlackboard.colonyGoodsProduction = {};
	industryBlackboard.colonyGoodsRequirements = {};

	// Wages
	for(const [key, wage] of Object.entries(adjustedSalaries)) {
		industryBlackboard.wages[key] = wage;
	}

	const industryTree = createIndustryTree(industryBlackboard);
	industryTree.tick(industryBlackboard);

	// === ITERATIVE SECTOR ALLOCATION ===
	// Each iteration is a TRIAL: it starts from the OPENING goods and money.
	// Only the final iteration's results are committed downstream.
	// Prices evolve across iterations via the temp price memory (damping).
	const MAX_ITERATIONS = 3;
	const CONVERGENCE_THRESHOLD = 0.005;

	let currentPrices = prices;

	let finalSectorBids: SectorBid[] = [];
	let finalExecResult: ReturnType<typeof executeSectors> | null = null;
	let finalPurchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};
	let finalGoodsAfterPurchase: Goods = { ...goods };
	let finalNewMoney: Record<string, number> = { ...startingMoney };
	let finalWorkerMarketRatios: Record<string, number> = {};

	for(let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
		// Each iteration is an independent trial starting from OPENING state.
		let investRemaining = 0;

		// Each iteration starts from OPENING state — not depleted by previous rounds.
		const iterationGoods = { ...goods };
		const roundMoney: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
		for(const name of activeSectors) {
			roundMoney[name] = startingMoney[name] ?? 0;
		}

		let roundInvestRemaining = investRemaining;

		// === SECTOR-LEVEL BEHAVIOR TREES ===
		const roundSectorBids: SectorBid[] = [];

		for(const name of activeSectors) {
			if(
				(settlementType === "outpost" || settlementType === "hydrocarbonRefinery") &&
				!allowedSectorsSet.has(name)
			) {
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
				0, // outputLevel
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

			roundInvestRemaining = blackboard.investRemaining;

			if(blackboard.decisions.stopProduction) {
				continue;
			}

			const techMultiplier = techMultipliers[name] ?? 1;
			const laborAssignedVal = 0;
			const capitalStockVal = capitalStock[name] ?? {};

			const bid = buildSectorBid(
				name,
				currentPrices,
				techMultiplier,
				laborAssignedVal,
				capitalStockVal,
				adjustedSalaries,
				previousSectorProfits[name] ?? 0,
				blackboard.decisions,
				{
					workerEfficiencyMultipliers,
					materialRequirementMultipliers,
					capitalMultipliers,
					selectedMethod: selectedMethod[name] ?? null,
					sectorStartingMoney: sectorMoney,
				},
			);
			if(bid) {
				roundSectorBids.push(bid);
			}
		}

		const totalIdealWorkerDemand: Record<string, number> = {};
		for(const bid of roundSectorBids) {
			const idealWorkerDemand = bid.idealWorkerDemand as Record<string, number>;
			for(const [key, value] of Object.entries(idealWorkerDemand)) {
				totalIdealWorkerDemand[key] = (totalIdealWorkerDemand[key] ?? 0) + value;
			}
		}
		const workerAvailable: Record<string, number> = {};
		for(const [key, pop] of Object.entries(population)) {
			workerAvailable[key] = pop.number;
		}
		const workerMarketRatios = computeMarketRatios(totalIdealWorkerDemand, workerAvailable);

		// Capture final round's market ratios for wage memory commit after the loop.
		finalWorkerMarketRatios = workerMarketRatios;

		// Compute actual production scale per bid (worker constrained)
		for(const bid of roundSectorBids) {
			let workerRatio = 1;
			const idealWorkerDemand = bid.idealWorkerDemand as Record<string, number>;
			for(const [key, value] of Object.entries(idealWorkerDemand)) {
				if(value > 0) {
					const r = workerMarketRatios[key as keyof Population] ?? 1;
					workerRatio = Math.min(workerRatio, r);
				}
			}
			bid.actualScale = Math.min(bid.budgetRatio, workerRatio);
		}

		// Build goods allocations CAPPED BY actualScale.
		// A sector operating at 40% scale cannot purchase its full input bundle.
		const goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};
		for(const bid of roundSectorBids) {
			const allocation: Partial<Record<keyof Goods, number>> = {};
			for(const [goodKey, demand] of Object.entries(bid.idealGoodsDemand)) {
				allocation[goodKey as keyof Goods] = demand * bid.actualScale;
			}
			goodsAllocations[bid.name] = allocation;
		}

		// Sectors buy input goods from OPENING colony pool using their own money.
		// Each iteration starts from iterationGoods (opening state), not depleted goods.
		const {
			colonyGoodsAfterPurchase,
			newMoney: roundNewMoney,
			purchasedBySector: roundPurchasedBySector,
		} = buySectorInputs(
			roundSectorBids,
			iterationGoods,
			roundMoney,
			currentPrices,
			goodsAllocations,
		);

		// Build labor allocations CAPPED BY actualScale.
		const laborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
		for(const bid of roundSectorBids) {
			const allocation: Partial<Record<keyof Population, number>> = {};
			for(const [popKey, demand] of Object.entries(bid.idealWorkerDemand)) {
				allocation[popKey as keyof Population] = demand * bid.actualScale;
			}
			laborAllocations[bid.name] = allocation;
		}

		// Execute sectors using purchased goods as available inventory.
		const execResult = executeSectors(
			roundSectorBids,
			population,
			iterationGoods,
			currentPrices,
			adjustedSalaries,
			laborAllocations,
			roundPurchasedBySector,
		);

		// Record this iteration's results — only the final iteration is committed.
		finalSectorBids = roundSectorBids;
		finalExecResult = execResult;
		finalPurchasedBySector = roundPurchasedBySector;
		finalGoodsAfterPurchase = colonyGoodsAfterPurchase;
		finalNewMoney = roundNewMoney;

		// Recompute prices from OPENING goods with fresh memory each iteration
		// so prices are consistent across trial rounds (no cumulative damping).
		currentPrices = getPrices(goods, {});

		// Convergence check: stop if goods barely changed this round
		if(iteration > 0) {
			let goodsDelta = 0;
			let totalScale = 0;
			for(const key of Object.keys(finalGoodsAfterPurchase)) {
				const cur = (finalGoodsAfterPurchase as Record<string, number>)[key] ?? 0;
				const prev = (iterationGoods as Record<string, number>)[key] ?? 0;
				goodsDelta += Math.abs(cur - prev);
				totalScale += Math.abs(prev);
			}
			if(totalScale > 0 && goodsDelta / totalScale < CONVERGENCE_THRESHOLD) {
				break;
			}
		}
	}

	// Commit price and wage memory once per tick — not per iteration.
	state.priceMemory = tempPriceMemory;
	updateWageMemory(tempWageMemory, finalWorkerMarketRatios as Record<keyof Population, number>);
	state.wageMemory = tempWageMemory;

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
	} = finalExecResult!;

	// Compute actual wages paid to each population category from sector employment
	const wagesByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	for(const bid of finalSectorBids) {
		const result = sectorResults[bid.name];
		if(!result) continue;
		for(const [popType, employed] of Object.entries(result.workersEmployed ?? {})) {
			const key = popType as keyof Population;
			wagesByPop[key] = (wagesByPop[key] ?? 0) + (employed ?? 0) * (adjustedSalaries[key] ?? 0);
		}
	}

	// Each group's available cash = starting wealth + wages earned this tick
	const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
		cashByPop[key] = (pop.wealth ?? 0) + (wagesByPop[key] ?? 0);
	}

	for(const key of ["stayAtHome"] as const) {
		workingWorkers[key] = { ...workingWorkers[key], number: population[key].number };
		remainingWorkers[key] = { ...remainingWorkers[key], number: 0 };
	}

	// Allocate population spending based on actual sales.
	// Constrain per population group by available cash: starting wealth + wages.
	const {
		sectorRevenue: popSalesRevenue,
		salesQty,
		warehouseSalesQty,
		warehouseRevenue,
		unmetDemandByPop,
		spendingByPop,
	} = allocatePopulationSales({
		sectorBids: finalSectorBids,
		sectorResults,
		demandByPop: desiredConsumptionByPop,
		cashByPop,
		prices: currentPrices,
		availableStock: finalGoodsAfterPurchase,
	});

	// Household wealth settlement: wages in, spending out.
	// Each group's available cash = opening wealth + wages earned this tick.
	// Deduct spending from each group's wealth.
	for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
		const k = key as keyof Population;
		const actualIncome = wagesByPop[k] ?? 0;
		const actualSpending = spendingByPop[k] ?? 0;
		const targetWealth = (pop.wealth ?? 0) + actualIncome - actualSpending;
		if(!Number.isFinite(targetWealth) || targetWealth < -1e-6) {
			throw new Error(
				`Invalid household wealth for ${k}: ${targetWealth}`,
			);
		}
		if(populationUpdates[k]) {
			populationUpdates[k] = {
				...populationUpdates[k],
				wealth: Math.max(0, targetWealth),
			};
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

	// Aggregate per-group unmet demand into goods-level shortfall
	const unmetDemandQty: Partial<Goods> = {};
	for(const key of Object.keys(unmetDemandByPop) as (keyof Population)[]) {
		for(const [goodKey, qty] of Object.entries(unmetDemandByPop[key] ?? {})) {
			unmetDemandQty[goodKey as keyof Goods] =
				(unmetDemandQty[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
		}
	}

	// Credit treasury with warehouse sales revenue
	let newTreasury = startingTreasury + warehouseRevenue;

	// Household money settlement: wages in, spending out
	const totalLaborCosts = Object.values(sectorLaborCosts).reduce((sum, v) => sum + v, 0);

	// Wage reconciliation: calculated wages from employment must equal sector labor costs.
	// This is a core financial invariant — fail hard, not a silent warning.
	const calculatedWageBill = Object.values(wagesByPop).reduce((sum, v) => sum + v, 0);
	if(
		!Number.isFinite(calculatedWageBill) ||
		!Number.isFinite(totalLaborCosts) ||
		Math.abs(calculatedWageBill - totalLaborCosts) > 1e-6
	) {
		throw new Error(
			`Wage bill mismatch for ${entityId}: ` +
			`calculated=${calculatedWageBill}, sector costs=${totalLaborCosts}`,
		);
	}

	// Deduct labor costs from sector money
	const newMoney: Record<string, number> = { ...finalNewMoney };
	for(const name of activeSectors) {
		const before = newMoney[name] ?? 0;
		newMoney[name] = before - (sectorLaborCosts[name] ?? 0);
	}

	// Add sector revenue to sector money
	for(const [sectorName, revenue] of Object.entries(popSalesRevenue)) {
		newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
	}

	// === CAPITAL PROCESSING ===
	// Capital processing sees the full post-purchase goods inventory.
	// Household warehouse sales are accounted for separately via goodsForDelta
	// (added back) and populationConsumption (deducted in finalizeGoods) —
	// they cancel out, so no double-counting occurs.
	// Capital processing must not consume inventory already promised to
	// households via warehouse sales. Reserve those goods first.
	const goodsForCapital: Goods = { ...finalGoodsAfterPurchase };
	for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
		const key = goodKey as keyof Goods;
		goodsForCapital[key] = (goodsForCapital[key] ?? 0) - (qty ?? 0);
		if(goodsForCapital[key] < -1e-6) {
			throw new Error(
				`Household warehouse sales exceed stock of ${key}: ` +
				`available=${finalGoodsAfterPurchase[key] ?? 0}, sold=${qty ?? 0}`,
			);
		}
		goodsForCapital[key] = Math.max(0, goodsForCapital[key] ?? 0);
	}

	const {
		newCapitalStock,
		replenishmentDelta,
		moneySpent,
		remainingGoods
	} = processCapital(
		Array.from(activeSectors),
		capitalStock,
		sectorResults,
		currentPrices,
		newMoney,
		goodsForCapital
	);

	// Deduct capital costs from sector money
	for(const name of activeSectors) {
		const before = newMoney[name] ?? 0;
		newMoney[name] = before - (moneySpent[name] ?? 0);
	}

	// Validate sector money — prevent overspending rather than clamping.
	validateSectorMoney(newMoney, activeSectors, entityId);

	// Credit treasury with sector input purchases (money deducted in buySectorInputs)
	const totalSectorInputCosts = Object.values(sectorInputCosts).reduce(
		(sum, v) => sum + v,
		0
	);
	newTreasury += totalSectorInputCosts;

	// Credit treasury with capital purchases (money deducted above)
	const totalCapitalMoneySpent = Object.values(moneySpent).reduce(
		(sum, v) => sum + v,
		0
	);
	newTreasury += totalCapitalMoneySpent;

	// === RECONCILE PURCHASED INPUTS vs ACTUAL CONSUMPTION ===
	// buySectorInputs removed purchased goods from iterationGoods.
	// executeSectors reports actual consumption (capped by finalScale).
	// Unused purchased goods remain with the sector (not returned to colony);
	// unused purchase cost is refunded to sector money.
	const purchasedBySector = finalPurchasedBySector;
	const consumedGoods = sumGoodsRequirements;

	// Compute returned goods per good: purchased - consumed (never negative)
	const returnedGoods: Partial<Goods> = {};
	for(const goodKey of Object.keys(goods) as (keyof Goods)[]) {
		let totalPurchased = 0;
		for(const sectorName of Object.keys(purchasedBySector)) {
			totalPurchased += (purchasedBySector[sectorName]?.[goodKey] ?? 0);
		}
		let totalConsumed = consumedGoods[goodKey] ?? 0;
		if(!Number.isFinite(totalConsumed) || totalConsumed < 0) {
			totalConsumed = 0;
		}
		const returned = Math.max(0, totalPurchased - totalConsumed);
		if(returned > 0) {
			returnedGoods[goodKey] = returned;
		}
	}

	// Refund unused purchase cost to sector money.
	// buySectorInputs charged full purchase cost; sectorInputCosts is actual
	// consumption cost. The difference is returned to the sector.
	const refundBySector: Record<string, number> = {};
	for(const sectorName of Object.keys(purchasedBySector)) {
		let purchaseCost = 0;
		for(const [goodKey, qty] of Object.entries(purchasedBySector[sectorName] ?? {})) {
			purchaseCost += (qty ?? 0) * (currentPrices[goodKey as keyof Goods] ?? 0);
		}
		const actualCost = sectorInputCosts[sectorName] ?? 0;
		const refund = Math.max(0, purchaseCost - actualCost);
		if(refund > 0) {
			refundBySector[sectorName] = refund;
		}
	}

	// remainingGoods is after capital purchases. Return unused purchased goods
	// to colony inventory so they are not lost.
	const postCapitalGoods: Goods = { ...createEmptyWarehouse(), ...remainingGoods };
	for(const [goodKey, qty] of Object.entries(returnedGoods)) {
		const key = goodKey as keyof Goods;
		postCapitalGoods[key] = (postCapitalGoods[key] ?? 0) + qty;
	}

	// Apply refunds to sector money after capital deduction.
	for(const [sectorName, refund] of Object.entries(refundBySector)) {
		newMoney[sectorName] = (newMoney[sectorName] ?? 0) + refund;
	}

	// Add warehouse sales back so the goods delta does not double-count them.
	// Warehouse sales are deducted once through fulfilledDemandQty in finalizeGoods.
	const goodsForDelta: Goods = { ...postCapitalGoods };
	for(const [goodKey, qty] of Object.entries(warehouseSalesQty)) {
		const key = goodKey as keyof Goods;
		goodsForDelta[key] = (goodsForDelta[key] ?? 0) + qty;
	}

	// Compute capital purchases from actual inventory removed (not replenishmentDelta).
	// capitalPurchasesByGood = goodsForCapital - remainingGoods (per good).
	const capitalPurchasesByGood: Partial<Goods> = {};
	for(const goodKey of Object.keys(goodsForCapital) as (keyof Goods)[]) {
		const removed = (goodsForCapital[goodKey] ?? 0) - (remainingGoods[goodKey] ?? 0);
		if(removed < -1e-6) {
			throw new Error(
				`Capital processing increased inventory of ${goodKey}: ` +
				`before=${goodsForCapital[goodKey] ?? 0}, after=${remainingGoods[goodKey] ?? 0}`,
			);
		}
		if(removed > 0) {
			capitalPurchasesByGood[goodKey] = Math.max(0, removed);
		}
	}

	const colonyGoodsDelta = computeColonyGoodsDelta(
		goods,
		goodsForDelta,
		activeSectors,
		sectorResults
	);

	// Apply colony goods changes (additive for cumulative, net replacement for non-cumulative)
	// Uses checked subtraction so inventory deficits throw rather than silently clamping.
	const colonyGoodsProduction = createEmptyWarehouse();
	const colonyGoodsRequirements = createEmptyWarehouse();
	for(const [key, value] of Object.entries(colonyGoodsDelta)) {
		if(value > 0) {
			colonyGoodsProduction[key as keyof Goods] = value;
		} else if(value < 0) {
			colonyGoodsRequirements[key as keyof Goods] = Math.abs(value);
		}
	}

	const colonyGoodsChanges = finalizeGoods(
		goods,
		colonyGoodsProduction,
		colonyGoodsRequirements,
		fulfilledDemandQty,
		population
	);

	const updatedPopulation: Population = { ...population };
	for(const [key, update] of Object.entries(populationUpdates)) {
		const pop = updatedPopulation[key as keyof Population];
		if(!pop) continue;
		updatedPopulation[key as keyof Population] = {
			...pop,
			...(update.number !== undefined ? { number: update.number } : {}),
			...(update.wealth !== undefined ? { wealth: update.wealth } : {}),
		};
	}

	// Validate household wealth: no category may end with negative cash.
	// AllocatePopulationSales should constrain spending by available cash;
	// negative wealth indicates an allocator bug.
	for(const [key, pop] of Object.entries(updatedPopulation)) {
		const popKey = key as keyof Population;
		if(!Number.isFinite(pop.wealth) || pop.wealth < -1e-6) {
			throw new Error(
				`Invalid household wealth for ${popKey}: ${pop.wealth}`,
			);
		}
	}

	// Derive aggregate household money from the FINAL returned population.
	// This guarantees householdMoney == sum of population wealth.
	const newHouseholdMoney = Object.values(updatedPopulation).reduce(
		(sum, pop) => sum + pop.wealth,
		0
	);

	// Reset sector revenue to actual-sales-only authority
	for(const name of activeSectors) {
		sectorRevenue[name] = 0;
		const laborCosts = sectorLaborCosts[name] ?? 0;
		const inputCosts = sectorInputCosts[name] ?? 0;
		sectorProfits[name] = -(inputCosts + laborCosts);
	}


	const result: IndustryTickResult = {
		entityId,
		goodsRequirements: {
			...Object.entries(desiredConsumptionByPop).reduce((acc, [_, consumption]) => {
				for(const [good, qty] of Object.entries(consumption)) {
					acc[good as keyof Goods] = (acc[good as keyof Goods] ?? 0) + qty;
				}
				return acc;
			}, {} as Partial<Goods>),
			...negateReplenishmentDelta(replenishmentDelta),
		},
		goodsProduction: sumGoodsProduction,
		workingWorkers: workingWorkers as Population,
		freeWorkers: remainingWorkers,
		population: updatedPopulation,
		populationUpdates,
		goods: colonyGoodsChanges,
		sectorProfits,
		sectorRevenue,
		sectorLaborCosts,
		sectorInputCosts,
		populationProfits: {},
		sectorUtilization,
		sectorStopReason,
		wages: adjustedSalaries,
		sectorResults,
		capitalStock: newCapitalStock,
		money: newMoney,
		colonyTreasury: newTreasury,
		householdMoney: newHouseholdMoney,
		settlementType,
		allowedSectors,
		unmetDemand: {},
		deprivation: {},
		accounting: {
			sectorSalesByGood: (() => {
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
			capitalPurchasesByGood,
			sectorInputsConsumedByGood: sumGoodsRequirements,
			sectorProductionByGood: sumGoodsProduction,
			wagesByPop,
			spendingByPop,
		}
	}


	state.lastResult = result;
	state.tick++;

	return result;
}

function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>>): Record<keyof Goods, number> {
	const priceDamping = 0.3;
	const priceMinMultiplier = 0.1;
	const priceMaxMultiplier = 10;

	const prices: Record<string, number> = {};
	for(const key of Object.keys(basePrices)) {
		if(!(key in goods)) continue;
		const gKey = key as keyof Goods;
		const stock = goods[gKey] ?? 0;
		const base = basePrices[key as keyof typeof basePrices];
		const baseline = Math.max(base * 10, 1);
		let adjustment = 1.0;

		if(stock > 0) {
			adjustment = baseline / stock;
		} else {
			adjustment = priceMaxMultiplier;
		}
		adjustment = Math.max(priceMinMultiplier, Math.min(priceMaxMultiplier, adjustment));
		const currentPrice = memory[gKey] ?? base;
		const targetPrice = base * adjustment;
		const dampedPrice = currentPrice + (targetPrice - currentPrice) * priceDamping;
		const clampedPrice = Math.max(
			base * priceMinMultiplier,
			Math.min(base * priceMaxMultiplier, dampedPrice)
		);
		memory[gKey] = clampedPrice;
		prices[gKey] = clampedPrice;
	}
	return prices as Record<keyof Goods, number>;
}

function finalizeGoods(
	currentGoods: Goods,
	sumGoodsProduction: Goods,
	sumGoodsRequirements: Goods,
	populationConsumption: Partial<Goods>,
	population: Population
): Goods {
	const finalGoods = { ...currentGoods } as Goods;

	// Apply cumulative goods changes additively.
	// Inputs consumed and household consumption use checked subtraction
	// so inventory deficits throw rather than silently clamping.
	applyGoodsModifier(finalGoods, sumGoodsProduction, (cur, d) => cur + d);
	applyGoodsModifier(finalGoods, sumGoodsRequirements, (cur, d) =>
		subtractChecked(cur, d, "goods" as keyof Goods)
	);
	applyGoodsModifier(finalGoods, populationConsumption, (cur, d) =>
		subtractChecked(cur, d, "goods" as keyof Goods)
	);

	// For non-cumulative goods, replace with net production (matches live worker pipeline)
	for(const key in finalGoods) {
		const goodKey = key as keyof Goods;
		if(NON_CUMULATING_GOODS.has(goodKey)) {
			const production = sumGoodsProduction[goodKey] ?? 0;
			const requirements = sumGoodsRequirements[goodKey] ?? 0;
			finalGoods[goodKey] = Math.max(0, production - requirements);
		}
	}

	const totalPopulation = Object.values(population).reduce(
		(sum, pop) => sum + pop.number,
		0
	);
	const populationWaste = totalPopulation * wastePerPerson;

	finalGoods.waste = Math.max(
		0,
		(finalGoods.waste ?? 0) + populationWaste - wasteDecayRate * (currentGoods.waste ?? 0)
	);

	return finalGoods;
}

export function seedCapitalStock(
	sector: keyof IndustrialSectors,
	multiplier: number
): Partial<Goods> {
	const config = industrySectorBlueprints.get(sector);
	if(!config?.capitalGoods) return {};

	const stock: Partial<Goods> = {};
	for(const [goodKey, requiredPerUnit] of Object.entries(config.capitalGoods)) {
		stock[goodKey as keyof Goods] = requiredPerUnit * multiplier;
	}
	return stock;
}

export function validateColonyConfig(
	input: IndustryTickInput,
	options: { ticks?: number; essentialGoods?: (keyof Goods)[]; essentialSectors?: (keyof IndustrialSectors)[] } = {}
): ColonyValidationResult {
	const { ticks = 100, essentialGoods = ESSENTIAL_GOODS, essentialSectors = ESSENTIAL_SECTORS } = options;

	const state = createSimState();
	let currentInput = { ...input };

	const minGoods: Partial<Record<keyof Goods, number>> = {};
	const maxMoneyDeficit: Partial<Record<keyof IndustrialSectors, number>> = {};

	for(const good of essentialGoods) {
		minGoods[good] = currentInput.goods[good] ?? 0;
	}
	for(const sector of essentialSectors) {
		maxMoneyDeficit[sector] = currentInput.money[sector] ?? 0;
	}

	let ticksSurvived = 0;

	for(let i = 0; i < ticks; i++) {
		const result = simulateTick(currentInput, state);
		ticksSurvived = i + 1;

		for(const good of essentialGoods) {
			const value = result.goods[good] ?? 0;
			const prevMin = minGoods[good] ?? Infinity;
			if(value < prevMin) minGoods[good] = value;

			if(value <= 0) {
				return {
					viable: false,
					ticksSurvived,
					failedGood: { good, tick: i + 1, value },
					minGoods,
					maxMoneyDeficit,
				};
			}
		}

		for(const sector of essentialSectors) {
			const money = result.money[sector] ?? 0;
			const prevDeficit = maxMoneyDeficit[sector] ?? 0;
			if(money < prevDeficit) maxMoneyDeficit[sector] = money;

			if(money <= -1_000_000) {
				return {
					viable: false,
					ticksSurvived,
					failedSector: { sector, tick: i + 1, money },
					minGoods,
					maxMoneyDeficit,
				};
			}
		}

		// Carry ALL state forward, including treasury.
		currentInput.goods = result.goods;
		currentInput.money = result.money;
		currentInput.capitalStock = result.capitalStock;
		currentInput.population = result.population ?? currentInput.population;
		currentInput.colonyTreasury = result.colonyTreasury;
	}

	return {
		viable: true,
		ticksSurvived,
		minGoods,
		maxMoneyDeficit,
	};
}

export function generateValidatedColonyConfig(
	config: Partial<ColonyConfig> = {},
	options: { ticks?: number; essentialGoods?: (keyof Goods)[]; essentialSectors?: (keyof IndustrialSectors)[]; extraSectors?: string[] } = {}
): { config: IndustryTickInput; validation: ColonyValidationResult } {
	const { ticks = 100, essentialGoods, essentialSectors } = options;

	let lastValidation: ColonyValidationResult | null = null;
	let lastInput: IndustryTickInput | null = null;
	const capitalStockMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
	let workingConfig = config;

	// Initialize local map before the loop to avoid non-null assertion issues.
	const initialGoodsMultipliers = new Map(config.initialGoodsMultipliers ?? []);

	for(let attempt = 0; attempt < 20; attempt++) {
		workingConfig = {
			...config,
			initialGoodsMultipliers,
		};
		const input = generateColonyConfig(workingConfig, capitalStockMultipliers);
		const validation = validateColonyConfig(input, { ticks, essentialGoods, essentialSectors });
		lastValidation = validation;
		lastInput = input;

		if(validation.viable) {
			return { config: input, validation };
		}

		// Double capital goods for sectors that produce the failed good
		if(validation.failedGood) {
			const good = validation.failedGood.good;
			const sectors = getSectorsMakingThisGood(good);
			for(const sector of sectors) {
				capitalStockMultipliers[sector] = (capitalStockMultipliers[sector] ?? 1) * 2;
				initialGoodsMultipliers.set(good, (initialGoodsMultipliers.get(good) ?? 1) * 2);
			}
		}
	}

	// Return the last generated input with its matching validation result.
	if(lastInput && lastValidation) {
		return { config: lastInput, validation: lastValidation };
	}

	throw new Error("generateValidatedColonyConfig: no config was generated");
}

export function generateRandomConfig(seed: number, populationSize: number): IndustryTickInput {
	let s = seed;
	const next = () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};

	const starterMoneyPerSector = Math.round(10_000_000 + next() * 100_000_000);
	const capitalStockMultiplier = 1 + next() * 20;

	return generateColonyConfig({
		populationSize,
		activeSectors: [...sectors],
		starterMoneyPerSector,
		capitalStockMultiplier,
	});
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
}

function getSectorsMakingThisGood(goodKey: keyof Goods): (keyof IndustrialSectors)[] {
	const result: (keyof IndustrialSectors)[] = [];
	for(const [sector, config] of industrySectorBlueprints) {
		if(config.goodsProduction?.[goodKey] !== undefined) {
			result.push(sector);
		}
	}
	return result;
}
