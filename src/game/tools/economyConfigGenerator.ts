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
	"consumerGoods"
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
	"services"
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
	capitalStockMultipliers: new Map()
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

export function simulateTick(input: IndustryTickInput, state: SimState): IndustryTickResult {
	const {
		entityId,
		activeSectors,
		goods,
		population,
		techMultipliers,
		laborAssigned,
		capitalStock,
		money: startingMoney,
		colonyTreasury: startingTreasury,
		householdMoney: startingHouseholdMoney,
		settlementType,
		allowedSectors,
		workerEfficiencyMultipliers,
		materialRequirementMultipliers,
		capitalMultipliers,
		selectedMethod,
	} = input;
	const prices = getPrices(goods, state.priceMemory);
	const adjustedSalaries = buildAdjustedSalaries(state.wageMemory);

	const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

	const { desiredConsumptionByPop, populationUpdates } = computePopulationConsumption(
		population,
		adjustedSalaries,
		prices
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
			industryBlackboard.totalFreeWorkers = pop.number;
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
	// Run bid → buy → execute multiple times. Each round starts with fresh
	// sector money but goods carry forward and are depleted, so prices get
	// recomputed to reflect real scarcity. Only the final round's results are
	// committed downstream (money, capital, goods delta).
	const MAX_ITERATIONS = 3;
	const CONVERGENCE_THRESHOLD = 0.005;

	let currentGoods = { ...goods };
	let currentPrices = prices;

	let sectorBids: SectorBid[] = [];
	let execResult: ReturnType<typeof executeSectors> | null = null;
	let newMoney: Record<string, number> = { ...startingMoney };
	let newTreasury: number = startingTreasury;
	let newHouseholdMoney: number = startingHouseholdMoney;
	let investRemaining = industryBlackboard.investTotal;

	// Accumulate real sector flows across every iteration of the tick.
	// Inputs consumed accumulate because purchases are deducted from the colony
	// pool every iteration. Production is taken from the final iteration only,
	// since that is what gets committed to closing inventory.
	const accumulatedInputsConsumed: Partial<Goods> = {};
	let finalProduction: Partial<Goods> = {};

	for(let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
		// Reset currentGoods to opening inventory for each iteration.
		// Each iteration independently evaluates what sectors would buy given
		// current prices and full stock. Only the final iteration's purchases
		// are committed downstream.
		const iterationGoods = { ...goods };
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

			roundInvestRemaining = blackboard.investRemaining;

			if(blackboard.decisions.stopProduction) {
				continue;
			}

			const techMultiplier = techMultipliers[name] ?? 1;
			let laborAssignedVal =
				blackboard.decisions.laborAssigned > 0
					? blackboard.decisions.laborAssigned
					: laborAssigned[name] ?? 0;
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
				}
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

		updateWageMemory(state.wageMemory, workerMarketRatios as Record<keyof Population, number>);

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

		// Build goods allocations from ideal demand (capped by actualScale)
		const goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>> = {};
		for(const bid of roundSectorBids) {
			const allocation: Partial<Record<keyof Goods, number>> = {};
			for(const [goodKey, demand] of Object.entries(bid.idealGoodsDemand)) {
				allocation[goodKey as keyof Goods] = demand;
			}
			goodsAllocations[bid.name] = allocation;
		}

		// Sectors buy input goods from colony pool using their own money
		const {
			colonyGoodsAfterPurchase,
			newMoney: roundNewMoney,
			purchasedBySector: roundPurchasedBySector,
		} = buySectorInputs(
			roundSectorBids,
			currentGoods,
			roundMoney,
			currentPrices,
			goodsAllocations,
		);
		currentGoods = colonyGoodsAfterPurchase;
		newMoney = roundNewMoney;

		// Build labor allocations from ideal demand (capped by actualScale)
		const laborAllocations: Record<string, Partial<Record<keyof Population, number>>> = {};
		for(const bid of roundSectorBids) {
			const allocation: Partial<Record<keyof Population, number>> = {};
			for(const [popKey, demand] of Object.entries(bid.idealWorkerDemand)) {
				allocation[popKey as keyof Population] = demand;
			}
			laborAllocations[bid.name] = allocation;
		}

		// Execute sectors — pass purchasedBySector so goods constraints use
		// actual purchases rather than falling back to raw colony inventory.
		execResult = executeSectors(
			roundSectorBids,
			population,
			currentGoods,
			currentPrices,
			adjustedSalaries,
			laborAllocations,
			roundPurchasedBySector,
		);

		// Accumulate actual inputs consumed this iteration (at finalScale),
		// not gross purchases — unused purchases are returned to the colony
		// in the reconciliation step.
		for(const [key, val] of Object.entries(execResult.sumGoodsRequirements ?? {})) {
			accumulatedInputsConsumed[key as keyof Goods] =
				(accumulatedInputsConsumed[key as keyof Goods] ?? 0) + (val ?? 0);
		}

		// Remember this iteration's production; the final iteration's values
		// are the ones committed to closing inventory.
		finalProduction = execResult.sumGoodsProduction ?? {};

		// Recompute prices for next iteration based on remaining goods
		currentPrices = getPrices(currentGoods, state.priceMemory);

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

	// Compute actual wages paid to each population category from sector employment
	const wagesByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	for(const bid of sectorBids) {
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

	// Allocate population spending based on actual sales
	// Constrain per population group by available cash: starting wealth + wages
	const { sectorRevenue: popSalesRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unmetDemandByPop, spendingByPop } =
		allocatePopulationSales({
			sectorBids,
			sectorResults,
			demandByPop: desiredConsumptionByPop,
			cashByPop,
			prices: currentPrices,
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

	// Aggregate per-group unmet demand into goods-level shortfall
	const unmetDemandQty: Partial<Goods> = {};
	for(const key of Object.keys(unmetDemandByPop) as (keyof Population)[]) {
		for(const [goodKey, qty] of Object.entries(unmetDemandByPop[key] ?? {})) {
			unmetDemandQty[goodKey as keyof Goods] =
				(unmetDemandQty[goodKey as keyof Goods] ?? 0) + (qty ?? 0);
		}
	}

	// Credit treasury with warehouse sales revenue
	newTreasury += warehouseRevenue;

	// Household money settlement: wages in, spending out
	const totalLaborCosts = Object.values(sectorLaborCosts).reduce((sum, v) => sum + v, 0);

	// Wage reconciliation: calculated wages from employment must equal sector labor costs
	const calculatedWageBill = Object.values(wagesByPop).reduce((sum, v) => sum + v, 0);
	if(Math.abs(calculatedWageBill - totalLaborCosts) > 1e-6) {
		console.error(`[IndustryTick] Wage bill mismatch for ${entityId}: calculated=${calculatedWageBill}, sector costs=${totalLaborCosts}`);
	}

	// Deduct labor costs from sector money
	for(const name of activeSectors) {
		newMoney[name] = (newMoney[name] ?? 0) - (sectorLaborCosts[name] ?? 0);
	}

	// Update population wealth based on actual income and spending (full cash balance, no smoothing)
	for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
		const k = key as keyof Population;
		const actualIncome = wagesByPop[k] ?? 0;
		const actualSpending = spendingByPop[k] ?? 0;
		const targetWealth = (pop.wealth ?? 0) + actualIncome - actualSpending;

		if(populationUpdates[k]) {
			populationUpdates[k] = {
				...populationUpdates[k],
				wealth: Math.max(0, targetWealth),
			};
		}
	}

	// Derive aggregate household money from population wealth (authoritative source)
	newHouseholdMoney = 0;
	for(const [, update] of Object.entries(populationUpdates) as [keyof Population, any][]) {
		if(update && update.wealth !== undefined) {
			newHouseholdMoney += update.wealth;
		}
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
		sectorRevenue[sectorName] = revenue;
		const laborCosts = sectorLaborCosts[sectorName] ?? 0;
		const inputCosts = sectorInputCosts[sectorName] ?? 0;
		sectorProfits[sectorName] = revenue - inputCosts - laborCosts;
	}

	// Credit treasury for sector input purchases (money deducted in buySectorInputs)
	const totalSectorInputCosts = Object.values(sectorInputCosts).reduce(
		(sum, v) => sum + v,
		0,
	);
	newTreasury += totalSectorInputCosts;

	// Capital wear, decay, replenishment, investment
	const { newCapitalStock, replenishmentDelta, moneySpent, remainingGoods } = processCapital(
		Array.from(activeSectors),
		capitalStock,
		sectorResults,
		currentPrices,
		newMoney,
		currentGoods
	);

	// Deduct capital costs from sector money
	for(const name of activeSectors) {
		newMoney[name] = (newMoney[name] ?? 0) - (moneySpent[name] ?? 0);
	}

	// Clamp sector money at 0 — sectors cannot go into infinite debt in simulation
	for(const name of activeSectors) {
		newMoney[name] = Math.max(0, newMoney[name] ?? 0);
	}

	// Credit treasury for capital purchases (money deducted above)
	const totalCapitalMoneySpent = Object.values(moneySpent).reduce(
		(sum, v) => sum + v,
		0,
	);
	newTreasury += totalCapitalMoneySpent;

	// remainingGoods is the authoritative inventory after capital purchases
	const postCapitalGoods: Goods = { ...createEmptyWarehouse(), ...remainingGoods };

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

	// Apply colony goods changes (additive for cumulative, net replacement for non-cumulative)
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

	const result: IndustryTickResult = {
		entityId,
		goodsRequirements: {
			...sumGoodsRequirements,
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
			capitalPurchasesByGood: Object.fromEntries(
				Object.entries(replenishmentDelta ?? {}).map(
					([key, val]) => [key, -(val ?? 0)],
				),
			),
			sectorInputsConsumedByGood: accumulatedInputsConsumed,
			sectorProductionByGood: finalProduction,
			wagesByPop,
			spendingByPop,
		},
	};

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
    console.log("DEBUG_GOODS: currentGoods.water:", currentGoods.water);
    console.log("DEBUG_GOODS: sumGoodsProduction.water:", sumGoodsProduction.water);
    console.log("DEBUG_GOODS: sumGoodsRequirements.water:", sumGoodsRequirements.water);
    console.log("DEBUG_GOODS: populationConsumption.water:", populationConsumption.water);
    const finalGoods = { ...currentGoods } as Goods;

	// Apply cumulative goods changes additively
	applyGoodsModifier(finalGoods, sumGoodsProduction, (cur, d) => cur + d);
	applyGoodsModifier(finalGoods, sumGoodsRequirements, (cur, d) => Math.max(0, cur - d));
	applyGoodsModifier(finalGoods, populationConsumption, (cur, d) => Math.max(0, cur - d));

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

function getSectorsMakingThisGood(goodKey: keyof Goods): (keyof IndustrialSectors)[] {
	const result: (keyof IndustrialSectors)[] = [];
	for(const [sector, config] of industrySectorBlueprints) {
		if(config.goodsProduction?.[goodKey] !== undefined) {
			result.push(sector);
		}
	}
	return result;
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

		currentInput.goods = result.goods;
		currentInput.money = result.money;
		currentInput.capitalStock = result.capitalStock;
		currentInput.population = result.population ?? currentInput.population;
		currentInput.laborAssigned = Object.fromEntries(
			Array.from(currentInput.activeSectors).map((k) => [k, 0])
		) as Record<string, number>;
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
	options: { ticks?: number; essentialGoods?: (keyof Goods)[]; essentialSectors?: (keyof IndustrialSectors)[], extraSectors?: string[] } = {}
): { config: IndustryTickInput; validation: ColonyValidationResult } {
	const { ticks = 100, essentialGoods, essentialSectors } = options;

	let lastValidation: ColonyValidationResult | null = null;
	const capitalStockMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};

	for(let attempt = 0; attempt < 20; attempt++) {
		const input = generateColonyConfig(config, capitalStockMultipliers);
		const validation = validateColonyConfig(input, { ticks, essentialGoods, essentialSectors });
		lastValidation = validation;

		if(validation.viable) {
			return { config: input, validation };
		}

		// Double capital goods for sectors that produce the failed good
		if(validation.failedGood) {
			const good = validation.failedGood.good;
			const sectors = getSectorsMakingThisGood(good);
			for(const sector of sectors) {
				capitalStockMultipliers[sector] = (capitalStockMultipliers[sector] ?? 1) * 2;

				config.initialGoodsMultipliers!.set(good, (config.initialGoodsMultipliers?.get(good) ?? 1) * 2)
			}
		}
	}

	return { config: generateColonyConfig(config, capitalStockMultipliers), validation: lastValidation! };
}

export function generateRandomConfig(seed: number, populationSize: number): IndustryTickInput {
	let s = seed;
	const next = () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};

	const starterMoneyPerSector = Math.round(10_000_000 + next() * 100_000_000);
	const capitalStockMultiplier = 1 + next() * 20;

	// const shuffled = [...sectors].sort(() => next() - 0.5);
	// const count = Math.floor(sectors.size + next() * (shuffled.length - sectors.size + 1));

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
