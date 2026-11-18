import { basePrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods.ts";
import { Population, PopulationBreakdown } from "../data/Population.ts";
import { createStarterPopulation } from "../data/getPopulationBreakdown.ts";
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
	applyGoodsModifier,
	computeMarketRatios,
	distributeSectorInputRevenue,
	ESSENTIAL_SERVICE_SECTORS,
	type PurchaseProvenance,
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

// Sectors that produce service goods as primary output, plus sectors
// that produce critical inputs needed by service producers (oil, water, paper, chemicals).
// DISABLED: Two-phase execution causes input supply chain issues.
// Revert to single-phase execution for now.
const SERVICE_PRODUCING_SECTORS = new Set<keyof IndustrialSectors>([
	// Empty - all sectors run in single phase
]);

function isServiceProducingSector(sectorName: string): sectorName is keyof IndustrialSectors {
	return SERVICE_PRODUCING_SECTORS.has(sectorName as keyof IndustrialSectors);
}

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

// Combine multiple execution results into one
function combineExecResults(results: ReturnType<typeof executeSectors>[]): ReturnType<typeof executeSectors> {
	if(results.length === 0) {
		return {
			sectorResults: {},
			sectorProfits: {},
			sectorRevenue: {},
			sectorLaborCosts: {},
			sectorInputCosts: {},
			populationProfits: {},
			sectorUtilization: {},
			sectorStopReason: {},
workingWorkers: createStarterPopulation(0),
		remainingWorkers: createStarterPopulation(0),
		sumGoodsRequirements: createEmptyWarehouse(),
		sumGoodsProduction: createEmptyWarehouse(),
		};
	}
	if(results.length === 1) return results[0];

	const combined = {
		sectorResults: {} as Record<string, any>,
		sectorProfits: {} as Record<string, number>,
		sectorRevenue: {} as Record<string, number>,
		sectorLaborCosts: {} as Record<string, number>,
		sectorInputCosts: {} as Record<string, number>,
		populationProfits: {} as Record<string, number>,
		sectorUtilization: {} as Record<string, number>,
		sectorStopReason: {} as Record<string, string>,
		workingWorkers: createStarterPopulation(0),
		remainingWorkers: createStarterPopulation(0),
		sumGoodsRequirements: createEmptyWarehouse(),
		sumGoodsProduction: createEmptyWarehouse(),
	};

	for(const r of results) {
		for(const [k, v] of Object.entries(r.sectorResults)) combined.sectorResults[k] = v;
		for(const [k, v] of Object.entries(r.sectorProfits)) combined.sectorProfits[k] = (combined.sectorProfits[k] ?? 0) + v;
		for(const [k, v] of Object.entries(r.sectorRevenue)) combined.sectorRevenue[k] = (combined.sectorRevenue[k] ?? 0) + v;
		for(const [k, v] of Object.entries(r.sectorLaborCosts)) combined.sectorLaborCosts[k] = (combined.sectorLaborCosts[k] ?? 0) + v;
		for(const [k, v] of Object.entries(r.sectorInputCosts)) combined.sectorInputCosts[k] = (combined.sectorInputCosts[k] ?? 0) + v;
		for(const [k, v] of Object.entries(r.populationProfits)) combined.populationProfits[k] = (combined.populationProfits[k] ?? 0) + v;
		for(const [k, v] of Object.entries(r.sectorUtilization)) combined.sectorUtilization[k] = v; // last one wins
		for(const [k, v] of Object.entries(r.sectorStopReason)) combined.sectorStopReason[k] = v;
		for(const [k, v] of Object.entries(r.workingWorkers) as [keyof Population, PopulationBreakdown][]) combined.workingWorkers[k] = { ...combined.workingWorkers[k], number: (combined.workingWorkers[k]?.number ?? 0) + v.number };
		for(const [k, v] of Object.entries(r.remainingWorkers) as [keyof Population, PopulationBreakdown][]) combined.remainingWorkers[k] = { ...combined.remainingWorkers[k], number: (combined.remainingWorkers[k]?.number ?? 0) + v.number };
		for(const [k, v] of Object.entries(r.sumGoodsRequirements)) combined.sumGoodsRequirements[k as keyof Goods] = (combined.sumGoodsRequirements[k as keyof Goods] ?? 0) + v;
		for(const [k, v] of Object.entries(r.sumGoodsProduction)) combined.sumGoodsProduction[k as keyof Goods] = (combined.sumGoodsProduction[k as keyof Goods] ?? 0) + v;
	}

	return combined;
}

// === SECTOR EXECUTION HELPER ===
// Executes a set of sector bids using the given goods pool and returns results + updated goods.
// Also returns production by sector for warehouse composition tracking.
function executeSectorPhase(
	bids: SectorBid[],
	goodsPool: Goods,
	startingMoney: Record<string, number>,
	prices: Record<keyof Goods, number>,
	adjustedSalaries: Record<keyof Population, number>,
	workerMarketRatios: Record<string, number>,
	population: Population,
	// Composition of goodsPool by producer (good -> producer -> quantity).
	// Used to attribute input purchases to actual producers.
	warehouseComposition?: Partial<Record<keyof Goods, Record<string, number>>>,
): {
	execResult: ReturnType<typeof executeSectors>;
	purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>>;
	updatedGoods: Goods;
	updatedMoney: Record<string, number>;
	purchaseProvenance: PurchaseProvenance;
	productionBySector: Record<string, Partial<Goods>>; // sector -> good -> quantity produced
} {
	// Compute actualScale for these bids
	for(const bid of bids) {
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
	const goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};
	for(const bid of bids) {
		const allocation: Partial<Record<keyof Goods, number>> = {};
		for(const [goodKey, demand] of Object.entries(bid.idealGoodsDemand)) {
			allocation[goodKey as keyof Goods] = demand * bid.actualScale;
		}
		goodsAllocations[bid.name] = allocation;
	}

	// Sectors buy input goods from the given goods pool using their own money.
	const {
		colonyGoodsAfterPurchase,
		newMoney: roundNewMoney,
		purchasedBySector: roundPurchasedBySector,
		purchaseProvenance,
	} = buySectorInputs(
		bids,
		goodsPool,
		startingMoney,
		prices,
		goodsAllocations,
		warehouseComposition,
	);

	// Build labor allocations CAPPED BY actualScale.
	const laborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
	for(const bid of bids) {
		const allocation: Partial<Record<keyof Population, number>> = {};
		for(const [popKey, demand] of Object.entries(bid.idealWorkerDemand)) {
			allocation[popKey as keyof Population] = demand * bid.actualScale;
		}
		laborAllocations[bid.name] = allocation;
	}

	// Execute sectors using purchased goods as available inventory.
	const execResult = executeSectors(
		bids,
		population,
		colonyGoodsAfterPurchase,
		prices,
		adjustedSalaries,
		laborAllocations,
		roundPurchasedBySector,
	);

	// Extract production by sector from execResult
	const productionBySector: Record<string, Partial<Goods>> = {};
	for(const [sectorName, result] of Object.entries(execResult.sectorResults)) {
		productionBySector[sectorName] = result.producedGoods;
	}

	return {
		execResult,
		purchasedBySector: roundPurchasedBySector,
		updatedGoods: colonyGoodsAfterPurchase,
		updatedMoney: roundNewMoney,
		purchaseProvenance,
		productionBySector,
	};
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

	// === SINGLE-PASS SECTOR ALLOCATION ===
	// One deterministic allocation pass using opening state.
	// Prices are computed from opening goods and committed once.
	const currentPrices = prices;

	let finalSectorBids: SectorBid[] = [];
	let finalExecResult: ReturnType<typeof executeSectors> | null = null;
	let finalPurchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};
	let finalGoodsAfterPurchase: Goods = { ...goods };
	let finalNewMoney: Record<string, number> = { ...startingMoney };
	let finalWorkerMarketRatios: Record<string, number> = {};

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
			0, // investRemaining (not used in single pass)
		);
		const tree = createSectorTree(blackboard);
		tree.tick(blackboard);

		const techMultiplier = techMultipliers[name] ?? 1;
		const capitalStockVal = capitalStock[name] ?? {};

		const bid = buildSectorBid(
			name,
			currentPrices,
			techMultiplier,
			0,
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

	// === TWO-PHASE SECTOR EXECUTION ===
	// Phase 1: Execute service-producing sectors first
	// Phase 2: Execute remaining sectors with same-tick service production available

	// Split bids into service producers and consumers
	const serviceProducerBids: SectorBid[] = [];
	const serviceConsumerBids: SectorBid[] = [];
	for(const bid of roundSectorBids) {
		if(isServiceProducingSector(bid.name)) {
			serviceProducerBids.push(bid);
		} else {
			serviceConsumerBids.push(bid);
		}
	}

	// Initialize money pool for phase execution
	let currentMoneyPool: Record<string, number> = { ...startingMoney };

	// Build initial warehouse composition: all opening inventory attributed to "colony_treasury"
	const initialWarehouseComposition: Partial<Record<keyof Goods, Record<string, number>>> = {};
	for(const [goodKey, qty] of Object.entries(goods)) {
		if(qty > 0) {
			initialWarehouseComposition[goodKey as keyof Goods] = { "colony_treasury": qty };
		}
	}

	// Phase 1: Execute service producers using opening goods pool
	let currentGoodsPool: Goods = { ...goods };
	let currentWarehouseComposition = initialWarehouseComposition;
	let allPurchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};
	let allExecResults: ReturnType<typeof executeSectors>[] = [];
	let allPurchaseProvenance: PurchaseProvenance = {};

	if(serviceProducerBids.length > 0) {
		const phase1Result = executeSectorPhase(
			serviceProducerBids,
			currentGoodsPool,
			currentMoneyPool,
			currentPrices,
			adjustedSalaries,
			workerMarketRatios,
			population,
			currentWarehouseComposition,
		);
		allExecResults.push(phase1Result.execResult);
		allPurchasedBySector = { ...allPurchasedBySector, ...phase1Result.purchasedBySector };
		allPurchaseProvenance = { ...allPurchaseProvenance, ...phase1Result.purchaseProvenance };
		currentGoodsPool = phase1Result.updatedGoods;
		currentMoneyPool = phase1Result.updatedMoney;

		// Build warehouse composition for Phase 2: opening inventory + Phase 1 production
		currentWarehouseComposition = { ...initialWarehouseComposition };
		for(const [sectorName, production] of Object.entries(phase1Result.productionBySector)) {
			for(const [goodKey, qty] of Object.entries(production)) {
				if(qty > 0) {
					const key = goodKey as keyof Goods;
					currentWarehouseComposition[key] = currentWarehouseComposition[key] ?? {};
					currentWarehouseComposition[key][sectorName] = (currentWarehouseComposition[key][sectorName] ?? 0) + qty;
				}
			}
		}

		// Note: We do NOT add Phase 1 service production to currentGoodsPool here.
		// Non-cumulative goods are handled in finalizeGoods which computes
		// final value = max(0, totalProduction - totalConsumption) from both phases.
		// Adding to currentGoodsPool would cause double-counting in applyGoodsModifier.
	}

	// Phase 2: Execute service consumers with updated goods pool (including same-tick services)
	if(serviceConsumerBids.length > 0) {
		const phase2Result = executeSectorPhase(
			serviceConsumerBids,
			currentGoodsPool,
			currentMoneyPool,
			currentPrices,
			adjustedSalaries,
			workerMarketRatios,
			population,
			currentWarehouseComposition,
		);
		allExecResults.push(phase2Result.execResult);
		allPurchasedBySector = { ...allPurchasedBySector, ...phase2Result.purchasedBySector };
		allPurchaseProvenance = { ...allPurchaseProvenance, ...phase2Result.purchaseProvenance };
		currentGoodsPool = phase2Result.updatedGoods;
		currentMoneyPool = phase2Result.updatedMoney;
	}

	// Combine execution results
	const combinedExecResult = combineExecResults(allExecResults);

	// Record results — two-pass execution
	finalSectorBids = roundSectorBids;
	finalExecResult = combinedExecResult;
	finalPurchasedBySector = allPurchasedBySector;
	finalGoodsAfterPurchase = currentGoodsPool;
	finalNewMoney = currentMoneyPool;
	const finalPurchaseProvenance = allPurchaseProvenance;

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
		// Unconditional settlement: ensure every population group gets an update
		populationUpdates[k] = {
			...(populationUpdates[k] ?? {}),
			wealth: Math.max(0, targetWealth),
		};
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
	const wageTolerance = Math.max(1e-6, Math.max(calculatedWageBill, totalLaborCosts) * 1e-9);
	if(
		!Number.isFinite(calculatedWageBill) ||
		!Number.isFinite(totalLaborCosts) ||
		Math.abs(calculatedWageBill - totalLaborCosts) > wageTolerance
	) {
		throw new Error(
			`Wage bill mismatch for ${entityId}: ` +
			`calculated=${calculatedWageBill}, sector costs=${totalLaborCosts}, tolerance=${wageTolerance}`,
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

	// === RECONCILE PURCHASED INPUTS vs ACTUAL CONSUMPTION ===
	// buySectorInputs charged full purchase cost; executeSectors reports actual consumption.
	// Unused purchases are refunded; over-consumption throws.
	// This is done PER SECTOR using each sector's own execution result.
	const purchasedBySector = finalPurchasedBySector;
	const returnedGoods: Partial<Goods> = {};
	const refundBySector: Record<string, number> = {};
	const EPSILON = 1e-6;

	for(const sectorName of Object.keys(purchasedBySector)) {
		const purchases = purchasedBySector[sectorName] ?? {};
		let purchaseCost = 0;
		let actualCost = 0;

		// Union of purchased and consumed goods for this sector
		const goodKeys = new Set<keyof Goods>([
			...Object.keys(purchases) as (keyof Goods)[],
			...Object.keys(sectorResults[sectorName]?.consumedGoods ?? {}) as (keyof Goods)[],
		]);

		for(const good of goodKeys) {
			const purchased = (purchases[good] ?? 0) as number;
			const consumed = (sectorResults[sectorName]?.consumedGoods?.[good] ?? 0) as number;
			const price = currentPrices[good] ?? 0;

			// Validate purchased quantity
			if(!Number.isFinite(purchased) || purchased < 0) {
				throw new Error(`Invalid purchased quantity for ${sectorName}/${good}: ${purchased}`);
			}

			// Validate consumed quantity
			if(!Number.isFinite(consumed) || consumed < 0) {
				throw new Error(`Invalid consumed quantity for ${sectorName}/${good}: ${consumed}`);
			}

			// Check over-consumption
			if(consumed > purchased + EPSILON) {
				throw new Error(
					`Sector input consumption exceeds purchases for ${sectorName}/${good}: ` +
					`purchased=${purchased}, consumed=${consumed}`,
				);
			}

			if(!Number.isFinite(price) || price < 0) {
				throw new Error(`Invalid price for ${good}`);
			}

			purchaseCost += purchased * price;
			actualCost += consumed * price;

			const returned = purchased - consumed;
			if(returned > EPSILON) {
				returnedGoods[good] = (returnedGoods[good] ?? 0) + returned;
			}
		}

		// Validate that actualCost matches reported cost within tolerance
		const reportedCost = sectorInputCosts[sectorName] ?? 0;
		const tolerance = Math.max(EPSILON, purchaseCost * 1e-9);

		if(Math.abs(actualCost - reportedCost) > tolerance) {
			throw new Error(
				`Input cost mismatch for ${sectorName}: ` +
				`calculated=${actualCost}, reported=${reportedCost}, tolerance=${tolerance}`,
			);
		}

		const refund = purchaseCost - actualCost;
		if(refund < -EPSILON) {
			throw new Error(`Input refund would be negative for ${sectorName}`);
		}

		if(refund > EPSILON) {
			refundBySector[sectorName] = refund;
		}
	}

	// Distribute sector-to-sector input purchase revenue to producing sectors
	// instead of crediting all to treasury.
	const { sectorRevenue: sectorInputRevenue, treasuryRevenue: sectorInputTreasuryRevenue, paymentBreakdown: sectorInputPaymentBreakdown } =
		distributeSectorInputRevenue(sectorResults, currentPrices, sectorInputCosts, finalPurchaseProvenance);

	// Credit producing sectors with revenue from sector-to-sector sales
	for(const [sectorName, revenue] of Object.entries(sectorInputRevenue)) {
		newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue;
		if(!Number.isFinite(newMoney[sectorName])) {
			throw new Error(`Sector money overflow for ${sectorName} from input revenue`);
		}
		sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + revenue;
		// sectorProfits will be computed once at the end after all revenue and subsidies
	}

	// remainingGoods is after capital purchases. Return unused purchased goods
	// to colony inventory so they are not lost.
	// Note: we don't have remainingGoods yet (capital not processed), so we'll
	// add returned goods to goodsForDelta later after capital processing.

	// Apply refunds to sector money BEFORE capital deduction.
	for(const [sectorName, refund] of Object.entries(refundBySector)) {
		newMoney[sectorName] = (newMoney[sectorName] ?? 0) + refund;
	}

	// === CAPITAL PROCESSING ===
	// Capital processing sees the full post-purchase goods inventory.
	// Household warehouse sales are accounted for separately via goodsForDelta
	// (added back) and populationConsumption (deducted in finalizeGoods) —
	// they cancel out, so no double-counting occurs.
	// Capital processing must not consume inventory already promised to
	// households via warehouse sales. Reserve those goods first.
	// Also add returned unused inputs so capital can use them.
	const goodsForCapital: Goods = { ...finalGoodsAfterPurchase };
	for(const [goodKey, qty] of Object.entries(returnedGoods)) {
		const key = goodKey as keyof Goods;
		goodsForCapital[key] = (goodsForCapital[key] ?? 0) + qty;
	}
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

	// Credit treasury with sector input purchases from warehouse stock only
	// (producer revenue already credited above via distributeSectorInputRevenue)
	newTreasury += sectorInputTreasuryRevenue;

	// Credit treasury with capital purchases (money deducted above)
	const totalCapitalMoneySpent = Object.values(moneySpent).reduce(
		(sum, v) => sum + v,
		0
	);
	newTreasury += totalCapitalMoneySpent;

	// === CAPITAL INVENTORY RECONCILIATION ===
	// remainingGoods is after capital purchases. Returned goods already added to goodsForCapital.
	const postCapitalGoods: Goods = { ...createEmptyWarehouse(), ...remainingGoods };

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
		const before = goodsForCapital[goodKey] ?? 0;
		const after = remainingGoods[goodKey] ?? 0;
		const removed = before - after;
		// Allow tiny floating-point increase (relative tolerance)
		const tolerance = Math.max(1e-6, before * 1e-9);
		if(removed < -tolerance) {
			throw new Error(
				`Capital processing increased inventory of ${goodKey}: ` +
				`before=${before}, after=${after}, diff=${-removed}, tolerance=${tolerance}`,
			);
		}
		if(removed > 0) {
			capitalPurchasesByGood[goodKey] = Math.max(0, removed);
		}
	}


	// Build total requirements = sector consumption + capital purchases
	const totalGoodsRequirements: Goods = createEmptyWarehouse();
	for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
		totalGoodsRequirements[key] =
			(sumGoodsRequirements[key] ?? 0) +
			(capitalPurchasesByGood[key] ?? 0);
	}

	// Use GROSS production and total requirements (sector + capital) for finalization.
	// This preserves offsetting production and consumption rather than erasing them.
	const colonyGoodsChanges = finalizeGoods(
		goods,
		sumGoodsProduction,
		totalGoodsRequirements,
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

	// Add population sales revenue to existing sector revenue (from sector-to-sector sales)
	for(const name of activeSectors) {
		const revenue = popSalesRevenue[name] ?? 0;
		sectorRevenue[name] = (sectorRevenue[name] ?? 0) + revenue;
		// sectorProfits will be computed once at the end after all revenue and subsidies
	}

	// Treasury subsidy for essential service sectors
	// Covers operating deficit (input costs + labor costs - total revenue) to ensure
	// non-cumulative goods production continues even when sector-to-sector revenue is insufficient.
	// Compute total subsidy needed across all essential sectors first.
	let totalSubsidyNeeded = 0;
	const sectorDeficits: Record<string, number> = {};
	for(const sectorName of activeSectors) {
		if(!ESSENTIAL_SERVICE_SECTORS.has(sectorName)) continue;

		const totalRevenue = sectorRevenue[sectorName] ?? 0;
		const laborCosts = sectorLaborCosts[sectorName] ?? 0;
		const inputCosts = sectorInputCosts[sectorName] ?? 0;
		const operatingCosts = laborCosts + inputCosts;
		const deficit = operatingCosts - totalRevenue;

		if(deficit > 0) {
			sectorDeficits[sectorName] = deficit;
			totalSubsidyNeeded += deficit;
		}
	}

	// Track subsidies paid for accounting
	const subsidiesPaid: Record<string, number> = {};

	// Pay subsidies if treasury can cover total
	if(totalSubsidyNeeded > 0 && newTreasury >= totalSubsidyNeeded) {
		for(const [sectorName, deficit] of Object.entries(sectorDeficits)) {
			newMoney[sectorName] = (newMoney[sectorName] ?? 0) + deficit;
			newTreasury -= deficit;
			const totalRevenue = sectorRevenue[sectorName] ?? 0;
			sectorRevenue[sectorName] = totalRevenue + deficit;
			subsidiesPaid[sectorName] = deficit;

			if(!Number.isFinite(newMoney[sectorName]) || newMoney[sectorName] < 0) {
				throw new Error(`Sector money invalid after subsidy for ${sectorName}`);
			}
		}
		if(!Number.isFinite(newTreasury) || newTreasury < 0) {
			throw new Error(`Treasury invalid after subsidy`);
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
			// Per-sector input reconciliation data
			sectorInputsPurchasedBySector: finalPurchasedBySector,
			sectorInputsConsumedBySector: (() => {
				const bySector: Record<string, Partial<Goods>> = {};
				for(const bid of finalSectorBids) {
					bySector[bid.name] = sectorResults[bid.name]?.consumedGoods ?? {};
				}
				return bySector;
			})(),
			sectorInputRefundsBySector: refundBySector,
			returnedInputsByGood: returnedGoods,
			sectorInputPaymentBreakdown,
			treasurySubsidiesPaid: subsidiesPaid,
		}
	}


	// Commit price and wage memory once per tick — at the very end,
	// after all calculations and validations have succeeded.
	updateWageMemory(
		tempWageMemory,
		finalWorkerMarketRatios as Record<keyof Population, number>,
	);

	state.priceMemory = tempPriceMemory;
	state.wageMemory = tempWageMemory;

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

	// For non-cumulative goods, replace with net production minus all consumption
	// (matches live worker pipeline). Sector requirements must not exceed available flow.
	// Household demand can be unmet (no production = no consumption).
	for(const key in finalGoods) {
		const goodKey = key as keyof Goods;
		if(NON_CUMULATING_GOODS.has(goodKey)) {
			const production = sumGoodsProduction[goodKey] ?? 0;
			const requirements = sumGoodsRequirements[goodKey] ?? 0;
			const householdConsumption = populationConsumption[goodKey] ?? 0;
			const availableFlow = production;

			if(requirements > availableFlow + 1e-6) {
				throw new Error(
					`Non-cumulative good ${goodKey} sector requirements exceed production: ` +
					`production=${production}, requirements=${requirements}`,
				);
			}

			const totalConsumption = requirements + householdConsumption;
			finalGoods[goodKey] = Math.max(0, availableFlow - totalConsumption);
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
