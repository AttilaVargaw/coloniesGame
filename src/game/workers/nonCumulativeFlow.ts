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

function tarjanSCC(
	nodes: Map<string, NonCumulativeSectorNode>
): { sccId: Map<string, number>; sccs: NonCumulativeSectorNode[][] } {
	const index = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];
	const sccs: NonCumulativeSectorNode[][] = [];
	let idx = 0;

	function strongconnect(v: string): void {
		index.set(v, idx);
		lowlink.set(v, idx);
		idx++;
		stack.push(v);
		onStack.add(v);

		const node = nodes.get(v)!;
		for (const w of node.dependsOn) {
			if (!nodes.has(w)) continue;
			if (!index.has(w)) {
				strongconnect(w);
				lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
			} else if (onStack.has(w)) {
				lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
			}
		}

		if (lowlink.get(v) === index.get(v)) {
			const scc: NonCumulativeSectorNode[] = [];
			let w: string;
			do {
				w = stack.pop()!;
				onStack.delete(w);
				scc.push(nodes.get(w)!);
			} while (w !== v);
			sccs.push(scc);
		}
	}

	for (const v of nodes.keys()) {
		if (!index.has(v)) {
			strongconnect(v);
		}
	}

	const sccId = new Map<string, number>();
	for (let i = 0; i < sccs.length; i++) {
		for (const node of sccs[i]) {
			sccId.set(node.sectorName, i);
		}
	}

	return { sccId, sccs };
}

function buildDependencyGraph(
	sectorBids: SectorBid[]
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
				if (!producerMap.has(good)) {
					producerMap.set(good, []);
				}
				producerMap.get(good)!.push(sectorName);
			}
		}
	}

	for (const [sectorName, node] of nodes) {
		for (const good of Object.keys(node.idealNonCumulativeDemand) as (keyof Goods)[]) {
			const producers = producerMap.get(good) ?? [];
			for (const producer of producers) {
				if (producer !== sectorName) {
					node.dependsOn.add(producer);
					nodes.get(producer)?.requiredBy.add(sectorName);
				}
			}
		}
	}

	return nodes;
}

function kahnTopologicalSort(
	sccs: NonCumulativeSectorNode[][],
	sccId: Map<string, number>
): NonCumulativeSectorNode[][] {
	const sccGraph = new Map<number, Set<number>>();
	const inDegree = new Map<number, number>();

	for (let i = 0; i < sccs.length; i++) {
		sccGraph.set(i, new Set());
		inDegree.set(i, 0);
	}

	for (let i = 0; i < sccs.length; i++) {
		for (const node of sccs[i]) {
			for (const dep of node.dependsOn) {
				const depSccId = sccId.get(dep);
				if (depSccId !== undefined && depSccId !== i) {
					// Consumer (i) depends on producer (depSccId).
					// Producer must execute before consumer.
					if (!sccGraph.get(depSccId)!.has(i)) {
						sccGraph.get(depSccId)!.add(i);
						inDegree.set(i, inDegree.get(i)! + 1);
					}
				}
			}
		}
	}

	const queue: number[] = [];
	for (const [scc, degree] of inDegree) {
		if (degree === 0) queue.push(scc);
	}

	const sorted: NonCumulativeSectorNode[][] = [];
	while (queue.length > 0) {
		const scc = queue.shift()!;
		sorted.push(sccs[scc]);

		for (const next of sccGraph.get(scc)!) {
			inDegree.set(next, inDegree.get(next)! - 1);
			if (inDegree.get(next) === 0) {
				queue.push(next);
			}
		}
	}

	if (sorted.length !== sccs.length) {
		throw new Error("Cycle detected in SCC DAG");
	}

	return sorted;
}

function hasSelfLoop(node: NonCumulativeSectorNode): boolean {
	for (const good of Object.keys(node.idealNonCumulativeDemand) as (keyof Goods)[]) {
		if (node.idealProduction[good] !== undefined && node.idealProduction[good]! > 0) {
			return true;
		}
	}
	return false;
}

function isCyclicSCC(scc: NonCumulativeSectorNode[]): boolean {
	if (scc.length > 1) return true;
	return hasSelfLoop(scc[0]);
}

function findBlockedSCCs(
	sortedSCCs: NonCumulativeSectorNode[][],
	sccId: Map<string, number>
): Set<number> {
	const blocked = new Set<number>();

	// Map original SCC ID to sorted position
	const sortedPositionBySccId = new Map<number, number>();
	for (let position = 0; position < sortedSCCs.length; position++) {
		for (const node of sortedSCCs[position]) {
			const originalId = sccId.get(node.sectorName);
			if (originalId !== undefined) {
				sortedPositionBySccId.set(originalId, position);
			}
		}
	}

	// First pass: mark cyclic SCCs
	for (let i = 0; i < sortedSCCs.length; i++) {
		const scc = sortedSCCs[i];
		const isCyclic = isCyclicSCC(scc);

		if (isCyclic) {
			blocked.add(i);
		}
	}

	// Second pass: propagate blocked status transitively through requiredBy edges
	// Use a worklist algorithm
	const worklist: number[] = [...blocked];
	while (worklist.length > 0) {
		const currentIdx = worklist.pop()!;
		const currentSCC = sortedSCCs[currentIdx];

		for (const node of currentSCC) {
			for (const required of node.requiredBy) {
				const originalReqSccId = sccId.get(required);
				if (originalReqSccId !== undefined) {
					const reqPosition = sortedPositionBySccId.get(originalReqSccId);
					if (reqPosition !== undefined && !blocked.has(reqPosition)) {
						blocked.add(reqPosition);
						worklist.push(reqPosition);
					}
				}
			}
		}
	}

	return blocked;
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

	const nodes = buildDependencyGraph(sectorBids);

	const { sccId, sccs } = tarjanSCC(nodes);

	const sortedSCCs = kahnTopologicalSort(sccs, sccId);

	const blockedSCCs = findBlockedSCCs(sortedSCCs, sccId);

	const flowPool: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
	for (const good of NON_CUMULATING_GOODS) {
		flowPool[good] = colonyGoods[good] ?? 0;
	}

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

	const workingWorkers: Record<keyof Population, PopulationBreakdown> = { ...population };
	for (const key of Object.keys(workingWorkers) as (keyof Population)[]) {
		workingWorkers[key] = { ...workingWorkers[key], number: 0 };
	}
	// Initialize remainingWorkers from availableWorkers (eligible labor only)
	const remainingWorkers: Record<keyof Population, PopulationBreakdown> = { ...population };
	for (const key of Object.keys(remainingWorkers) as (keyof Population)[]) {
		remainingWorkers[key] = { ...remainingWorkers[key], number: availableWorkers[key] ?? 0 };
	}

	const executedInSCC = new Set<string>();

	for (let sccIdx = 0; sccIdx < sortedSCCs.length; sccIdx++) {
		const scc = sortedSCCs[sccIdx];
		const isBlocked = blockedSCCs.has(sccIdx);
		const isCyclic = isCyclicSCC(scc);

		const executableSectors = scc.filter(node => {
			if (executedInSCC.has(node.sectorName)) return false;
			if (isBlocked || isCyclic) return false;
			return true;
		});

		let hasProgress = true;
		while (hasProgress && executableSectors.length > 0) {
			hasProgress = false;

			const readySectors = executableSectors.filter(node => {
				const cumulativeDemand = node.cumulativeDemand;
				for (const [good, demand] of Object.entries(cumulativeDemand)) {
					const key = good as keyof Goods;
					const available = purchasedBySector?.[node.sectorName]?.[key] ?? colonyGoods[key] ?? 0;
					if (demand > 0 && available < demand * 1e-9) {
						return false;
					}
				}
				return true;
			});

			if (readySectors.length === 0) break;

			const nonCumulativeDemands = new Map<string, Partial<Record<keyof Goods, number>>>();
			for (const node of readySectors) {
				nonCumulativeDemands.set(node.sectorName, { ...node.idealNonCumulativeDemand });
			}

			const poolSnapshot: Record<keyof Goods, number> = { ...flowPool } as Record<keyof Goods, number>;

			for (const node of readySectors) {
				const demand = nonCumulativeDemands.get(node.sectorName)!;
				let flowScale = 1;

				const nonEssentialGoods = node.bid.nonEssentialGoods ?? new Set<keyof Goods>();

				for (const [good, required] of Object.entries(demand)) {
					const key = good as keyof Goods;
					// Skip non-essential goods from flowScale - they apply penalty later instead of stopping production
					if (nonEssentialGoods.has(key)) continue;
					if (required > 0) {
						const available = poolSnapshot[key] ?? 0;
						const ratio = available / required;
						flowScale = Math.min(flowScale, ratio);
					}
				}

				flowScale = Math.min(1, Math.max(0, flowScale));

				if (flowScale <= 1e-9) {
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
					executedInSCC.add(node.sectorName);
					executedSectors.add(node.sectorName);
					hasProgress = true;
					continue;
				}

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

				// Apply non-essential goods penalty: 10% per missing non-essential good, capped at 50%
				let missingNonEssentialNames: string[] = [];
				if (nonEssentialGoods.size > 0) {
					let missingNonEssential = 0;
					for (const [goodKey, demandPerTick] of Object.entries(node.bid.idealGoodsDemand)) {
						const key = goodKey as keyof Goods;
						if (nonEssentialGoods.has(key)) {
							const available = purchasedBySector?.[node.sectorName]?.[key] ?? colonyGoods[key] ?? 0;
							if (available <= 0) {
								missingNonEssential++;
								missingNonEssentialNames.push(String(key));
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
					executedInSCC.add(node.sectorName);
					executedSectors.add(node.sectorName);
					hasProgress = true;
					continue;
				}

				// Deduct non-cumulative goods from flow pool using finalScale
				for (const [good, required] of Object.entries(demand)) {
					const key = good as keyof Goods;
					const consumed = required * finalScale;
					flowPool[key] = (flowPool[key] ?? 0) - consumed;
				}

				const effectiveScale = node.bid.actualScale * finalScale;

				// Build stop reason including non-essential goods missing
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

				sectorResults[node.sectorName] = result.result;
				sectorProfits[node.sectorName] = result.profit;
				sectorRevenue[node.sectorName] = 0; // Revenue from population sales added later
				sectorLaborCosts[node.sectorName] = result.laborCosts;
				sectorInputCosts[node.sectorName] = result.inputCosts;
				sectorUtilization[node.sectorName] = effectiveScale;
				sectorStopReason[node.sectorName] = stopReason;
				executedInSCC.add(node.sectorName);
				executedSectors.add(node.sectorName);
				hasProgress = true;

				for (const [good, produced] of Object.entries(result.result.producedGoods)) {
					const key = good as keyof Goods;
					if (NON_CUMULATING_GOODS.has(key)) {
						flowPool[key] = (flowPool[key] ?? 0) + produced;
					}
					const nextProd = (sumGoodsProduction[key] ?? 0) + produced;
					sumGoodsProduction[key] = nextProd;
				}

				for (const [good, consumed] of Object.entries(result.result.consumedGoods)) {
					const key = good as keyof Goods;
					const nextReq = (sumGoodsRequirements[key] ?? 0) + consumed;
					sumGoodsRequirements[key] = nextReq;
				}
			}

			const remainingInSCC = scc.filter(n => !executedInSCC.has(n.sectorName));
			executableSectors.length = 0;
			executableSectors.push(...remainingInSCC);
		}

		if (isCyclic || isBlocked) {
			for (const node of scc) {
				if (executedInSCC.has(node.sectorName)) continue;

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
				sectorStopReason[node.sectorName] = result.stopReason;
				executedInSCC.add(node.sectorName);
				executedSectors.add(node.sectorName);
			}
		}
	}

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