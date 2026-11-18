import type { IndustryTickInput } from "./IndustryTickInput.ts";
import type { IndustryTickResult, SectorResult } from "./IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { Goods } from "../data/Goods.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import type { InputPaymentBreakdown } from "./industryTickHelpers.ts";
import { basePrices } from "../data/Goods.ts";

export interface EconomicIndicators {
	tick: number;
	
	// Production & GDP
	nominalGDP: number;
	realGDP: number;
	sectorOutput: Record<keyof IndustrialSectors, number>;
	
	// Prices & Inflation
	priceLevel: Record<keyof Goods, number>;
	inflationRate: number;
	cpiBasket: (keyof Goods)[];
	priceIndex: number;
	prevPriceIndex: number;
	
	// Labor Market
	unemploymentRate: number;
	employmentRate: number;
	participationRate: number;
	workingWorkers: Record<keyof Population, number>;
	freeWorkers: Record<keyof Population, number>;
	
	// Wages & Income
	nominalWages: Record<keyof Population, number>;
	realWages: Record<keyof Population, number>;
	medianHouseholdWealth: number;
	averageHouseholdWealth: number;
	
	// Sector Health
	sectorProfits: Record<string, number>;
	sectorProfitMargins: Record<string, number>;
	sectorUtilization: Record<string, number>;
	sectorStopReasons: Record<string, string>;
	
	// Government Finance
	treasuryBalance: number;
	treasuryRevenue: number;
	treasuryExpenditure: number;
	treasurySubsidies: number;
	
	// Productivity
	outputPerWorker: number;
	outputPerSector: Record<keyof IndustrialSectors, number>;
	
	// Inventory / Supply
	inventoryCoverage: Record<keyof Goods, number>;
	stockToConsumptionRatio: Record<keyof Goods, number>;
	shortageGoods: (keyof Goods)[];
	
	// Trade Balance
	sectorToSectorTrade: number;
	householdTrade: number;
}

export interface IndicatorSeries {
	nominalGDP: number[];
	realGDP: number[];
	inflationRate: number[];
	unemploymentRate: number[];
	treasuryBalance: number[];
	averageHouseholdWealth: number[];
	medianHouseholdWealth: number[];
	outputPerWorker: number[];
	totalProduction: number[];
	totalConsumption: number[];
}

export function computeIndicators(
	result: IndustryTickResult,
	prevPriceIndex: number = 1,
	priceMemory: Partial<Record<keyof Goods, number>> = {}
): EconomicIndicators {
	const { sectorResults, sectorProfits, sectorRevenue, sectorLaborCosts, sectorInputCosts,
		sectorUtilization, sectorStopReason, wages, population, goods, money, colonyTreasury,
		accounting } = result;

	// --- Nominal GDP (total revenue from all sectors) ---
	const sectorOutput: Record<string, number> = {};
	for(const [sector, res] of Object.entries(sectorResults as Record<string, SectorResult>)) {
		let sectorValue = 0;
		for(const [good, qty] of Object.entries(res.producedGoods as Partial<Goods>)) {
			const price = priceMemory[good as keyof Goods] ?? basePrices[good as keyof Goods] ?? 1;
			sectorValue += qty * price;
		}
		sectorOutput[sector] = sectorValue;
	}
	const nominalGDP = Object.values(sectorOutput).reduce((sum, v) => sum + v, 0);

	// --- Real GDP (deflated by base year prices) ---
	let realGDP = 0;
	for(const [sector, res] of Object.entries(sectorResults)) {
		for(const [good, qty] of Object.entries(res.producedGoods as Partial<Goods>)) {
			const basePrice = basePrices[good as keyof Goods] ?? 1;
			realGDP += qty * basePrice;
		}
	}

	// --- Price Level & Inflation (period-over-period) ---
	const currentPrices: Record<string, number> = {};
	for(const key of Object.keys(goods) as (keyof Goods)[]) {
		currentPrices[key] = priceMemory[key] ?? basePrices[key] ?? 1;
	}
	
	// CPI basket: core consumption goods
	const cpiBasket: (keyof Goods)[] = ["food", "water", "energy", "consumerGoods", "healthcare", "education", "services"];
	let priceIndex = 0;
	for(const good of cpiBasket) {
		priceIndex += currentPrices[good] ?? 1;
	}
	priceIndex = priceIndex / cpiBasket.length;
	
	// Inflation as period-over-period change in price index
	const inflationRate = prevPriceIndex > 0 ? (priceIndex - prevPriceIndex) / prevPriceIndex : 0;

	// --- Labor Market ---
	const workingWorkers: Record<string, number> = {};
	const freeWorkers: Record<string, number> = {};
	let totalWorking = 0;
	let totalFree = 0;
	
	for(const key of Object.keys(population) as (keyof Population)[]) {
		workingWorkers[key] = result.workingWorkers[key]?.number ?? 0;
		freeWorkers[key] = result.freeWorkers[key]?.number ?? 0;
		totalWorking += workingWorkers[key];
		totalFree += freeWorkers[key];
	}
	
	const laborForce = totalWorking + totalFree;
	const unemploymentRate = laborForce > 0 ? totalFree / laborForce : 0;
	const employmentRate = laborForce > 0 ? totalWorking / laborForce : 0;
	const participationRate = laborForce > 0 ? laborForce / Object.values(population).reduce((s, p) => s + p.number, 0) : 0;

	// --- Wages & Income ---
	const nominalWages: Record<string, number> = {};
	const realWages: Record<string, number> = {};
	let totalWealth = 0;
	let totalWorkers = 0;
	let medianWealth = 0;
	
	const wealthArray: number[] = [];
	for(const key of Object.keys(population) as (keyof Population)[]) {
		nominalWages[key] = wages[key] ?? 0;
		realWages[key] = priceIndex > 0 ? (wages[key] ?? 0) / priceIndex : 0;
		
		const wealth = population[key]?.wealth ?? 0;
		wealthArray.push(wealth);
		totalWealth += wealth;
		totalWorkers += population[key]?.number ?? 0;
	}
	
	wealthArray.sort((a, b) => a - b);
	medianWealth = wealthArray.length > 0 ? wealthArray[Math.floor(wealthArray.length / 2)] : 0;
	const averageHouseholdWealth = totalWorkers > 0 ? totalWealth / totalWorkers : 0;

	// --- Sector Health ---
	const sectorProfitMargins: Record<string, number> = {};
	for(const sector of Object.keys(sectorProfits)) {
		const revenue = sectorRevenue[sector] ?? 0;
		const profit = sectorProfits[sector] ?? 0;
		sectorProfitMargins[sector] = revenue > 0 ? profit / revenue : 0;
	}

	// --- Government Finance ---
	const treasuryRevenue = 0; // Would need tax revenue tracking
	const treasuryExpenditure = 0; // Will be set from acct below

	// --- Productivity ---
	const outputPerWorker = totalWorking > 0 ? realGDP / totalWorking : 0;
	const outputPerSector: Record<string, number> = {};
	for(const [sector, res] of Object.entries(sectorResults)) {
		let sectorWorkers = 0;
		for(const [, count] of Object.entries(res.workersEmployed)) {
			sectorWorkers += count as number;
		}
		outputPerSector[sector] = sectorWorkers > 0 ? (sectorOutput[sector] ?? 0) / sectorWorkers : 0;
	}

	// --- Inventory / Supply ---
	const inventoryCoverage: Record<string, number> = {};
	const stockToConsumptionRatio: Record<string, number> = {};
	const shortageGoods: (keyof Goods)[] = [];
	
	const acct = accounting as {
		sectorInputPaymentBreakdown: InputPaymentBreakdown;
		householdSalesByGood: Partial<Goods>;
		treasurySubsidiesPaid: Record<string, number>;
		sectorInputsConsumedByGood: Partial<Goods>;
		sectorProductionByGood: Partial<Goods>;
	};
	
	for(const key of Object.keys(goods) as (keyof Goods)[]) {
		const stock = goods[key] ?? 0;
		const consumption = acct.sectorInputsConsumedByGood[key] ?? 0;
		const householdConsumption = acct.householdSalesByGood[key] ?? 0;
		const totalConsumption = consumption + householdConsumption;
		
		inventoryCoverage[key] = totalConsumption > 0 ? stock / totalConsumption : Infinity;
		stockToConsumptionRatio[key] = totalConsumption > 0 ? stock / totalConsumption : 0;
		
		if (stock < totalConsumption * 0.1 && totalConsumption > 0) {
			shortageGoods.push(key);
		}
}

// --- Trade Balance ---
	const paymentBreakdown = acct.sectorInputPaymentBreakdown;
	const sectorToSectorTrade = Object.values(paymentBreakdown ?? {})
		.flatMap((b: Record<string, number>) => Object.values(b))
		.reduce((sum, amount: number) => sum + amount, 0);
	
	const householdTrade = Object.values(acct.householdSalesByGood ?? {}).reduce((s: number, v: number) => s + v, 0);

	const treasurySubsidies = Object.values(acct.treasurySubsidiesPaid).reduce((s: number, v: number) => s + v, 0);

	return {
		tick: 0, // Set by caller
		nominalGDP,
		realGDP,
		sectorOutput: sectorOutput as Record<keyof IndustrialSectors, number>,
		priceLevel: currentPrices as Record<keyof Goods, number>,
		inflationRate,
		cpiBasket,
		priceIndex,
		prevPriceIndex,
		unemploymentRate,
		employmentRate,
		participationRate,
		workingWorkers: workingWorkers as Record<keyof Population, number>,
		freeWorkers: freeWorkers as Record<keyof Population, number>,
		nominalWages: nominalWages as Record<keyof Population, number>,
		realWages: realWages as Record<keyof Population, number>,
		medianHouseholdWealth: medianWealth,
		averageHouseholdWealth,
		sectorProfits: sectorProfits as Record<string, number>,
		sectorProfitMargins,
		sectorUtilization: sectorUtilization as Record<string, number>,
		sectorStopReasons: sectorStopReason as Record<string, string>,
		treasuryBalance: colonyTreasury,
		treasuryRevenue: 0,
		treasuryExpenditure: treasurySubsidies,
		treasurySubsidies: treasurySubsidies,
		outputPerWorker,
		outputPerSector: outputPerSector as Record<keyof IndustrialSectors, number>,
		inventoryCoverage: inventoryCoverage as Record<keyof Goods, number>,
		stockToConsumptionRatio: stockToConsumptionRatio as Record<keyof Goods, number>,
		shortageGoods,
		sectorToSectorTrade,
		householdTrade,
	};
}

export class EconomicDashboard {
	private history: EconomicIndicators[] = [];
	private prevPriceIndex: number = 1;
	
	constructor() {
	}
	
	recordTick(result: IndustryTickResult, priceMemory: Partial<Record<keyof Goods, number>> = {}): EconomicIndicators {
		const indicators = computeIndicators(result, this.prevPriceIndex, priceMemory);
		indicators.tick = this.history.length;
		this.prevPriceIndex = indicators.priceIndex;
		this.history.push(indicators);
		return indicators;
	}
	
	getHistory(): EconomicIndicators[] {
		return this.history;
	}
	
	getSeries(): IndicatorSeries {
		return {
			nominalGDP: this.history.map(h => h.nominalGDP),
			realGDP: this.history.map(h => h.realGDP),
			inflationRate: this.history.map(h => h.inflationRate),
			unemploymentRate: this.history.map(h => h.unemploymentRate),
			treasuryBalance: this.history.map(h => h.treasuryBalance),
			averageHouseholdWealth: this.history.map(h => h.averageHouseholdWealth),
			medianHouseholdWealth: this.history.map(h => h.medianHouseholdWealth),
			outputPerWorker: this.history.map(h => h.outputPerWorker),
			totalProduction: this.history.map(h => Object.values(h.sectorOutput).reduce((s, v) => s + v, 0)),
			totalConsumption: this.history.map(h => Object.values(h.stockToConsumptionRatio).reduce((s, v) => s + v, 0)),
		};
	}
	
	getLatest(): EconomicIndicators | null {
		return this.history.length > 0 ? this.history[this.history.length - 1] : null;
	}
	
	exportCSV(): string {
		if (this.history.length === 0) return "";
		
		const headers = [
			"tick", "nominalGDP", "realGDP", "inflationRate", "unemploymentRate",
			"employmentRate", "treasuryBalance", "averageHouseholdWealth",
			"medianHouseholdWealth", "outputPerWorker", "sectorToSectorTrade", "householdTrade"
		];
		
		const rows = this.history.map(h => [
			h.tick,
			h.nominalGDP.toFixed(2),
			h.realGDP.toFixed(2),
			h.inflationRate.toFixed(6),
			h.unemploymentRate.toFixed(6),
			h.employmentRate.toFixed(6),
			h.treasuryBalance.toFixed(2),
			h.averageHouseholdWealth.toFixed(2),
			h.medianHouseholdWealth.toFixed(2),
			h.outputPerWorker.toFixed(2),
			h.sectorToSectorTrade.toFixed(2),
			h.householdTrade.toFixed(2),
		].join(","));
		
		return [headers.join(","), ...rows].join("\n");
	}
	
	clear(): void {
		this.history = [];
	}
}
