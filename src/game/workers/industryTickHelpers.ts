import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { getGoodRequirementsAndQoL, getRequirementsForQol } from "../data/Population";
import { populationGrowth } from "../data/populationHelpers";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickResult } from "./IndustryTickResult";
import type { SectorBid } from "./SectorBid";

/**
 * Records the source of each unit purchased by a sector.
 * warehouse: units purchased from opening warehouse inventory
 * producers: units purchased from specific producing sectors
 */
export type InputSourceAllocation = {
	warehouse: number;
	producers: Record<string, number>;
};

/**
 * Purchase provenance for each sector and good.
 * Also tracks the warehouse composition by producer for attribution.
 */
export type PurchaseProvenance = Record<
	string,
	Partial<Record<keyof Goods, InputSourceAllocation>>
>;

/**
 * Per-buyer, per-seller breakdown of input purchase payments.
 * Used for accurate ledger recording.
 */
export type InputPaymentBreakdown = Record<
	string, // consuming sector
	Record<string, number> // producing sector -> amount paid (including "colony_treasury" for warehouse)
>;

const qolSmoothing = 0.03;
const expectedQolSmoothing = 0.03;
const maxDailyChangeSmoothing = 0.001;

const extraRequirements = {
    student: { education: 1 },
    retired: { healthcare: 2 }
} as Readonly<Record<keyof Population, Partial<Goods>>>;

export function computePopulationConsumption(
	population: Population,
	adjustedSalaries: Record<keyof Population, number>,
	prices: Record<keyof Goods, number>,
): {
	populationConsumption: Partial<Goods>;
	desiredConsumptionByPop: Record<keyof Population, Partial<Goods>>;
	requirementsByPop: Record<keyof Population, Record<keyof Goods, number>>;
	populationUpdates: IndustryTickResult["populationUpdates"];
} {
	// Validate prices before any computation.
	for(const [good, price] of Object.entries(prices)) {
		if(!Number.isFinite(price) || price < 0) {
			throw new Error(`Invalid price for ${good}: ${price}`);
		}
	}

	// Validate adjustedSalaries before any computation.
	for(const key of Object.keys(population) as (keyof Population)[]) {
		const salary = adjustedSalaries[key];
		if(!Number.isFinite(salary) || salary < 0) {
			throw new Error(`Invalid adjusted salary for ${key}: ${salary}`);
		}
	}

	const populationConsumption: Partial<Goods> = {};
    const desiredConsumptionByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>;
    const requirementsByPop: Record<keyof Population, Record<keyof Goods, number>> = {} as Record<keyof Population, Record<keyof Goods, number>>;
    const populationUpdates = {} as IndustryTickResult["populationUpdates"];

    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        if(
            !Number.isFinite(pop.number) ||
            pop.number < 0 ||
            !Number.isFinite(pop.wealth) ||
            pop.wealth < 0 ||
            !Number.isFinite(pop.qol) ||
            !Number.isFinite(pop.birthRate) ||
            pop.birthRate < 0
        ) {
            throw new Error(`Invalid population data for ${key}`);
        }

        if(
            pop.expectedQol !== undefined &&
            !Number.isFinite(pop.expectedQol)
        ) {
            throw new Error(`Invalid expected QoL for ${key}`);
        }

        const { qol: targetQol } = getGoodRequirementsAndQoL(
            adjustedSalaries[key],
            prices,
            pop
        );

        if(!Number.isFinite(targetQol)) {
            throw new Error(`Invalid target QoL for ${key}`);
        }

        const smoothedQol = Math.max(0, Math.min(80, pop.qol + (targetQol - pop.qol) * qolSmoothing));
        const requirements = getRequirementsForQol(smoothedQol, pop.number);

        const extra = extraRequirements[key];
        if(extra) {
            for(const [good, amount] of Object.entries(extra)) {
                requirements[good as keyof Goods] = (requirements[good as keyof Goods] ?? 0) + amount * pop.number;
            }
        }

        for(const [goodKey, amount] of Object.entries(requirements)) {
            const gKey = goodKey as keyof Goods;
            if(!Number.isFinite(amount) || amount < 0) {
                throw new Error(`Invalid requirement for ${key}/${gKey}: ${amount}`);
            }
        }

        const desired: Partial<Goods> = {};

        for(const [goodKey, amount] of Object.entries(requirements)) {
            const good = goodKey as keyof Goods;
            populationConsumption[good] = (populationConsumption[good] ?? 0) + amount;
            desired[good] = amount;
        }

        desiredConsumptionByPop[key] = desired;

        requirementsByPop[key] = requirements;

        const expectedQol = (pop.expectedQol ?? smoothedQol) + (smoothedQol - (pop.expectedQol ?? smoothedQol)) * expectedQolSmoothing;

        if(!Number.isFinite(expectedQol)) {
            throw new Error(`Invalid expected QoL for ${key}: ${expectedQol}`);
        }

        const rawPopulationChange = populationGrowth(expectedQol) * pop.number / 365 * pop.birthRate;

        if(!Number.isFinite(rawPopulationChange)) {
            throw new Error(`Invalid population change for ${key}`);
        }

        const maxDailyChange = pop.number * maxDailyChangeSmoothing;
        const clampedPopulationChange = Math.max(-maxDailyChange, Math.min(maxDailyChange, rawPopulationChange));
        const clampedPopulationNumber = Math.max(0, pop.number + clampedPopulationChange);

        populationUpdates[key] = {
            qol: smoothedQol,
            expectedQol,
            populationChange: clampedPopulationChange,
            wealth: pop.wealth, // Not yet settled; will be updated after wage settlement
            number: clampedPopulationNumber,
            requirements: requirements as Record<string, number>,
        };
    }

    return { populationConsumption, desiredConsumptionByPop, requirementsByPop, populationUpdates };
}

export function buySectorInputs(
    sectorBids: SectorBid[],
    goods: Goods,
    newMoney: Record<string, number>,
    prices: Record<keyof Goods, number>,
    goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>>,
    // Optional: composition of warehouse by producer (good -> producer -> quantity).
    // If not provided, all attributed to "colony_treasury" (opening inventory).
    warehouseComposition?: Partial<Record<keyof Goods, Record<string, number>>>
): { colonyGoodsAfterPurchase: Goods; newMoney: Record<string, number>; purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>>; purchaseProvenance: PurchaseProvenance } {
    const colonyGoodsAfterPurchase = { ...goods };
    const updatedMoney = { ...newMoney };
    const purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};
    const purchaseProvenance: PurchaseProvenance = {};

    const validGoods = new Set(Object.keys(goods));
    const seenSectors = new Set<string>();

    // Validate starting inventory.
    for(const [good, amount] of Object.entries(goods)) {
        if(!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Invalid starting inventory for ${good}: ${amount}`);
        }
    }

    // Preflight: validate allocation completeness.
    // The allocator contract is expected to return explicit entries for every
    // sector and demanded good (including zeros). Missing entries are not
    // silently treated as zero — they are a contract violation.
    for(const bid of sectorBids) {
        const sectorName = bid.name;

        if(!Object.hasOwn(goodsAllocations, sectorName)) {
            throw new Error(`Missing goods allocation for ${sectorName}`);
        }

        const allocation = goodsAllocations[sectorName];

        for(const goodName of Object.keys(bid.idealGoodsDemand)) {
            if(!validGoods.has(goodName)) {
                throw new Error(`Unknown input good: ${goodName}`);
            }

            const key = goodName as keyof Goods;

            if(!Object.hasOwn(allocation, key)) {
                throw new Error(`Missing goods allocation for ${sectorName}/${key}`);
            }

            const allocated = allocation[key] ?? 0;
            if(!Number.isFinite(allocated) || allocated < 0) {
                throw new Error(`Invalid allocation for ${sectorName}/${key}`);
            }
        }
    }

    for(const bid of sectorBids) {
        const sectorName = bid.name;

        if(!sectorName || seenSectors.has(sectorName)) {
            throw new Error(`Invalid or duplicate sector: ${sectorName}`);
        }
        seenSectors.add(sectorName);

        const allocation = goodsAllocations[sectorName];

        let sectorMoney = updatedMoney[sectorName] ?? 0;

        if(!Number.isFinite(sectorMoney) || sectorMoney < 0) {
            throw new Error(`Invalid cash balance for ${sectorName}`);
        }

        if(!Number.isFinite(bid.actualScale) || bid.actualScale < 0 || bid.actualScale > 1 + 1e-9) {
            throw new Error(`Invalid actualScale for ${sectorName}: ${bid.actualScale}`);
        }

        purchasedBySector[sectorName] = {};
        purchaseProvenance[sectorName] = {};

        for(const [goodName, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
            if(!validGoods.has(goodName)) {
                throw new Error(`Unknown input good: ${goodName}`);
            }

            if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
                throw new Error(`Invalid demand for ${sectorName}/${goodName}`);
            }

            const key = goodName as keyof Goods;
            const allocated = allocation[key] ?? 0;
            const available = colonyGoodsAfterPurchase[key] ?? 0;
            const price = prices[key];

            if(!Number.isFinite(allocated) || allocated < 0) {
                throw new Error(`Invalid allocation for ${sectorName}/${goodName}`);
            }

            if(!Number.isFinite(available) || available < 0) {
                throw new Error(`Invalid inventory for ${goodName}`);
            }

            if(!Number.isFinite(price) || price < 0) {
                throw new Error(`Invalid price for ${goodName}`);
            }

            const idealDemand = demandPerTick * bid.actualScale;

            if(!Number.isFinite(idealDemand)) {
                throw new Error(`Demand overflow for ${sectorName}/${goodName}`);
            }

            const demand = Math.min(idealDemand, allocated);

            if(demand <= 0 || available <= 0) continue;

            const affordableQuantity = price === 0
                ? available
                : sectorMoney / price;

            let toBuy = Math.min(
                demand,
                available,
                affordableQuantity,
            );

            if(!Number.isFinite(toBuy) || toBuy < 0) {
                throw new Error(`Invalid purchase quantity for ${sectorName}/${goodName}`);
            }

            if(toBuy <= 0) continue;

            let cost = toBuy * price;

            if(!Number.isFinite(cost)) {
                throw new Error(`Purchase cost overflow for ${sectorName}/${goodName}`);
            }

            // Correct only floating-point overshoot; throw on material overspending.
            if(cost > sectorMoney) {
                const excess = cost - sectorMoney;
                const tolerance = 1e-9 * Math.max(1, sectorMoney);

                if(excess > tolerance) {
                    throw new Error(`${sectorName} cannot afford ${goodName}`);
                }

                toBuy = price === 0 ? toBuy : sectorMoney / price;
                cost = toBuy * price;
            }

            sectorMoney = Math.max(0, sectorMoney - cost);

            colonyGoodsAfterPurchase[key] = Math.max(
                0,
                available - toBuy,
            );

            purchasedBySector[sectorName][key] = toBuy;

            // Attribute purchase to producers based on warehouse composition.
            const composition = warehouseComposition?.[key] ?? { "colony_treasury": available };
            const totalInWarehouse = Object.values(composition).reduce((sum, v) => sum + v, 0);
            const producers: Record<string, number> = {};
            let warehousePortion = 0;

            if(totalInWarehouse > 0) {
                for(const [producer, qty] of Object.entries(composition)) {
                    const share = qty / totalInWarehouse;
                    const attributed = toBuy * share;
                    if(producer === "colony_treasury") {
                        warehousePortion = attributed;
                    } else {
                        producers[producer] = attributed;
                    }
                }
            } else {
                // Fallback: no warehouse composition known, attribute all to treasury
                warehousePortion = toBuy;
            }

            purchaseProvenance[sectorName][key] = {
                warehouse: warehousePortion,
                producers,
            };
        }

        updatedMoney[sectorName] = sectorMoney;
    }

    return {
        colonyGoodsAfterPurchase,
        newMoney: updatedMoney,
        purchasedBySector,
        purchaseProvenance,
    };
}

export function reconcileSectorInputs(
	purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>>,
	consumedBySector: Record<string, Partial<Record<keyof Goods, number>>>,
	prices: Record<keyof Goods, number>,
	colonyGoods: Goods,
	sectorMoney: Record<string, number>,
): {
	goods: Goods;
	money: Record<string, number>;
	returnedBySector: Record<string, Partial<Record<keyof Goods, number>>>;
	refundedBySector: Record<string, number>;
} {
	const returnedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};

	const refundedBySector: Record<string, number> = {};

	const updatedGoods = { ...colonyGoods };
	const updatedMoney = { ...sectorMoney };

	for(const [sector, purchases] of Object.entries(purchasedBySector)) {
		const consumed = consumedBySector[sector] ?? {};
		returnedBySector[sector] = {};

		let refund = 0;

		// Iterate over union of purchased and consumed goods to catch consumption of unpurchased goods
		const allGoods = new Set<keyof Goods>([
			...Object.keys(purchases) as (keyof Goods)[],
			...Object.keys(consumed) as (keyof Goods)[],
		]);

		for(const good of allGoods) {
			const purchased = purchases[good] ?? 0;
			const used = consumed[good] ?? 0;

			if(
				!Number.isFinite(purchased) ||
				purchased < 0 ||
				!Number.isFinite(used) ||
				used < 0 ||
				used > purchased + 1e-6
			) {
				throw new Error(
					`Invalid input reconciliation: ${sector}/${good} purchased=${purchased}, used=${used}`
				);
			}

			const price = prices[good];
			if(!Number.isFinite(price) || price < 0) {
				throw new Error(`Invalid price for ${good}: ${price}`);
			}

			const returned = Math.max(0, purchased - used);

			returnedBySector[sector][good] = returned;
			updatedGoods[good] = (updatedGoods[good] ?? 0) + returned;

			refund += returned * price;
		}

		if(!Number.isFinite(refund)) {
			throw new Error(`Invalid input refund for ${sector}`);
		}

		updatedMoney[sector] = (updatedMoney[sector] ?? 0) + refund;
		refundedBySector[sector] = refund;

		// Validate updated money balance
		if(!Number.isFinite(updatedMoney[sector]) || updatedMoney[sector] < 0) {
			throw new Error(`Invalid updated money for ${sector}: ${updatedMoney[sector]}`);
		}
	}

	// Validate all updated goods are finite and nonnegative
	for(const [good, amount] of Object.entries(updatedGoods)) {
		if(!Number.isFinite(amount) || amount < 0) {
			throw new Error(`Invalid updated goods for ${good}: ${amount}`);
		}
	}

	return {
		goods: updatedGoods,
		money: updatedMoney,
		returnedBySector,
		refundedBySector,
	};
}

export function computeColonyGoodsDelta(
	openingGoods: Goods,
	goodsAfterInputSettlement: Goods,
	activeSectors: Iterable<keyof IndustrialSectors>,
	sectorResults: Record<string, { productionRatio: number; producedGoods: Record<string, number> }>,
): Partial<Goods> {
	// Contract: goodsAfterInputSettlement must reflect inventory AFTER all input
	// purchases have been reconciled (unused purchases returned, refunds issued).
	// This function then adds sector production to compute the net delta.
	//
	// Returns netInventoryDelta:
	//   - Sector input consumption (negative)
	//   - Returned unused inputs (positive)
	//   - Current-tick production (positive)
	// Should not be used as a gross production or consumption figure.
	const netInventoryDelta: Partial<Goods> = createEmptyWarehouse();

	// Use canonical goods keys from the type to avoid missing keys.
	const goodsKeys = Object.keys(openingGoods) as (keyof Goods)[];

	for(const key of goodsKeys) {
		const before = openingGoods[key] ?? 0;
		const after = goodsAfterInputSettlement[key] ?? 0;

		if(
			!Number.isFinite(before) || before < 0 ||
			!Number.isFinite(after) || after < 0
		) {
			throw new Error(`Invalid inventory while computing delta: ${key}`);
		}

		netInventoryDelta[key] = after - before;
	}

	for(const name of activeSectors) {
		const sectorResult = sectorResults[name];
		// Some sectors legitimately have no result (e.g., stopped production,
		// insufficient budget). Skip them — they contribute nothing to the delta.
		if(!sectorResult) continue;

		if(
			!Number.isFinite(sectorResult.productionRatio) ||
			sectorResult.productionRatio < 0 ||
			sectorResult.productionRatio > 1 + 1e-9
		) {
			throw new Error(
				`Invalid production ratio for ${name}: ${sectorResult.productionRatio}`,
			);
		}

		for(const [goodKey, amount] of Object.entries(sectorResult.producedGoods)) {
			const key = goodKey as keyof Goods;

			if(!Object.hasOwn(openingGoods, key)) {
				throw new Error(`Unknown produced good: ${name}/${key}`);
			}

			const qty = amount ?? 0;

			if(!Number.isFinite(qty) || qty < 0) {
				throw new Error(`Invalid production quantity for ${name}/${key}`);
			}

			if(sectorResult.productionRatio === 0 && qty > 1e-9) {
				throw new Error(`Sector ${name} produced goods at zero production scale`);
			}

			netInventoryDelta[key] = (netInventoryDelta[key] ?? 0) + qty;
		}
	}

	return netInventoryDelta;
}

export function applyGoodsModifier(
    goods: Record<keyof Goods, number>,
    deltas: Record<string, number>,
    modifier: (current: number, delta: number) => number,
): void {
    for(const key in deltas) {
        if(!Object.hasOwn(goods, key)) {
            throw new Error(`Unknown good in modifier: ${key}`);
        }

        const delta = deltas[key];

        if(!Number.isFinite(delta)) {
            throw new Error(`Invalid modifier delta for ${key}`);
        }

        const current = goods[key as keyof Goods] ?? 0;
        const result = modifier(current, delta);

        if(!Number.isFinite(result) || result < 0) {
            throw new Error(`Invalid modified inventory for ${key}`);
        }

        goods[key as keyof Goods] = result;
    }
}

export function pruneMemory<T>(
    memory: Map<string, T>,
    activeEntityIds: Set<string>,
): void {
    for(const entityId of memory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            memory.delete(entityId);
        }
    }
}
export function computeMarketRatios<TKey extends string | number | symbol>(
	demands: Record<TKey, number>,
	available: Record<TKey, number>,
): Record<TKey, number> {
	const ratios = {} as Record<TKey, number>;

	// Validate all availability keys for finiteness and non-negativity.
	for(const key of Object.keys(available) as TKey[]) {
		const supply = available[key];
		if(!Number.isFinite(supply) || supply < 0) {
			throw new Error(`Invalid availability for ${String(key)}`);
		}
	}

	for(const key of Object.keys(demands) as TKey[]) {
		const demand = demands[key];
		const supply = available[key] ?? 0;

		if(!Number.isFinite(demand) || demand < 0) {
			throw new Error(`Invalid demand for ${String(key)}`);
		}

		if(!Number.isFinite(supply) || supply < 0) {
			throw new Error(`Invalid availability for ${String(key)}`);
		}

		ratios[key] = demand > 0
			? Math.min(1, supply / demand)
			: 1;
	}

	return ratios;
}
export function trySetPatchField<T>(
    patch: any,
    field: string,
    lastVal: T | undefined,
    newVal: T,
    diffFn: (a: T | undefined, b: T) => any
): boolean {
    const diff = diffFn(lastVal, newVal);
    if(diff) {
        patch[field] = diff;
        return true;
    }
    return false;
}

/**
 * Distributes sector-to-sector input purchase revenue to producing sectors
 * using actual purchase provenance.
 * 
 * @param sectorResults - Results from executeSectors with consumedGoods per sector
 * @param prices - Current prices for each good
 * @param sectorInputCosts - Actual input costs per sector (from reconciliation)
 * @param purchaseProvenance - Actual source of each purchase (warehouse vs producers)
 * @returns { sectorRevenue: revenue per sector, treasuryRevenue: total to treasury, paymentBreakdown: per-buyer per-seller breakdown }
 */
export function distributeSectorInputRevenue(
	sectorResults: Record<string, { consumedGoods: Record<string, number> }>,
	prices: Record<keyof Goods, number>,
	sectorInputCosts: Record<string, number>,
	purchaseProvenance: PurchaseProvenance
): { sectorRevenue: Record<string, number>; treasuryRevenue: number; paymentBreakdown: InputPaymentBreakdown } {
	const sectorRevenue: Record<string, number> = {};
	let treasuryRevenue = 0;
	const paymentBreakdown: InputPaymentBreakdown = {};

	// For each consuming sector, use actual purchase provenance to distribute revenue
	for(const [consumingSector, inputCost] of Object.entries(sectorInputCosts)) {
		const result = sectorResults[consumingSector];
		const provenance = purchaseProvenance[consumingSector];
		if(!result || !provenance || inputCost <= 0) continue;

		paymentBreakdown[consumingSector] = {};

		for(const [goodKey, consumedQty] of Object.entries(result.consumedGoods ?? {})) {
			const key = goodKey as keyof Goods;
			const consumed = Number(consumedQty) ?? 0;
			if(consumed <= 0) continue;

			const price = prices[key] ?? 0;
			if(price <= 0) continue;

			const source = provenance[key];
			if(!source) continue;

			// Total purchased from all sources
			const totalPurchased = source.warehouse + Object.values(source.producers).reduce((sum, v) => sum + v, 0);
			if(totalPurchased <= 0) continue;

			// Proportion of purchased goods that were actually consumed
			const consumptionRatio = consumed / totalPurchased;

			// Credit producing sectors based on actual units they supplied (proportional to consumption)
			for(const [producingSector, quantity] of Object.entries(source.producers)) {
				const revenue = quantity * consumptionRatio * price;
				sectorRevenue[producingSector] = (sectorRevenue[producingSector] ?? 0) + revenue;
				paymentBreakdown[consumingSector][producingSector] = (paymentBreakdown[consumingSector][producingSector] ?? 0) + revenue;
			}

			// Credit treasury for warehouse portion (proportional to consumption)
			const warehouseRevenue = source.warehouse * consumptionRatio * price;
			treasuryRevenue += warehouseRevenue;
			paymentBreakdown[consumingSector]["colony_treasury"] = (paymentBreakdown[consumingSector]["colony_treasury"] ?? 0) + warehouseRevenue;
		}
	}

	// Reconciliation check: total distributed revenue should match total input costs
	const totalDistributedRevenue = Object.values(sectorRevenue).reduce((sum, v) => sum + v, 0) + treasuryRevenue;
	const totalInputCosts = Object.values(sectorInputCosts).reduce((sum, v) => sum + v, 0);

	if(Math.abs(totalDistributedRevenue - totalInputCosts) > 1e-6) {
		throw new Error(
			`Revenue distribution mismatch: distributed=${totalDistributedRevenue}, inputCosts=${totalInputCosts}`
		);
	}

	return { sectorRevenue, treasuryRevenue, paymentBreakdown };
}

/**
 * Essential sectors that produce non-cumulative goods required by other sectors.
 * These must receive minimum labor allocation to prevent economic collapse.
 */
export const ESSENTIAL_SERVICE_SECTORS: ReadonlySet<string> = new Set([
	"powerPlant",      // energy
	"government",      // governance
	"forestry",        // environmentFactor
	"services",        // services
	"healthcare",      // healthcare
	"education",       // education
	"lawEnforcement",  // lawEnforcement
	"logistics",       // logistics
	"tourism",         // tourism
	"entertainmentIndustry", // entertainment
	"bank",            // monetaryServices
	"religion",        // faith
	"defense",         // defense
]);

/**
 * Minimum viable production scale for essential sectors.
 * Below this scale, the sector cannot sustain the service flow other sectors depend on.
 * This is a global default; per-sector overrides can be provided via ESSENTIAL_MINIMUM_SCALE.
 */
export const MINIMUM_ESSENTIAL_SCALE = 0.15;

/**
 * Per-sector minimum viable scale overrides.
 * Sectors not listed here use the global MINIMUM_ESSENTIAL_SCALE.
 */
export const ESSENTIAL_MINIMUM_SCALE: Record<string, number> = {
	// Default values (illustrative, not recommended balance settings)
	// powerPlant: 0.35,
	// government: 0.15,
	// healthcare: 0.20,
	// logistics: 0.25,
};

/**
 * Computes minimum labor allocation for essential service sectors.
 * Returns a map of sector -> population type -> minimum workers needed.
 */
export function computeMinimumEssentialLabor(
	sectorBids: { name: string; idealWorkerDemand: Record<string, number> }[]
): Record<string, Partial<Record<keyof Population, number>>> {
	const minLabor: Record<string, Partial<Record<keyof Population, number>>> = {};

	for(const bid of sectorBids) {
		if(!ESSENTIAL_SERVICE_SECTORS.has(bid.name)) continue;

		const scale = ESSENTIAL_MINIMUM_SCALE[bid.name] ?? MINIMUM_ESSENTIAL_SCALE;

		minLabor[bid.name] = {};
		for(const [popType, demand] of Object.entries(bid.idealWorkerDemand)) {
			if(demand > 0) {
				const key = popType as keyof Population;
				minLabor[bid.name]![key] = demand * scale;
			}
		}
	}

	return minLabor;
}

/**
 * Two-stage labor allocation:
 * 1. Reserve minimum labor for essential sectors
 * 2. Allocate remaining workers proportionally by priority
 */
export function allocateLaborTwoStage(
	availableWorkers: Record<keyof Population, number>,
	sectorRequests: Array<{
		sectorId: string;
		idealDemand: Partial<Record<keyof Population, number>>;
		priority: number;
	}>,
	minimumEssentialLabor: Record<string, Partial<Record<keyof Population, number>>>
): { allocation: Record<string, Partial<Record<keyof Population, number>>>; unmetDemand: Record<string, Partial<Record<keyof Population, number>>> } {
	const EPSILON = 1e-9;
	const allocation: Record<string, Partial<Record<keyof Population, number>>> = {};
	const unmetDemand: Record<string, Partial<Record<keyof Population, number>>> = {};

	// Validate availableWorkers
	for(const [popType, count] of Object.entries(availableWorkers)) {
		if(!Number.isFinite(count) || count < 0) {
			throw new Error(`Invalid available workers for ${popType}: ${count}`);
		}
	}

	// Validate sectorRequests
	for(const req of sectorRequests) {
		if(!req.sectorId) {
			throw new Error("Sector request missing sectorId");
		}
		if(!Number.isFinite(req.priority) || req.priority < 0) {
			throw new Error(`Invalid priority for ${req.sectorId}: ${req.priority}`);
		}
		for(const [popType, demand] of Object.entries(req.idealDemand)) {
			if(!Number.isFinite(demand) || demand < 0) {
				throw new Error(`Invalid ideal demand for ${req.sectorId}/${popType}: ${demand}`);
			}
		}
	}

	// Validate minimumEssentialLabor and initialize allocation/unmetDemand for all referenced sectors
	for(const [sectorId, minDemand] of Object.entries(minimumEssentialLabor)) {
		if(!allocation[sectorId]) {
			allocation[sectorId] = {};
			unmetDemand[sectorId] = {};
		}
		for(const [popType, minWorkers] of Object.entries(minDemand)) {
			if(!Number.isFinite(minWorkers) || minWorkers < 0) {
				throw new Error(`Invalid minimum labor for ${sectorId}/${popType}: ${minWorkers}`);
			}
		}
	}

	// Initialize all sectors from sectorRequests
	for(const req of sectorRequests) {
		if(!allocation[req.sectorId]) {
			allocation[req.sectorId] = {};
			unmetDemand[req.sectorId] = {};
		}
	}

	// Stage 1: Reserve minimum labor for essential sectors
	const remainingWorkers: Record<keyof Population, number> = { ...availableWorkers };

	for(const [sectorId, minDemand] of Object.entries(minimumEssentialLabor)) {
		for(const [popType, minWorkers] of Object.entries(minDemand)) {
			const key = popType as keyof Population;
			const available = remainingWorkers[key] ?? 0;
			const allocated = Math.min(minWorkers, available);

			if(allocated > 0) {
				allocation[sectorId]![key] = allocated;
				remainingWorkers[key] = available - allocated;
			}

			// Track unmet essential demand
			if(minWorkers > allocated + EPSILON) {
				unmetDemand[sectorId]![key] = minWorkers - allocated;
			}
		}
	}

	// Stage 2: Proportional allocation of remaining workers for ALL sectors
	// (including essential sectors for additional capacity beyond minimum)
	for(const popType of Object.keys(availableWorkers) as (keyof Population)[]) {
		const available = remainingWorkers[popType] ?? 0;
		if(available <= EPSILON) continue;

		// Build demands for this population type (full demand minus already allocated)
		const demands = sectorRequests
			.map(req => {
				const idealDemand = req.idealDemand[popType] ?? 0;
				const alreadyAllocated = allocation[req.sectorId]?.[popType] ?? 0;
				const remainingDemand = Math.max(0, idealDemand - alreadyAllocated);
				return {
					sectorId: req.sectorId,
					remaining: remainingDemand,
					priority: req.priority,
				};
			})
			.filter(item => item.remaining > EPSILON);

		if(demands.length === 0) continue;

		let remainingWorkersForPop = available;

		// Weighted allocation with demand caps and redistribution
		let active = demands;

		while(active.length > 0 && remainingWorkersForPop > EPSILON) {
			const totalWeight = active.reduce(
				(sum, item) => sum + item.remaining * item.priority,
				0,
			);

			if(totalWeight <= 0 || !Number.isFinite(totalWeight)) {
				throw new Error(`Invalid labor allocation weights for ${String(popType)}`);
			}

			const saturated = active.filter(item => {
				const proposed = remainingWorkersForPop * (item.remaining * item.priority) / totalWeight;
				return proposed >= item.remaining - EPSILON;
			});

			if(saturated.length > 0) {
				const saturatedIds = new Set(saturated.map(item => item.sectorId));

				for(const item of saturated) {
					const amount = Math.min(item.remaining, remainingWorkersForPop);
					allocation[item.sectorId]![popType] = (allocation[item.sectorId]![popType] ?? 0) + amount;
					remainingWorkersForPop -= amount;
					item.remaining -= amount;
				}

				active = active.filter(item => !saturatedIds.has(item.sectorId));
				continue;
			}

			// No demand caps reached: distribute remaining stock using bounded allocation
			for(const item of active) {
				const proposed = remainingWorkersForPop * (item.remaining * item.priority) / totalWeight;
				const amount = Math.min(proposed, item.remaining);
				allocation[item.sectorId]![popType] = (allocation[item.sectorId]![popType] ?? 0) + amount;
				remainingWorkersForPop -= amount;
				item.remaining -= amount;
			}

			// Redistribute any remainder among sectors with unmet demand
			if(remainingWorkersForPop > EPSILON) {
				const stillActive = active.filter(item => item.remaining > EPSILON);
				if(stillActive.length > 0) {
					const stillActiveWeight = stillActive.reduce(
						(sum, item) => sum + item.remaining * item.priority,
						0,
					);
					for(const item of stillActive) {
						if(remainingWorkersForPop <= EPSILON) break;
						const proposed = remainingWorkersForPop * (item.remaining * item.priority) / stillActiveWeight;
						const amount = Math.min(proposed, item.remaining);
						allocation[item.sectorId]![popType] = (allocation[item.sectorId]![popType] ?? 0) + amount;
						remainingWorkersForPop -= amount;
						item.remaining -= amount;
					}
				}
			}
			break;
		}

		// Track unmet demand
		for(const item of demands) {
			if(item.remaining > EPSILON) {
				unmetDemand[item.sectorId]![popType] = (unmetDemand[item.sectorId]![popType] ?? 0) + item.remaining;
			}
		}
	}

	return { allocation, unmetDemand };
}
