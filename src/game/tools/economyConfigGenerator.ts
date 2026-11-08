import { basePrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods.ts";
import { Population } from "../data/Population.ts";
import { createStarterWarehouse } from "../factories/createStarterWarehouse.ts";
import { createStarterPopulation } from "../data/getPopulationBreakdown.ts";
import { industrySectorBlueprints } from "../systems/sectorBlueprints.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import { SettlementType } from "../components/industryComponent.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { SectorBid } from "../workers/SectorBid.ts";
import { buildSectorBid } from "../workers/buildSectorBid.ts";
import { executeSectors } from "../workers/sectorExecution.ts";
import {
	computePopulationConsumption,
	buySectorInputs,
	distributePopulationSpending,
	computeColonyGoodsDelta,
	applyGoodsModifier,
	computeMarketRatios,
} from "../workers/industryTickHelpers.ts";
import { processCapital } from "../workers/capitalSystem.ts";
import { buildAdjustedSalaries, updateWageMemory } from "../workers/wageSystem.ts";
import { createSectorTree, buildBlackboard } from "../systems/sectorBehaviorTree/sectorTree.ts";
import { createIndustryTree } from "../workers/industryBehaviorTree/industryTree.ts";
import { defaultIndustryBlackboard } from "../workers/industryBehaviorTree/industryBT.ts";
import { PER_CAPITA_SECTOR_RATIOS } from "../factories/createStarterIndustry.ts";

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
	initialGoodsMultiplier: number;
}

const DEFAULT_CONFIG: ColonyConfig = {
	populationSize: 50_000_000,
	activeSectors: Array.from(sectors),
	starterMoneyPerSector: 50_000_000,
	capitalStockMultiplier: 1,
	initialGoodsMultiplier: 50_000,
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

	const { populationConsumption, populationUpdates, populationProfits } = computePopulationConsumption(
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

	let investRemaining = industryBlackboard.investTotal;

	// === SECTOR-LEVEL BEHAVIOR TREES ===
	const sectorBids: SectorBid[] = [];

	for(const name of activeSectors) {
		if(
			(settlementType === "outpost" || settlementType === "hydrocarbonRefinery") &&
			!allowedSectorsSet.has(name)
		) {
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
		let laborAssignedVal =
			blackboard.decisions.laborAssigned > 0
				? blackboard.decisions.laborAssigned
				: laborAssigned[name] ?? 0;
		const capitalStockVal = capitalStock[name] ?? {};

		const bid = buildSectorBid(
			name,
			prices,
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
				sectorStartingMoney: startingMoney[name] ?? 0,
			}
		);
		if(bid) {
			sectorBids.push(bid);
		}
	}

	const totalIdealWorkerDemand: Record<string, number> = {};
	for(const bid of sectorBids) {
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
	for(const bid of sectorBids) {
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

	let newMoney: Record<string, number> = { ...startingMoney };

	// Sectors buy input goods from colony pool using their own money
	const { colonyGoodsAfterPurchase } = buySectorInputs(
		sectorBids,
		goods,
		newMoney,
		prices
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
	} = executeSectors(sectorBids, population, goods, prices, adjustedSalaries);

	for(const key of ["stayAtHome"] as const) {
		workingWorkers[key] = { ...workingWorkers[key], number: population[key].number };
		remainingWorkers[key] = { ...remainingWorkers[key], number: 0 };
	}

	// Sector money: revenue minus labor costs
	for(const bid of sectorBids) {
		const sectorName = bid.name as keyof typeof startingMoney;
		const revenue = sectorRevenue[sectorName] ?? 0;
		const laborCosts = sectorLaborCosts[sectorName] ?? 0;
		newMoney[sectorName] = (newMoney[sectorName] ?? 0) + revenue - laborCosts;
	}

	newMoney = distributePopulationSpending(
		sectorBids,
		sectorResults,
		populationConsumption,
		prices,
		newMoney
	);

	// Capital wear, decay, replenishment, investment
	const { newCapitalStock, replenishmentDelta, moneySpent } = processCapital(
		Array.from(activeSectors),
		capitalStock,
		sectorResults,
		prices,
		newMoney
	);

	// Deduct capital costs from sector money
	for(const name of activeSectors) {
		newMoney[name] = (newMoney[name] ?? 0) - (moneySpent[name] ?? 0);
	}

	const colonyGoodsDelta = computeColonyGoodsDelta(
		goods,
		colonyGoodsAfterPurchase,
		activeSectors,
		sectorResults,
		replenishmentDelta,
		prices
	);

	// Apply colony goods changes (additive for cumulative, net replacement for non-cumulative)
	const colonyGoodsProduction = { ...createStarterWarehouse(0) };
	const colonyGoodsRequirements = { ...createStarterWarehouse(0) };
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
		populationConsumption,
		population
	);

	const updatedPopulation: Population = { ...population };
	for(const [key, update] of Object.entries(populationUpdates)) {
		const pop = updatedPopulation[key as keyof Population];
		if(!pop) continue;
		if(update.number !== undefined) {
			updatedPopulation[key as keyof Population] = {
				...pop,
				number: update.number,
			};
		}
	}

	const result: IndustryTickResult = {
		entityId,
		goodsRequirements: { ...sumGoodsRequirements, ...populationConsumption },
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
		populationProfits,
		sectorUtilization,
		sectorStopReason,
		wages: adjustedSalaries,
		sectorResults,
		capitalStock: newCapitalStock,
		money: newMoney,
		settlementType,
		allowedSectors,
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

function seedCapitalStock(
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

export function generateColonyConfig(config: Partial<ColonyConfig> = {}): IndustryTickInput {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const { populationSize, activeSectors, starterMoneyPerSector, capitalStockMultiplier } = cfg;

	const goods = createStarterWarehouse(populationSize);
	for(const key of Object.keys(goods) as (keyof Goods)[]) {
		goods[key] *= cfg.initialGoodsMultiplier;
	}
	const population = createStarterPopulation(populationSize);

	const money: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const capitalStock: Record<keyof IndustrialSectors, Partial<Goods>> = {} as Record<keyof IndustrialSectors, Partial<Goods>>;
	const techMultipliers: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const laborAssigned: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const sectorInvestment: Record<keyof IndustrialSectors, number> = {} as Record<keyof IndustrialSectors, number>;
	const selectedMethod: Record<keyof IndustrialSectors, string | null> = {} as Record<keyof IndustrialSectors, string | null>;

	for(const sector of activeSectors) {
		money[sector] = starterMoneyPerSector;
		capitalStock[sector] = seedCapitalStock(sector, capitalStockMultiplier);
		techMultipliers[sector] = 1;
		laborAssigned[sector] = 0;
		sectorInvestment[sector] = 0;
		selectedMethod[sector] = null;
	}

	return {
		entityId: "test-colony",
		activeSectors: new Set(activeSectors),
		goods,
		population,
		techMultipliers,
		laborAssigned,
		capitalStock,
		money,
		settlementType: "colony" as SettlementType,
		allowedSectors: [...activeSectors],
		workerEfficiencyMultipliers: Object.fromEntries(
			Object.keys(population).map((k) => [k, 1])
		) as Record<keyof Population, number>,
		materialRequirementMultipliers: Object.fromEntries(
			Object.keys(goods).map((k) => [k, 1])
		) as Record<keyof Goods, number>,
		capitalMultipliers: Object.fromEntries(
			Array.from(activeSectors).map((k) => [k, 1])
		) as Record<keyof IndustrialSectors, number>,
		selectedMethod,
		colonyTreasury: 0,
		sectorInvestment,
		activeLaws: new Set(),
	};
}

export function validateColonyConfig(
	input: IndustryTickInput,
	options: { ticks?: number; essentialGoods?: (keyof Goods)[]; essentialSectors?: (keyof IndustrialSectors)[] } = {}
): ColonyValidationResult {
	const { ticks = 20, essentialGoods = ESSENTIAL_GOODS, essentialSectors = ESSENTIAL_SECTORS } = options;

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

			if(value < 0) {
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
	const { ticks = 20, essentialGoods, essentialSectors } = options;

	let lastValidation: ColonyValidationResult | null = null;

	for(let attempt = 0; attempt < 20; attempt++) {
		const input = generateColonyConfig(config);
		const validation = validateColonyConfig(input, { ticks, essentialGoods, essentialSectors });
		lastValidation = validation;

		if(validation.viable) {
			return { config: input, validation };
		}

		const base = config as ColonyConfig;
		config = {
			...base,
			starterMoneyPerSector: base.starterMoneyPerSector * 2,
			initialGoodsMultiplier: base.initialGoodsMultiplier * 2,
			capitalStockMultiplier: base.capitalStockMultiplier * 2,
		} as Partial<ColonyConfig>;
	}

	return { config: generateColonyConfig(config), validation: lastValidation! };
}

const numSectors = sectors.size;

export function generateRandomConfig(seed: number, populationSize: number): IndustryTickInput {
	let s = seed;
	const next = () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};

	const starterMoneyPerSector = Math.round(1_000_000 + next() * 10_000_000);
	const capitalStockMultiplier = 1 + next() * 20;

	const shuffled = [...sectors].sort(() => next() - 0.5);
	const count = Math.floor(numSectors + next() * (shuffled.length - numSectors + 1));
	const activeSectors = shuffled.slice(0, count);

	return generateColonyConfig({
		populationSize,
		activeSectors,
		starterMoneyPerSector,
		capitalStockMultiplier,
		initialGoodsMultiplier: 500,
	});
}
