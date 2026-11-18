import { createSimState, simulateTick } from "./economyConfigGenerator.ts";
import { generateColonyConfig } from "./generateColonyConfig.ts";
import { EconomicDashboard } from "../workers/economicIndicators.ts";
import { TransactionLedger } from "../workers/transactionLedger.ts";
import type { IndustryTickInput } from "../workers/IndustryTickInput.ts";
import type { IndustryTickResult } from "../workers/IndustryTickResult.ts";
import type { Population } from "../data/Population.ts";
import type { IndustrialSectors } from "../components/Factories.ts";
import type { Goods } from "../data/Goods.ts";

export interface ScenarioSeed {
	name: string;
	description: string;
	config: {
		populationSize: number;
		activeSectors: (keyof IndustrialSectors)[];
		starterMoneyPerSector: number;
		capitalStockMultiplier: number;
		initialGoodsOverrides?: Partial<Goods>;
	};
	expectedOutcome: "stable" | "collapse" | "recovery" | "growth";
}

export const SCENARIO_LIBRARY: ScenarioSeed[] = [
	{
		name: "stable_economy",
		description: "Normal economy with sufficient resources",
		config: {
			populationSize: 100_000,
			activeSectors: [
				"powerPlant", "farm", "waterTreatment", "foodFactory", "oilRig",
				"forestry", "government", "services", "healthcare", "education",
				"lawEnforcement", "logistics", "tourism", "entertainmentIndustry",
				"bank", "religion", "defense", "chemical", "recycling",
				"consumerFactory", "paperFactory"
			],
			starterMoneyPerSector: 1_000_000_000,
			capitalStockMultiplier: 1,
		},
		expectedOutcome: "stable",
	},
	{
		name: "oil_shortage_collapse",
		description: "Oil shortage causes power plant collapse",
		config: {
			populationSize: 100_000,
			activeSectors: [
				"powerPlant", "farm", "waterTreatment", "foodFactory", "forestry",
				"government", "services", "healthcare", "education", "lawEnforcement",
				"logistics", "tourism", "entertainmentIndustry", "bank", "religion",
				"defense", "chemical", "recycling", "consumerFactory", "paperFactory"
			],
			starterMoneyPerSector: 1_000_000_000,
			capitalStockMultiplier: 1,
			initialGoodsOverrides: { oil: 5000 },
		},
		expectedOutcome: "collapse",
	},
	{
		name: "treasury_recovery",
		description: "Treasury intervention restores collapsed economy",
		config: {
			populationSize: 100_000,
			activeSectors: [
				"powerPlant", "farm", "waterTreatment", "foodFactory", "oilRig",
				"forestry", "government"
			],
			starterMoneyPerSector: 1_000_000_000,
			capitalStockMultiplier: 1,
			initialGoodsOverrides: { oil: 1000 },
		},
		expectedOutcome: "recovery",
	},
	{
		name: "high_population_stress",
		description: "High population growth stresses resources",
		config: {
			populationSize: 200_000,
			activeSectors: [
				"powerPlant", "farm", "waterTreatment", "foodFactory", "oilRig",
				"forestry", "government", "services", "healthcare", "education",
				"lawEnforcement", "logistics", "tourism", "entertainmentIndustry",
				"bank", "religion", "defense", "chemical", "recycling",
				"consumerFactory", "paperFactory"
			],
			starterMoneyPerSector: 1_000_000_000,
			capitalStockMultiplier: 1,
			initialGoodsOverrides: {},
		},
		expectedOutcome: "growth",
	},
];

export interface SimulationResult {
	scenarioName: string;
	ticks: number;
	indicators: EconomicDashboard;
	ledger: TransactionLedger;
	eventLog: EventEntry[];
	finalState: IndustryTickInput;
	summary: SimulationSummary;
}

export interface EventEntry {
	tick: number;
	type: "collapse" | "recovery" | "shortage" | "surplus" | "sector_stop" | "sector_start" | "milestone";
	description: string;
	sector?: string;
	good?: keyof Goods;
	severity: "info" | "warning" | "critical";
}

export interface SimulationSummary {
	finalGDP: number;
	finalInflation: number;
	finalUnemployment: number;
	finalTreasury: number;
	totalCollapseEvents: number;
	totalRecoveryEvents: number;
	sectorsStopped: string[];
	sectorsRecovered: string[];
	shortageGoods: (keyof Goods)[];
	surplusGoods: (keyof Goods)[];
	peakUnemployment: number;
	minGDP: number;
	maxGDP: number;
}

function sumValues(values: Iterable<number>): number {
	return [...values].reduce((sum, value) => sum + value, 0);
}

function sumPopulationWealth(population: Population): number {
	return Object.values(population).reduce(
		(sum, pop) => sum + (pop.wealth ?? 0),
		0,
	);
}

export function runScenario(
	scenario: ScenarioSeed,
	maxTicks: number = 500,
	intervention?: (tick: number, input: IndustryTickInput) => IndustryTickInput
): SimulationResult {
	const state = createSimState();
	const dashboard = new EconomicDashboard();
	const ledger = new TransactionLedger();
	const eventLog: EventEntry[] = [];
	
	const capitalMultipliers: Partial<Record<keyof IndustrialSectors, number>> = {};
	
	let input = generateColonyConfig(scenario.config, capitalMultipliers);
	
	// Apply initial goods overrides
	if (scenario.config.initialGoodsOverrides) {
		for (const [key, value] of Object.entries(scenario.config.initialGoodsOverrides)) {
			input.goods[key as keyof Goods] = value;
		}
	}
	
	let prevSectorStops = new Set<string>();
	let peakUnemployment = 0;
	let minGDP = Infinity;
	let maxGDP = -Infinity;
	let totalCollapseEvents = 0;
	let totalRecoveryEvents = 0;
	
	for(let tick = 0; tick < maxTicks; tick++) {
		// Apply intervention if provided
		if (intervention) {
			input = intervention(tick, input);
		}
		
		const result = simulateTick(input, state);
		if(!result) break;
		
		const indicators = dashboard.recordTick(result, state.priceMemory);
		peakUnemployment = Math.max(peakUnemployment, indicators.unemploymentRate);
		minGDP = Math.min(minGDP, indicators.nominalGDP);
		maxGDP = Math.max(maxGDP, indicators.nominalGDP);
		
		// Record sector stop/start events
		const currentStops = new Set<string>();
		for(const [sector, reason] of Object.entries(result.sectorStopReason)) {
			if (reason) currentStops.add(sector);
		}
		
		for(const sector of currentStops) {
			if (!prevSectorStops.has(sector)) {
				const severity = result.sectorStopReason[sector] === "No money" || 
					result.sectorStopReason[sector] === "No materials" ? "critical" : "warning";
				eventLog.push({
					tick,
					type: "sector_stop",
					description: `${sector} stopped: ${result.sectorStopReason[sector]}`,
					sector,
					severity,
				});
				if (severity === "critical") totalCollapseEvents++;
			}
		}
		
		for(const sector of prevSectorStops) {
			if (!currentStops.has(sector)) {
				eventLog.push({
					tick,
					type: "sector_start",
					description: `${sector} resumed production`,
					sector,
					severity: "info",
				});
				totalRecoveryEvents++;
			}
		}
		prevSectorStops = currentStops;
		
		// Check for shortages/surpluses
		for(const good of indicators.shortageGoods) {
			if (tick === 0 || !eventLog.some(e => e.type === "shortage" && e.good === good && e.tick === tick - 1)) {
				eventLog.push({
					tick,
					type: "shortage",
					description: `Shortage of ${good}`,
					good,
					severity: "warning",
				});
			}
		}
		
		// Milestone events
		if (tick === 0) {
			eventLog.push({
				tick: 0,
				type: "milestone",
				description: `Simulation started: ${scenario.name}`,
				severity: "info",
			});
		}
		
		input = {
			...input,
			goods: result.goods,
			money: result.money,
			capitalStock: result.capitalStock,
			population: result.population ?? input.population,
			colonyTreasury: result.colonyTreasury,
		} as IndustryTickInput;
	}
	
	const finalIndicators = dashboard.getLatest();
	const shortageGoods = finalIndicators?.shortageGoods ?? [];
	const surplusGoods: (keyof Goods)[] = [];
	
	if (finalIndicators) {
		for(const [good, coverage] of Object.entries(finalIndicators.inventoryCoverage)) {
			if (coverage > 10) surplusGoods.push(good as keyof Goods);
		}
	}
	
	const sectorsStopped = [...prevSectorStops];
	const sectorsRecovered = eventLog
		.filter(e => e.type === "sector_start")
		.map(e => e.sector!)
		.filter((v, i, a) => a.indexOf(v) === i);
	
	const summary: SimulationSummary = {
		finalGDP: finalIndicators?.nominalGDP ?? 0,
		finalInflation: finalIndicators?.inflationRate ?? 0,
		finalUnemployment: finalIndicators?.unemploymentRate ?? 0,
		finalTreasury: finalIndicators?.treasuryBalance ?? 0,
		totalCollapseEvents,
		totalRecoveryEvents,
		sectorsStopped,
		sectorsRecovered,
		shortageGoods,
		surplusGoods,
		peakUnemployment,
		minGDP: minGDP === Infinity ? 0 : minGDP,
		maxGDP: maxGDP === -Infinity ? 0 : maxGDP,
	};
	
	return {
		scenarioName: scenario.name,
		ticks: dashboard.getHistory().length,
		indicators: dashboard,
		ledger,
		eventLog,
		finalState: input,
		summary,
	};
}

export function runAllScenarios(maxTicks: number = 300): Map<string, SimulationResult> {
	const results = new Map<string, SimulationResult>();
	
	for(const scenario of SCENARIO_LIBRARY) {
		console.log(`Running scenario: ${scenario.name}...`);
		
		let result: SimulationResult;
		
		if (scenario.name === "treasury_recovery") {
			// Special intervention for treasury recovery
			result = runScenario(scenario, maxTicks, (tick, input) => {
				if (tick === 50) {
					// Treasury intervention at tick 50
					input.money.powerPlant = 10_000_000;
					input.goods.oil = 100_000;
					input.goods.environmentFactor = 10_000;
					input.goods.governance = 10_000;
				}
				return input;
			});
		} else {
			result = runScenario(scenario, maxTicks);
		}
		
		results.set(scenario.name, result);
		console.log(`  Completed: ${result.ticks} ticks, GDP=${result.summary.finalGDP.toFixed(0)}, Unemployment=${(result.summary.finalUnemployment * 100).toFixed(1)}%`);
	}
	
	return results;
}

export function generateReport(result: SimulationResult): string {
	const lines: string[] = [];
	lines.push(`=== SIMULATION REPORT: ${result.scenarioName} ===`);
	lines.push(`Ticks simulated: ${result.ticks}`);
	lines.push(`Events recorded: ${result.eventLog.length}`);
	lines.push(``);
	lines.push(`--- SUMMARY ---`);
	lines.push(`Final GDP: ${result.summary.finalGDP.toFixed(2)}`);
	lines.push(`Final Inflation: ${(result.summary.finalInflation * 100).toFixed(2)}%`);
	lines.push(`Final Unemployment: ${(result.summary.finalUnemployment * 100).toFixed(2)}%`);
	lines.push(`Final Treasury: ${result.summary.finalTreasury.toFixed(2)}`);
	lines.push(`Peak Unemployment: ${(result.summary.peakUnemployment * 100).toFixed(2)}%`);
	lines.push(`GDP Range: ${result.summary.minGDP.toFixed(2)} - ${result.summary.maxGDP.toFixed(2)}`);
	lines.push(`Collapse Events: ${result.summary.totalCollapseEvents}`);
	lines.push(`Recovery Events: ${result.summary.totalRecoveryEvents}`);
	lines.push(`Sectors Stopped: ${result.summary.sectorsStopped.join(", ") || "none"}`);
	lines.push(`Sectors Recovered: ${result.summary.sectorsRecovered.join(", ") || "none"}`);
	lines.push(`Shortage Goods: ${result.summary.shortageGoods.join(", ") || "none"}`);
	lines.push(`Surplus Goods: ${result.summary.surplusGoods.join(", ") || "none"}`);
	lines.push(``);
	lines.push(`--- EVENT LOG ---`);
	for(const event of result.eventLog) {
		lines.push(`Tick ${event.tick.toString().padStart(4)} [${event.severity.toUpperCase().padStart(8)}] ${event.type}: ${event.description}`);
	}
	lines.push(``);
	lines.push(`--- ECONOMIC INDICATORS (CSV) ---`);
	lines.push(result.indicators.exportCSV());
	
	return lines.join("\n");
}

export function exportAllReports(results: Map<string, SimulationResult>, outputDir: string = "./simulation_reports"): void {
	// In a real implementation, this would write to files
	console.log(`Would export ${results.size} reports to ${outputDir}`);
	for(const [name, result] of results) {
		console.log(`  ${name}: ${result.ticks} ticks, ${result.eventLog.length} events`);
	}
}
