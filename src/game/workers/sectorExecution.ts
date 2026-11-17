import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import type { SectorBid } from "./SectorBid";
import type { SectorExecutionResult } from "./SectorExecutionResult";
import type { SectorResult } from "../systems/generateIndustrialSector";

const EMPTY_WAREHOUSE = createEmptyWarehouse();

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);

export function applyGoodConstraint(
	currentConstraint: number,
	goodKey: keyof Goods,
	demandPerTick: number,
	goodsMarketRatios: Record<keyof Goods, number>,
	sectorInventory: Goods,
	isNonEssential: boolean
): number {
	// Validate inputs
	if(!Number.isFinite(currentConstraint) || currentConstraint < 0) {
		throw new Error(`Invalid currentConstraint for ${goodKey}: ${currentConstraint}`);
	}
	if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
		throw new Error(`Invalid demandPerTick for ${goodKey}: ${demandPerTick}`);
	}
	const ratio = goodsMarketRatios[goodKey] ?? 1;
	if(!Number.isFinite(ratio) || ratio < 0) {
		throw new Error(`Invalid market ratio for ${goodKey}: ${ratio}`);
	}
	const available = sectorInventory[goodKey] ?? 0;
	if(!Number.isFinite(available) || available < 0) {
		throw new Error(`Invalid sector inventory for ${goodKey}: ${available}`);
	}

	// Market constraint from goods availability
	const marketConstraint = isNonEssential
		? Math.min(currentConstraint, 0.5 + 0.75 * ratio)
		: Math.min(currentConstraint, ratio);

	// Sector inventory constraint: hard cap — can't consume more than available
	const maxScaleFromInventory = demandPerTick > 0 ? available / demandPerTick : 1;
	const inventoryConstraint = maxScaleFromInventory;

	const result = Math.min(marketConstraint, inventoryConstraint);
	if(!Number.isFinite(result) || result < 0) {
		throw new Error(`Invalid constraint result for ${goodKey}: ${result}`);
	}
	return result;
}

/**
 * Executes sector production given pre-allocated labor and purchased inputs.
 *
 * Labor allocation contract:
 * - If `laborAllocations` is provided, it represents the MAXIMUM available workers
 *   per sector and population category (a ceiling).
 * - Actual employment equals the sector's scaled demand (idealWorkerDemand * finalScale),
 *   which must not exceed the allocation. Unused allocation capacity remains available.
 * - If `laborAllocations` is omitted, workers are drawn sequentially from `remainingWorkers`.
 * - Global validation ensures total allocations never exceed available population.
 *
 * Purchase reconciliation contract:
 * - If `purchasedBySector` is provided, it represents inputs already bought.
 * - Actual consumption = idealGoodsDemand * finalScale.
 * - The caller MUST reconcile purchased vs consumed inputs, returning unused goods to
 *   inventory and refunding unused purchase cost to sector money.
 *
 * Input validation:
 * - All prices, salaries, inventory, and ratios must be finite and nonnegative.
 * - `actualScale` must be in [0, 1].
 * - Aggregate production/consumption totals are checked for finiteness.
 */
export function executeSectors(
	sectorBids: SectorBid[],
	population: Population,
	// inputSectorGoods: Record<keyof IndustrialSectors, Goods>,
	colonyGoods: Goods,
	prices: Record<keyof Goods, number>,
	salaries: Record<keyof Population, number>,
	laborAllocations?: Record<string, Partial<Record<keyof Population, number>>>,
	purchasedBySector?: Record<string, Partial<Record<keyof Goods, number>>>,
): SectorExecutionResult {
	const sumGoodsRequirements = { ...EMPTY_WAREHOUSE };
	const sumGoodsProduction = { ...EMPTY_WAREHOUSE };
	const workingWorkers = createStarterPopulation(0);
	const remainingWorkers: Record<keyof Population, PopulationBreakdown> = createStarterPopulation(0);
	for(const key of Object.keys(population) as (keyof Population)[]) {
		remainingWorkers[key] = { ...population[key] };
	}

	// Validate labor allocations globally before sector execution.
	// Ensures no population category is over-allocated regardless of sector order.
	if(laborAllocations) {
		for(const key of Object.keys(population) as (keyof Population)[]) {
			let totalAllocated = 0;
			for(const bid of sectorBids) {
				const alloc = laborAllocations[bid.name]?.[key] ?? 0;
				if(!Number.isFinite(alloc) || alloc < 0) {
					throw new Error(`Invalid labor allocation for ${bid.name}/${key}: ${alloc}`);
				}
				totalAllocated += alloc;
			}
			if(totalAllocated > population[key].number + 1e-9) {
				throw new Error(
					`Labor overallocated for ${key}: total allocated ${totalAllocated}, available ${population[key].number}`,
				);
			}
		}
	}

	const sectorResults: Record<string, SectorResult> = {};
	const sectorProfits: Record<string, number> = {};
	const sectorRevenue: Record<string, number> = {};
	const sectorLaborCosts: Record<string, number> = {};
	const sectorInputCosts: Record<string, number> = {};
	const sectorUtilization: Record<string, number> = {};

	// const sectorGoods: Record<keyof IndustrialSectors, Goods> = { ...inputSectorGoods };

	const sectorStopReason: Record<string, string> = {};

	for(const bid of sectorBids) {
		const actualScale = bid.actualScale;

		// Validate actualScale before material scaling
		if(
			!Number.isFinite(actualScale) ||
			actualScale < 0 ||
			actualScale > 1
		) {
			throw new Error(`Invalid actualScale for ${bid.name}: ${actualScale}`);
		}

		// If scale is zero, sector produces/consumes nothing. Skip material/labor
		// ratio calculations and return zero-result early.
		if(actualScale <= 0) {
			sectorResults[bid.name] = {
				name: bid.name,
				consumedGoods: {},
				producedGoods: {},
				workersEmployed: {},
				productionRatio: 0,
				inputLevel: bid.inputLevel,
				outputLevel: bid.outputLevel,
			};
			sectorProfits[bid.name] = 0;
			sectorRevenue[bid.name] = 0;
			sectorLaborCosts[bid.name] = 0;
			sectorInputCosts[bid.name] = 0;
			sectorUtilization[bid.name] = 0;
			sectorStopReason[bid.name] = bid.budgetRatio <= 0 ? "No money" : "Bottlenecked";
			continue;
		}

		// Compute material ratio: what fraction of the sector's input demand can
		// actually be met at this scale. finalScale = actualScale * materialRatio.
		let materialRatio = 1;
		const sectorPurchases = purchasedBySector?.[bid.name];

		for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
			if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
				throw new Error(`Invalid input demand for ${bid.name}/${goodKey}`);
			}
			if(demandPerTick === 0) continue;

			const key = goodKey as keyof Goods;
			const scaleForMaterial = actualScale > 0 ? actualScale : 1;
			const required = demandPerTick * scaleForMaterial;

			if(!Number.isFinite(required)) {
				throw new Error(`Input requirement overflow for ${bid.name}/${goodKey}`);
			}

			let available: number;
			if(sectorPurchases) {
				available = sectorPurchases[key] ?? 0;
			} else {
				available = colonyGoods[goodKey as keyof Goods] ?? 0;
			}

			if(!Number.isFinite(available) || available < 0) {
				throw new Error(`Invalid available input for ${bid.name}/${goodKey}`);
			}

			const ratio = required > 0
				? Math.min(1, available / required)
				: 1;

			materialRatio = Math.min(materialRatio, ratio);
		}

		// Worker availability: use centralized labor allocation when provided,
		// otherwise fall back to remaining workers for the stop-reason diagnostic.
		let workerRatio = 1;
		const sectorLaborAllocation = laborAllocations?.[bid.name];
		for(const [key, demandPerTick] of Object.entries(bid.idealWorkerDemand)) {
			if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
				throw new Error(`Invalid worker demand for ${bid.name}/${key}`);
			}
			if(demandPerTick === 0 || actualScale === 0) continue;

			const popType = key as keyof Population;
			const required = demandPerTick * actualScale;

			if(!Number.isFinite(required)) {
				throw new Error(`Worker requirement overflow for ${bid.name}/${popType}`);
			}

			let available: number;
			if(sectorLaborAllocation) {
				available = sectorLaborAllocation[popType] ?? 0;
			} else {
				available = remainingWorkers[popType].number;
			}

			if(!Number.isFinite(available) || available < 0) {
				throw new Error(`Invalid available labor for ${bid.name}/${popType}`);
			}

			workerRatio = Math.min(workerRatio, Math.min(1, available / required));
		}

		// Apply both material and labor constraints to actualScale.
		const constrainedScale = actualScale * Math.min(materialRatio, workerRatio);
		const finalScale = Math.max(0, Math.min(actualScale, constrainedScale));

		// Determine stop reason based on the most restrictive resource constraint.
		let stopReason = "";
		if(finalScale <= 0) {
			if(bid.budgetRatio <= 0) stopReason = "No money";
			else if(workerRatio <= 0) stopReason = "No workers";
			else if(materialRatio <= 0) stopReason = "No materials";
			else stopReason = "Bottlenecked";


			// Zero scale: sector produces/consumes nothing.
			sectorResults[bid.name] = {
				name: bid.name,
				consumedGoods: {},
				producedGoods: {},
				workersEmployed: {},
				productionRatio: 0,
				inputLevel: bid.inputLevel,
				outputLevel: bid.outputLevel,
			};
			sectorProfits[bid.name] = 0;
			sectorRevenue[bid.name] = 0;
			sectorLaborCosts[bid.name] = 0;
			sectorInputCosts[bid.name] = 0;
			sectorUtilization[bid.name] = 0;
			sectorStopReason[bid.name] = stopReason;
			continue;
		} else if(materialRatio < 1 && materialRatio < workerRatio) {
			stopReason = "Material shortage";
		} else if(workerRatio < 1 && workerRatio <= materialRatio) {
			stopReason = "Worker shortage";
		} else if(bid.budgetRatio < 1 && bid.budgetRatio <= finalScale) {
			stopReason = "Low budget";
		}
		sectorStopReason[bid.name] = stopReason;

		const workersEmployed: Partial<Record<keyof Population, number>> = {};
		for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
			const demanded = value * finalScale;
			let employed: number;
			if(sectorLaborAllocation) {
				// Use pre-allocated labor (order-independent)
				const alloc = sectorLaborAllocation[key as keyof Population] ?? 0;

				if(!Number.isFinite(alloc) || alloc < 0) {
					throw new Error(
						`Invalid labor allocation for ${bid.name}, ${key}: ${alloc}`,
					);
				}

				// If labor allocations are authoritative, every demanded worker
				// must be allocated. Producing goods without the required labor
				// would violate the model.
				if(alloc + 1e-9 < demanded) {
					throw new Error(
						`Labor allocation insufficient for ${bid.name}, ${key}: ` +
						`allocated ${alloc}, required ${demanded}`,
					);
				}

				employed = demanded;
			} else {
				// Sequential depletion (original behavior)
				const available = remainingWorkers[key as keyof Population].number;
				employed = Math.min(demanded, Math.max(0, available));
			}
			// Always deduct employed workers from remaining (works for both allocation paths)
			const available = remainingWorkers[key as keyof Population].number;
			if(employed > available + 1e-9) {
				throw new Error(
					`Worker allocation exceeds available population for ${bid.name}/${key}`,
				);
			}
			remainingWorkers[key as keyof Population] = {
				...remainingWorkers[key as keyof Population],
				number: available - employed,
			};
			workersEmployed[key as keyof Population] = employed;
			workingWorkers[key as keyof Population] = {
				...workingWorkers[key as keyof Population],
				number: workingWorkers[key as keyof Population].number + employed,
			};
		}

		// const sectorInventory = { ...(sectorGoods[bid.name as keyof IndustrialSectors] ?? EMPTY_WAREHOUSE) };
		const consumedGoods: Partial<Goods> = {};
		for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
			const consumed = value * finalScale;
			consumedGoods[key as keyof Goods] = consumed;
			// sectorInventory[key as keyof Goods] = Math.max(0, (sectorInventory[key as keyof Goods] ?? 0) - consumed);
			const nextReq = (sumGoodsRequirements[key as keyof Goods] ?? 0) + consumed;
			if(!Number.isFinite(nextReq) || nextReq < 0) {
				throw new Error(`Invalid aggregate input quantity for ${key}: ${nextReq}`);
			}
			sumGoodsRequirements[key as keyof Goods] = nextReq;
		}

		const producedGoods: Partial<Goods> = {};
		for(const [key, value] of Object.entries(bid.idealGoodsProduction)) {
			const produced = value * finalScale;
			producedGoods[key as keyof Goods] = produced;
			// sectorInventory[key as keyof Goods] = (sectorInventory[key as keyof Goods] ?? 0) + produced;
			const nextProd = (sumGoodsProduction[key as keyof Goods] ?? 0) + produced;
			if(!Number.isFinite(nextProd) || nextProd < 0) {
				throw new Error(`Invalid aggregate production quantity for ${key}: ${nextProd}`);
			}
			sumGoodsProduction[key as keyof Goods] = nextProd;
		}

		// sectorGoods[bid.name as keyof IndustrialSectors] = sectorInventory;

		// Revenue comes from actual sales (allocatePopulationSales), not from production volume.
		// Unsold goods generate no revenue.
		// Validate prices and salaries before computing costs.
		for(const key of Object.keys(consumedGoods) as (keyof Goods)[]) {
			const price = prices[key];
			if(!Number.isFinite(price) || price < 0) {
				throw new Error(`Invalid price for ${key}: ${price}`);
			}
		}
		for(const key of Object.keys(workersEmployed) as (keyof Population)[]) {
			const salary = salaries[key];
			if(!Number.isFinite(salary) || salary < 0) {
				throw new Error(`Invalid salary for ${key}: ${salary}`);
			}
		}

		const inputCosts = Object.entries(consumedGoods).reduce((sum, [key, amount]) => {
			return sum + (amount) * prices[key as keyof Goods];
		}, 0);
		const laborCosts = Object.entries(workersEmployed).reduce((sum, [key, amount]) => {
			return sum + (amount) * salaries[key as keyof Population];
		}, 0);

		if(!Number.isFinite(inputCosts) || inputCosts < 0) {
			throw new Error(`Invalid input costs for ${bid.name}: ${inputCosts}`);
		}
		if(!Number.isFinite(laborCosts) || laborCosts < 0) {
			throw new Error(`Invalid labor costs for ${bid.name}: ${laborCosts}`);
		}

		sectorResults[bid.name] = {
			name: bid.name,
			consumedGoods,
			producedGoods,
			workersEmployed,
			productionRatio: finalScale,
			inputLevel: bid.inputLevel,
			outputLevel: bid.outputLevel,
		};
		// Profit starts as negative costs; revenue from population sales is added later in industryTick.worker.ts
		sectorProfits[bid.name] = -(inputCosts + laborCosts);
		sectorRevenue[bid.name] = 0;
		sectorLaborCosts[bid.name] = laborCosts;
		sectorInputCosts[bid.name] = inputCosts;
		sectorUtilization[bid.name] = finalScale;
	}

	// Finalize always-working sectors (stayAtHome)
	for(const key of alwaysWorking) {
		const key2 = key as keyof Population;
		workingWorkers[key2] = {
			...workingWorkers[key2],
			number: population[key2].number
		};
		remainingWorkers[key as keyof Population] = {
			...remainingWorkers[key2],
			number: 0
		};
	}

	return {
		sectorResults,
		sectorProfits,
		sectorRevenue,
		sectorLaborCosts,
		sectorInputCosts,
		sectorUtilization,
		sectorStopReason,
		populationProfits: {},
		workingWorkers,
		remainingWorkers,
		// sectorGoods,
		sumGoodsRequirements,
		sumGoodsProduction,
	};
};
