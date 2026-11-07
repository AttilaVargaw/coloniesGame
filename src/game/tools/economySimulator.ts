import { Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { Population } from "../data/Population";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { buildSectorBid } from "../workers/buildSectorBid";
import { executeSectors } from "../workers/sectorExecution";
import {
	computePopulationConsumption,
	buySectorInputs,
	distributePopulationSpending,
	computeColonyGoodsDelta,
	applyGoodsModifier,
	computeMarketRatios,
} from "../workers/industryTickHelpers";
import { buildAdjustedSalaries, updateWageMemory } from "../workers/wageSystem";
import type { IndustryTickInput } from "../workers/IndustryTickInput";
import type { IndustryTickResult } from "../workers/IndustryTickResult";
import type { SectorBid } from "../workers/SectorBid";
import type { SectorDecisions } from "../systems/sectorBehaviorTree/bt";

const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;

const defaultDecisions: SectorDecisions = {
	stopProduction: false,
	sectorInvestment: 0,
	laborAssigned: 0,
	restartProduction: false,
	buyCapital: false,
};

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

export function simulateTick(input: IndustryTickInput, state: SimState): IndustryTickPatch {
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

	const sectorBids: SectorBid[] = [];

	for (const name of activeSectors) {
		if (
			(settlementType === "outpost" || settlementType === "hydrocarbonRefinery") &&
			!allowedSectorsSet.has(name)
		) {
			continue;
		}

		// Use default decisions (no behavior tree) — keeps the simulator deterministic
		const techMultiplier = techMultipliers[name] ?? 1;
		const capitalStockVal = capitalStock[name] ?? {};

		const bid = buildSectorBid(
			name,
			prices,
			techMultiplier,
			laborAssigned[name] ?? 0,
			capitalStockVal,
			adjustedSalaries,
			previousSectorProfits[name] ?? 0,
			defaultDecisions,
			{
				workerEfficiencyMultipliers,
				materialRequirementMultipliers,
				capitalMultipliers,
				selectedMethod: selectedMethod[name] ?? null,
				sectorStartingMoney: startingMoney[name] ?? 0,
			}
		);
		if (bid) {
			sectorBids.push(bid);
		}
	}

	// Worker market ratios from aggregate demand vs available population
	const { workerMarketRatios } = calculateMarketRatios(sectorBids, population);

	updateWageMemory(state.wageMemory, workerMarketRatios);

	for (const bid of sectorBids) {
		bid.actualScale = computeActualScale(bid, workerMarketRatios);
	}

	let newMoney: Record<string, number> = { ...startingMoney };

	const { colonyGoodsAfterPurchase } = buySectorInputs(sectorBids, goods, newMoney, prices);

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

	for (const key of ["stayAtHome"] as const) {
		workingWorkers[key] = { ...workingWorkers[key], number: population[key].number };
		remainingWorkers[key] = { ...remainingWorkers[key], number: 0 };
	}

	for (const bid of sectorBids) {
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

	// Capital: keep stock constant (no processCapital) to keep simulator deterministic
	const newCapitalStock = { ...capitalStock };

	const colonyGoodsDelta = computeColonyGoodsDelta(
		goods,
		colonyGoodsAfterPurchase,
		activeSectors,
		sectorResults,
		{}, // no replenishment delta
		prices
	);

	const colonyGoodsProduction = { ...createStarterWarehouse(0) };
	const colonyGoodsRequirements = { ...createStarterWarehouse(0) };
	for (const [key, value] of Object.entries(colonyGoodsDelta)) {
		if (value > 0) {
			colonyGoodsProduction[key as keyof Goods] = value;
		} else if (value < 0) {
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

	return buildPatch(result);
}

export interface IndustryTickPatch {
	entityId: string;
	goods?: Goods;
	goodsRequirements?: Partial<Goods>;
	goodsProduction?: Partial<Goods>;
	workingWorkers?: any;
	freeWorkers?: any;
	populationUpdates?: any;
	sectorProfits?: Record<string, number>;
	sectorRevenue?: Record<string, number>;
	wages?: Record<keyof Population, number>;
	sectorLaborCosts?: Record<string, number>;
	sectorInputCosts?: Record<string, number>;
	populationProfits?: Record<keyof Population, number>;
	sectorUtilization?: Record<string, number>;
	sectorStopReason?: Record<string, string>;
	capitalStock?: Record<string, Partial<Goods>>;
	money?: Record<string, number>;
	sectorResults?: any;
}

function getPrices(goods: Goods, memory: Partial<Record<keyof Goods, number>>): Record<keyof Goods, number> {
	const priceDamping = 0.3;
	const priceMinMultiplier = 0.1;
	const priceMaxMultiplier = 10;
	const basePrices: Record<keyof Goods, number> = {
		food: 30, meat: 60, tourism: 300, consumerGoods: 100, water: 10, electricity: 20,
		furniture: 10, luxuryFurniture: 120, services: 15, agriculturalGoods: 20,
		tylium: 150, metals: 150, uranium: 100, machinery: 50, medicine: 20, wood: 20,
		lumber: 30, oil: 100, spaceTransport: 2000, ammunition: 20, weapons: 30,
		nuclearWeapons: 300, ordnance: 50, vehicles: 80, electronics: 60,
		environmentFactor: 50, faith: 40, lawEnforcement: 40, healthcare: 70,
		chemicals: 20, buildings: 20, waste: 2, governance: 40, aircraft: 1000,
		clothing: 100, ships: 100, railroadVehicles: 100, paper: 20, post: 40,
		entertainment: 30, itServices: 50, education: 80, alcoholDrinks: 50,
		stimulantDrinks: 50, retail: 100, automotiveMobility: 100, railroadMobility: 100,
		shipMobility: 100, airMobility: 100, ore: 100, defense: 100,
		monetaryServices: 200, militaryVehicles: 500,
	};

	const prices: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
	for (const key of Object.keys(basePrices) as (keyof Goods)[]) {
		const stock = goods[key] ?? 0;
		const base = basePrices[key];
		const baseline = Math.max(base * 10, 1);
		let adjustment = 1.0;
		if (stock > 0) {
			adjustment = baseline / stock;
		} else {
			adjustment = priceMaxMultiplier;
		}
		adjustment = Math.max(priceMinMultiplier, Math.min(priceMaxMultiplier, adjustment));
		const currentPrice = memory[key] ?? base;
		const targetPrice = base * adjustment;
		const dampedPrice = currentPrice + (targetPrice - currentPrice) * priceDamping;
		const clampedPrice = Math.max(
			base * priceMinMultiplier,
			Math.min(base * priceMaxMultiplier, dampedPrice)
		);
		memory[key] = clampedPrice;
		prices[key] = clampedPrice;
	}
	return prices;
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

	const totalPopulation = Object.values(population).reduce(
		(sum, pop) => sum + pop.number,
		0
	);
	const populationWaste = totalPopulation * wastePerPerson;

	finalGoods.waste = Math.max(
		0,
		(finalGoods.waste ?? 0) + populationWaste - wasteDecayRate * (currentGoods.waste ?? 0)
	);

	for (const key in finalGoods) {
		const goodKey = key as keyof Goods;
		if (NON_CUMULATING_GOODS.has(goodKey)) {
			finalGoods[goodKey] = Math.max(0, finalGoods[goodKey] ?? 0);
		}
	}

	return finalGoods;
}

function buildPatch(result: IndustryTickResult): IndustryTickPatch {
	return {
		entityId: result.entityId,
		goods: result.goods,
		goodsRequirements: result.goodsRequirements,
		goodsProduction: result.goodsProduction,
		workingWorkers: result.workingWorkers,
		freeWorkers: result.freeWorkers,
		populationUpdates: result.populationUpdates,
		sectorProfits: result.sectorProfits,
		sectorRevenue: result.sectorRevenue,
		wages: result.wages,
		sectorLaborCosts: result.sectorLaborCosts,
		sectorInputCosts: result.sectorInputCosts,
		populationProfits: result.populationProfits,
		sectorUtilization: result.sectorUtilization,
		sectorStopReason: result.sectorStopReason,
		capitalStock: result.capitalStock,
		money: result.money,
		sectorResults: result.sectorResults,
	};
}

function calculateMarketRatios(
	sectorBids: SectorBid[],
	population: Population
): { workerMarketRatios: Record<keyof Population, number> } {
	const totalIdealWorkerDemand: Record<string, number> = {};
	const totalIdealGoodsDemand: Record<string, number> = {};

	for (const bid of sectorBids) {
		for (const [key, value] of Object.entries(bid.idealWorkerDemand)) {
			totalIdealWorkerDemand[key] = (totalIdealWorkerDemand[key] ?? 0) + value;
		}
		for (const [key, value] of Object.entries(bid.idealGoodsDemand)) {
			totalIdealGoodsDemand[key] = (totalIdealGoodsDemand[key] ?? 0) + value;
		}
	}

	const workerAvailable: Record<string, number> = {};
	for (const [key, pop] of Object.entries(population)) {
		workerAvailable[key] = pop.number;
	}

	return {
		workerMarketRatios: computeMarketRatios(
			totalIdealWorkerDemand,
			workerAvailable
		) as Record<keyof Population, number>,
	};
}

function computeActualScale(
	bid: SectorBid,
	workerMarketRatios: Record<keyof Population, number>
): number {
	let workerRatio = 1;
	for (const [key, value] of Object.entries(bid.idealWorkerDemand)) {
		if (value > 0) {
			const r = workerMarketRatios[key as keyof Population] ?? 1;
			workerRatio = Math.min(workerRatio, r);
		}
	}
	return Math.min(bid.budgetRatio, workerRatio);
}
