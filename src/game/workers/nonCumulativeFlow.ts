import { Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import type { SectorBid } from "./SectorBid";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";

const EMPTY_WAREHOUSE = createEmptyWarehouse();

export type NonCumulativeSectorNode = {
	sectorName: string;
	bid: SectorBid;
	idealNonCumulativeDemand: Partial<Record<keyof Goods, number>>;
	cumulativeDemand: Partial<Record<keyof Goods, number>>;
	idealProduction: Partial<Record<keyof Goods, number>>;
	dependsOn: Set<string>;
	requiredBy: Set<string>;
};

export interface NonCumulativeFlowResult {
	sectorResults: Record<string, SectorResult>;
	sectorProfits: Record<string, number>;
	sectorRevenue: Record<string, number>;
	sectorLaborCosts: Record<string, number>;
	sectorInputCosts: Record<string, number>;
	sectorUtilization: Record<string, number>;
	sectorStopReason: Record<string, string>;
	workingWorkers: Record<keyof Population, PopulationBreakdown>;
	remainingWorkers: Record<keyof Population, PopulationBreakdown>;
	sumGoodsRequirements: Goods;
	sumGoodsProduction: Goods;
	executedSectors: Set<string>;
}

function buildDependencyGraph(
	sectorBids: SectorBid[],
	colonyGoods: Goods
): Map<string, NonCumulativeSectorNode> {
	const nodes = new Map<string, NonCumulativeSectorNode>();

	for (const bid of sectorBids) {
		const idealNonCumulativeDemand: Partial<Record<keyof Goods, number>> = {};
		const cumulativeDemand: Partial<Record<keyof Goods, number>> = {};

		const nonEssentialGoods = bid.nonEssentialGoods ?? new Set<keyof Goods>();

		for (const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
			const key = goodKey as keyof Goods;
			const scaledDemand = demandPerTick * bid.actualScale;
			if (NON_CUMULATING_GOODS.has(key)) {
				idealNonCumulativeDemand[key] = scaledDemand;
			} else if (!nonEssentialGoods.has(key)) {
				// Only add to cumulative demand if it's not a non-essential good
				// Non-essential goods are optional and don't block production
				cumulativeDemand[key] = scaledDemand;
			}
			// Non-essential goods are tracked but don't constrain production scale
		}

		const idealProduction: Partial<Record<keyof Goods, number>> = {};
		for (const [goodKey, prodPerTick] of Object.entries(bid.idealGoodsProduction)) {
			const key = goodKey as keyof Goods;
			idealProduction[key] = prodPerTick * bid.actualScale;
		}

		nodes.set(bid.name, {
			sectorName: bid.name,
			bid,
			idealNonCumulativeDemand,
			cumulativeDemand,
			idealProduction,
			dependsOn: new Set(),
			requiredBy: new Set(),
		});
	}

	const producerMap = new Map<keyof Goods, string[]>();
	for (const [sectorName, node] of nodes) {
		for (const good of Object.keys(node.idealProduction) as (keyof Goods)[]) {
			if (NON_CUMULATING_GOODS.has(good)) {
				const production = node.idealProduction[good] ?? 0;
				if (production > 0) {
					if (!producerMap.has(good)) {
						producerMap.set(good, []);
					}
					producerMap.get(good)!.push(sectorName);
				}
			}
		}
	}

	for (const [sectorName, node] of nodes) {
		for (const good of Object.keys(node.idealNonCumulativeDemand) as (keyof Goods)[]) {
			const demand = node.idealNonCumulativeDemand[good] ?? 0;
			const startingStock = colonyGoods[good] ?? 0;

			// Only create dependency if starting stock is insufficient to meet demand
			if (startingStock < demand) {
				const producers = producerMap.get(good) ?? [];
				for (const producer of producers) {
					if (producer !== sectorName) {
						node.dependsOn.add(producer);
						nodes.get(producer)?.requiredBy.add(sectorName);
					}
				}
			}
		}
	}

	return nodes;
}

export function executeNonCumulativeFlow(
	sectorBids: SectorBid[],
	colonyGoods: Goods,
	prices: Record<keyof Goods, number>,
	salaries: Record<keyof Population, number>,
	laborAllocations: Record<string, Partial<Record<keyof Population, number>>> | undefined,
	purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> | undefined,
	population: Population,
	availableWorkers: Record<keyof Population, number>
): NonCumulativeFlowResult {
	// laborAllocations is required for execution; provide empty object if undefined
	const finalLaborAllocations = laborAllocations ?? {};

	// Build dependency graph (for diagnostics only - no longer blocks execution)
	const nodes = buildDependencyGraph(sectorBids, colonyGoods);

	// Initialize flow pool from starting colony stock (non-cumulative goods only)
	const flowPool: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
	for (const good of NON_CUMULATING_GOODS) {
		flowPool[good] = colonyGoods[good] ?? 0;
	}

	// Prepare result containers
	const sectorResults: Record<string, SectorResult> = {};
	const sectorProfits: Record<string, number> = {};
	const sectorRevenue: Record<string, number> = {};
	const sectorLaborCosts: Record<string, number> = {};
	const sectorInputCosts: Record<string, number> = {};
	const sectorUtilization: Record<string, number> = {};
	const sectorStopReason: Record<string, string> = {};
	const sumGoodsRequirements = { ...EMPTY_WAREHOUSE };
	const sumGoodsProduction = { ...EMPTY_WAREHOUSE };
	const executedSectors = new Set<string>();

	// Worker tracking
	const workingWorkers: Record<keyof Population, PopulationBreakdown> = { ...population };
	for (const key of Object.keys(workingWorkers) as (keyof Population)[]) {
		workingWorkers[key] = { ...workingWorkers[key], number: 0 };
	}
	const remainingWorkers: Record<keyof Population, PopulationBreakdown> = { ...population };
	for (const key of Object.keys(remainingWorkers) as (keyof Population)[]) {
		remainingWorkers[key] = { ...remainingWorkers[key], number: availableWorkers[key] ?? 0 };
	}

	// All sectors start as pending
	const pendingSectors = new Map(nodes);

	// Track which sectors have been executed
	const executedSectorNames = new Set<string>();

	// Phase 1: Same-tick execution loop
	// Keep executing passes until no more sectors can run
	let hasProgress = true;
	while (hasProgress && pendingSectors.size > 0) {
		hasProgress = false;

		// Find all sectors that can execute in this pass
		// Check against LIVE flow pool (not a snapshot)
		const readySectors: NonCumulativeSectorNode[] = [];

		for (const [, node] of pendingSectors) {
			// Check cumulative inputs first - they must be fully available
			let canExecute = true;
			for (const [good, demand] of Object.entries(node.cumulativeDemand)) {
				const key = good as keyof Goods;
				const available = purchasedBySector?.[node.sectorName]?.[key] ?? colonyGoods[key] ?? 0;
				if (demand > 0 && available < demand * 1e-9) {
					canExecute = false;
					break;
				}
			}

			// Check mandatory non-cumulative inputs against live flow pool
			if (canExecute) {
				const nonEssentialGoods = node.bid.nonEssentialGoods ?? new Set<keyof Goods>();
				for (const [good, required] of Object.entries(node.idealNonCumulativeDemand)) {
					const key = good as keyof Goods;
					if (required > 0 && !nonEssentialGoods.has(key)) {
						const available = flowPool[key] ?? 0;
						if (available < required * 1e-9) {
							canExecute = false;
							break;
						}
					}
				}
			}

			if (canExecute) {
				readySectors.push(node);
			}
		}

		if (readySectors.length === 0) break;

		// Execute all ready sectors in this pass
		// Use deterministic order (by sector name) for consistency
		readySectors.sort((a, b) => a.sectorName.localeCompare(b.sectorName));

		for (const node of readySectors) {
			// Remove from pending
			pendingSectors.delete(node.sectorName);
			executedSectorNames.add(node.sectorName);

			const nonEssentialGoods = node.bid.nonEssentialGoods ?? new Set<keyof Goods>();

			// Check mandatory non-cumulative inputs against LIVE flow pool
			let flowScale = 1;
			const mandatoryDemand: Partial<Record<keyof Goods, number>> = {};
			const optionalDemand: Partial<Record<keyof Goods, number>> = {};

			for (const [good, required] of Object.entries(node.idealNonCumulativeDemand)) {
				const key = good as keyof Goods;
				if (required > 0) {
					if (nonEssentialGoods.has(key)) {
						optionalDemand[key] = required;
					} else {
						mandatoryDemand[key] = required;
						const available = flowPool[key] ?? 0;
						const ratio = available / required;
						flowScale = Math.min(flowScale, ratio);
					}
				}
			}

			flowScale = Math.min(1, Math.max(0, flowScale));

			// If no mandatory inputs can be satisfied, sector cannot produce
			if (flowScale <= 1e-9 && Object.keys(mandatoryDemand).length > 0) {
				sectorResults[node.sectorName] = {
					name: node.sectorName,
					consumedGoods: {},
					producedGoods: {},
					workersEmployed: {},
					productionRatio: 0,
					inputLevel: node.bid.inputLevel,
					outputLevel: node.bid.outputLevel,
				};
				sectorProfits[node.sectorName] = 0;
				sectorRevenue[node.sectorName] = 0;
				sectorLaborCosts[node.sectorName] = 0;
				sectorInputCosts[node.sectorName] = 0;
				sectorUtilization[node.sectorName] = 0;
				sectorStopReason[node.sectorName] = "No materials";
				executedSectors.add(node.sectorName);
				hasProgress = true;
				continue;
			}

			// Check cumulative inputs
			let cumulativeRatio = 1;
			for (const [good, cumulativeDemand] of Object.entries(node.cumulativeDemand)) {
				const key = good as keyof Goods;
				if (cumulativeDemand > 0) {
					const available = purchasedBySector?.[node.sectorName]?.[key] ?? colonyGoods[key] ?? 0;
					const ratio = available / cumulativeDemand;
					cumulativeRatio = Math.min(cumulativeRatio, ratio);
				}
			}

			let finalScale = Math.min(flowScale, cumulativeRatio);

			// Apply non-essential goods penalty
			let missingNonEssentialNames: string[] = [];
			let optionalConsumption: Partial<Record<keyof Goods, number>> = {};
			if (nonEssentialGoods.size > 0) {
				let missingNonEssential = 0;
				for (const [goodKey] of Object.entries(node.bid.idealGoodsDemand)) {
					const key = goodKey as keyof Goods;
					if (nonEssentialGoods.has(key)) {
						// Check actual availability for optional goods
						const available = purchasedBySector?.[node.sectorName]?.[key] ?? colonyGoods[key] ?? 0;
						const required = node.idealNonCumulativeDemand[key] ?? 0;
						if (available <= 0) {
							missingNonEssential++;
							missingNonEssentialNames.push(String(key));
							optionalConsumption[key] = 0; // Not consumed
						} else {
							// Consume up to available, but not more than required
							optionalConsumption[key] = Math.min(required, available);
						}
					}
				}
				const penalty = Math.min(0.5, missingNonEssential * 0.1);
				finalScale *= (1 - penalty);
			}

			if (finalScale <= 1e-9) {
				sectorResults[node.sectorName] = {
					name: node.sectorName,
					consumedGoods: {},
					producedGoods: {},
					workersEmployed: {},
					productionRatio: 0,
					inputLevel: node.bid.inputLevel,
					outputLevel: node.bid.outputLevel,
				};
				sectorProfits[node.sectorName] = 0;
				sectorRevenue[node.sectorName] = 0;
				sectorLaborCosts[node.sectorName] = 0;
				sectorInputCosts[node.sectorName] = 0;
				sectorUtilization[node.sectorName] = 0;
				sectorStopReason[node.sectorName] = "No materials";
				executedSectors.add(node.sectorName);
				hasProgress = true;
				continue;
			}

			// Deduct mandatory non-cumulative goods from LIVE flow pool
			const mandatoryConsumption: Partial<Record<keyof Goods, number>> = {};
			for (const [good, required] of Object.entries(mandatoryDemand)) {
				const key = good as keyof Goods;
				const consumed = required * finalScale;
				mandatoryConsumption[key] = consumed;
				flowPool[key] = (flowPool[key] ?? 0) - consumed;
			}

			// Execute the sector at effective scale
			const effectiveScale = node.bid.actualScale * finalScale;

			// Build stop reason
			let stopReason = "Producing";
			if (missingNonEssentialNames.length > 0) {
				stopReason = `Missing non-essential: ${missingNonEssentialNames.join(", ")} (-${Math.round(Math.min(0.5, missingNonEssentialNames.length * 0.1) * 100)}%)`;
			}

			const result = executeSingleSector(
				node.bid,
				effectiveScale,
				salaries,
				finalLaborAllocations,
				remainingWorkers,
				workingWorkers,
				prices
			);

			// Override consumed goods to match actual consumption (mandatory + optional)
			const actualConsumedGoods: Partial<Goods> = { ...result.result.consumedGoods };
			for (const [good, consumed] of Object.entries(mandatoryConsumption)) {
				actualConsumedGoods[good as keyof Goods] = consumed;
			}
			for (const [good, consumed] of Object.entries(optionalConsumption)) {
				actualConsumedGoods[good as keyof Goods] = consumed;
			}

			sectorResults[node.sectorName] = {
				...result.result,
				consumedGoods: actualConsumedGoods,
			};
			sectorProfits[node.sectorName] = result.profit;
			sectorRevenue[node.sectorName] = 0; // Revenue from population sales added later
			sectorLaborCosts[node.sectorName] = result.laborCosts;
			sectorInputCosts[node.sectorName] = result.inputCosts;
			sectorUtilization[node.sectorName] = effectiveScale;
			sectorStopReason[node.sectorName] = stopReason;
			executedSectors.add(node.sectorName);
			hasProgress = true;

			// Add non-cumulative production to LIVE flow pool immediately
			for (const [good, produced] of Object.entries(result.result.producedGoods)) {
				const key = good as keyof Goods;
				if (NON_CUMULATING_GOODS.has(key)) {
					flowPool[key] = (flowPool[key] ?? 0) + produced;
				}
				const nextProd = (sumGoodsProduction[key] ?? 0) + produced;
				sumGoodsProduction[key] = nextProd;
			}

			// Track actual consumption
			for (const [good, consumed] of Object.entries(actualConsumedGoods)) {
				const key = good as keyof Goods;
				const nextReq = (sumGoodsRequirements[key] ?? 0) + consumed;
				sumGoodsRequirements[key] = nextReq;
			}
		}
	}

	// Phase 2: Remaining pending sectors cannot execute (input-constrained)
	for (const [, node] of pendingSectors) {
		const result = executeSingleSector(
			node.bid,
			0,
			salaries,
			finalLaborAllocations,
			remainingWorkers,
			workingWorkers,
			prices
		);

		sectorResults[node.sectorName] = result.result;
		sectorProfits[node.sectorName] = result.profit;
		sectorRevenue[node.sectorName] = 0;
		sectorLaborCosts[node.sectorName] = result.laborCosts;
		sectorInputCosts[node.sectorName] = result.inputCosts;
		sectorUtilization[node.sectorName] = 0;
		sectorStopReason[node.sectorName] = "No materials";
		executedSectors.add(node.sectorName);
	}

	// Sectors not in the graph at all (shouldn't happen, but handle gracefully)
	for (const bid of sectorBids) {
		if (!executedSectors.has(bid.name)) {
			const result = executeSingleSector(
				bid,
				0,
				salaries,
				finalLaborAllocations,
				remainingWorkers,
				workingWorkers,
				prices
			);
			sectorResults[bid.name] = result.result;
			sectorProfits[bid.name] = result.profit;
			sectorRevenue[bid.name] = 0;
			sectorLaborCosts[bid.name] = result.laborCosts;
			sectorInputCosts[bid.name] = result.inputCosts;
			sectorUtilization[bid.name] = 0;
			sectorStopReason[bid.name] = result.stopReason;
		}
	}

	return {
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
		executedSectors,
	};
}

interface SingleSectorResult {
	result: SectorResult;
	profit: number;
	laborCosts: number;
	inputCosts: number;
	stopReason: string;
}

function executeSingleSector(
	bid: SectorBid,
	finalScale: number,
	salaries: Record<keyof Population, number>,
	laborAllocations: Record<string, Partial<Record<keyof Population, number>>>,
	remainingWorkers: Record<keyof Population, PopulationBreakdown>,
	workingWorkers: Record<keyof Population, PopulationBreakdown>,
	prices: Record<keyof Goods, number>
): SingleSectorResult {
	if (finalScale <= 0) {
		return {
			result: {
				name: bid.name,
				consumedGoods: {},
				producedGoods: {},
				workersEmployed: {},
				productionRatio: 0,
				inputLevel: bid.inputLevel,
				outputLevel: bid.outputLevel,
			},
			profit: 0,
			laborCosts: 0,
			inputCosts: 0,
			stopReason: "No materials",
		};
	}

	const workersEmployed: Partial<Record<keyof Population, number>> = {};
	const sectorLaborAllocation = laborAllocations[bid.name];

	if (!sectorLaborAllocation) {
		throw new Error(`Missing labor allocation for sector ${bid.name}`);
	}

	for (const [key, demandPerTick] of Object.entries(bid.idealWorkerDemand)) {
		if (!Number.isFinite(demandPerTick) || demandPerTick < 0) {
			throw new Error(`Invalid worker demand for ${bid.name}/${key}`);
		}
		if (demandPerTick === 0) continue;

		const popType = key as keyof Population;
		const demanded = demandPerTick * finalScale;

		const alloc = sectorLaborAllocation[popType] ?? 0;
		if (!Number.isFinite(alloc) || alloc < 0) {
			throw new Error(`Invalid labor allocation for ${bid.name}, ${key}: ${alloc}`);
		}
		if (alloc + 1e-9 < demanded) {
			throw new Error(
				`Labor allocation insufficient for ${bid.name}, ${key}: ` +
				`allocated ${alloc}, required ${demanded}`
			);
		}
		const employed = demanded;

		const available = remainingWorkers[popType].number;
		if (employed > available + 1e-9) {
			throw new Error(
				`Worker allocation exceeds available population for ${bid.name}/${key}`
			);
		}
		remainingWorkers[popType] = {
			...remainingWorkers[popType],
			number: available - employed,
		};
		workersEmployed[popType] = employed;
		workingWorkers[popType] = {
			...workingWorkers[popType],
			number: workingWorkers[popType].number + employed,
		};
	}

	const consumedGoods: Partial<Goods> = {};
	for (const [key, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
		const consumed = demandPerTick * finalScale;
		consumedGoods[key as keyof Goods] = consumed;
	}

	const producedGoods: Partial<Goods> = {};
	for (const [key, prodPerTick] of Object.entries(bid.idealGoodsProduction)) {
		const produced = prodPerTick * finalScale;
		producedGoods[key as keyof Goods] = produced;
	}

	for (const key of Object.keys(consumedGoods) as (keyof Goods)[]) {
		const price = prices[key];
		if (!Number.isFinite(price) || price < 0) {
			throw new Error(`Invalid price for ${key}: ${price}`);
		}
	}
	for (const key of Object.keys(workersEmployed) as (keyof Population)[]) {
		const salary = salaries[key];
		if (!Number.isFinite(salary) || salary < 0) {
			throw new Error(`Invalid salary for ${key}: ${salary}`);
		}
	}

	const inputCosts = Object.entries(consumedGoods).reduce((sum, [key, amount]) => {
		return sum + amount * prices[key as keyof Goods];
	}, 0);
	const laborCosts = Object.entries(workersEmployed).reduce((sum, [key, amount]) => {
		return sum + amount * salaries[key as keyof Population];
	}, 0);

	if (!Number.isFinite(inputCosts) || inputCosts < 0) {
		throw new Error(`Invalid input costs for ${bid.name}: ${inputCosts}`);
	}
	if (!Number.isFinite(laborCosts) || laborCosts < 0) {
		throw new Error(`Invalid labor costs for ${bid.name}: ${laborCosts}`);
	}

	const stopReason = "Producing";

	return {
		result: {
			name: bid.name,
			consumedGoods,
			producedGoods,
			workersEmployed,
			productionRatio: finalScale,
			inputLevel: bid.inputLevel,
			outputLevel: bid.outputLevel,
		},
		profit: -(inputCosts + laborCosts),
		laborCosts,
		inputCosts,
		stopReason,
	};
}