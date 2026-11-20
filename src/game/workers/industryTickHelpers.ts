import { Goods, basePrices } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { getGoodRequirementsAndQoL, getRequirementsForQol } from "../data/Population";
import { populationGrowth } from "../data/populationHelpers";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickResult } from "./IndustryTickResult";
import type { SectorBid } from "./SectorBid";

/**
 * Scale-aware equality check for aggregate reconciliations.
 * Uses both absolute and relative tolerance to handle values at different scales.
 * 
 * @param actual - The actual value
 * @param expected - The expected value
 * @param absTol - Absolute tolerance (default: 1e-6)
 * @param relTol - Relative tolerance (default: 1e-9)
 * @returns true if values are within tolerance
 */
export function nearlyEqual(
    actual: number,
    expected: number,
    absTol: number = 1e-6,
    relTol: number = 1e-9
): boolean {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
        return false;
    }
    if (!Number.isFinite(absTol) || absTol < 0) {
        return false;
    }
    if (!Number.isFinite(relTol) || relTol < 0) {
        return false;
    }
    const tol = Math.max(absTol, relTol * Math.max(1, Math.abs(actual), Math.abs(expected)));
    return Math.abs(actual - expected) <= tol;
}

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

/**
 * Detailed purchase line for ledger recording.
 * Each line represents one buyer-seller-good transaction.
 */
export type InputPurchaseLine = {
	buyerId: string;
	sellerId: string; // "colony_treasury" or producer sector ID
	goodId: keyof Goods;
	quantity: number;
	unitPrice: number;
	amount: number; // quantity * unitPrice
};

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

	// Validate required good prices exist
	const requiredGoods = ["food", "water", "energy", "healthcare", "agriculturalGoods"] as const;
	for (const good of requiredGoods) {
		if (!(good in prices)) {
			throw new Error(`Missing price for required good: ${good}`);
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

        // Validate QoL range 0-80
        if (pop.qol < 0 || pop.qol > 80) {
            throw new Error(`Invalid QoL for ${key}: ${pop.qol} (must be 0-80)`);
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

export type ProducerInventories = Record<string, Partial<Record<keyof Goods, number>>>;

export function buySectorInputs(
    sectorBids: SectorBid[],
    goods: Goods,
    newMoney: Record<string, number>,
    prices: Record<keyof Goods, number>,
    goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>>,
    // Optional: composition of warehouse by producer (good -> producer -> quantity).
    // If not provided, all attributed to "colony_treasury" (opening inventory).
    warehouseComposition?: Partial<Record<keyof Goods, Record<string, number>>>,
    // Producer inventories for source-aware procurement (warehouse-first, then producers)
    producerInventories: ProducerInventories = {}
): { 
    colonyGoodsAfterPurchase: Goods; 
    newMoney: Record<string, number>; 
    purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>>;
    purchaseProvenance: PurchaseProvenance;
    purchaseLines: InputPurchaseLine[];
    // Updated producer inventories after purchases
    updatedProducerInventories: ProducerInventories;
} {
    const colonyGoodsAfterPurchase = { ...goods };
    const updatedMoney = { ...newMoney };
    const purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};
    const purchaseProvenance: PurchaseProvenance = {};
    const purchaseLines: InputPurchaseLine[] = [];

    // Deep clone producer inventories at ALL nesting levels
    const updatedProducerInventories: ProducerInventories = {};
    for (const [producerId, inventory] of Object.entries(producerInventories)) {
        updatedProducerInventories[producerId] = { ...inventory };
        // Validate producer inventory quantities
        for (const [good, qty] of Object.entries(updatedProducerInventories[producerId])) {
            if (!Number.isFinite(qty) || qty < 0) {
                throw new Error(`Invalid producer inventory for ${producerId}/${good}: ${qty}`);
            }
        }
    }

    const validGoods = new Set(Object.keys(goods));
    const seenSectors = new Set<string>();

    // Validate starting inventory.
    for(const [good, amount] of Object.entries(goods)) {
        if(!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Invalid starting inventory for ${good}: ${amount}`);
        }
    }

    // Preflight: validate allocation completeness.
    for(const bid of sectorBids) {
        const sectorName = bid.name;

        if(!Object.hasOwn(goodsAllocations, sectorName)) {
            throw new Error(`Missing goods allocation for ${sectorName}`);
        }

        const allocation = goodsAllocations[sectorName];

        if (
            !allocation ||
            typeof allocation !== "object" ||
            Array.isArray(allocation)
        ) {
            throw new Error(`Invalid goods allocation for ${sectorName}`);
        }

        for (const goodName of Object.keys(bid.idealGoodsDemand)) {
            const key = goodName as keyof Goods;
            if (!(key in prices)) {
                throw new Error(`Missing price for demanded good: ${goodName}`);
            }
        }

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

    // Build mutable remaining composition per good, validated against inventory
    const remainingComposition: Partial<Record<keyof Goods, Record<string, number>>> = {};

    for (const key of Object.keys(goods) as (keyof Goods)[]) {
        const supplied = warehouseComposition?.[key];
        const inventory = goods[key] ?? 0;

        if (supplied) {
            const composition = { ...supplied };
            let total = 0;
            for (const [producer, qty] of Object.entries(composition)) {
                if (!Number.isFinite(qty) || qty < 0) {
                    throw new Error(`Invalid warehouse provenance for ${String(key)}/${producer}: ${qty}`);
                }
                total += qty;
            }
            const tolerance = Math.max(1e-9, 1e-10 * Math.max(1, inventory));
            if (Math.abs(total - inventory) > tolerance) {
                throw new Error(
                    `Warehouse provenance mismatch for ${String(key)}: composition=${total}, inventory=${inventory}`
                );
            }
            remainingComposition[key] = composition;
        } else {
            remainingComposition[key] = { colony_treasury: inventory };
        }
    }

    for(const bid of sectorBids) {
        const sectorName = bid.name;

        if(!sectorName || seenSectors.has(sectorName)) {
            throw new Error(`Invalid or duplicate sector: ${sectorName}`);
        }
        seenSectors.add(sectorName);

        const allocation = goodsAllocations[sectorName];

        for (const [goodName, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
            const key = goodName as keyof Goods;
            const allocated = allocation[key] ?? 0;
            const idealDemand = demandPerTick * bid.actualScale;
            if (allocated > idealDemand * 10) {
				// comented, so the program runs without lag
                // console.warn(`Allocation for ${sectorName}/${goodName} (${allocated}) significantly exceeds demand (${idealDemand})`);
            }
        }

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

            // WAREHOUSE-FIRST procurement: allocate against warehouse stock first, then producer inventories
            const composition = remainingComposition[key] ?? { colony_treasury: available };
            const producers: Record<string, number> = {};
            let warehousePortion = 0;
            let remainingToBuy = toBuy;

            // 1. First, buy from warehouse (colony_treasury and sector producers in warehouse)
            if (remainingToBuy > 0) {
                const totalInWarehouse = Object.values(composition).reduce((sum, v) => sum + v, 0);
                if (totalInWarehouse > 0) {
                    for (const [producer, qty] of Object.entries(composition)) {
                        if (remainingToBuy <= 0) break;
                        const share = qty / totalInWarehouse;
                        const attributed = Math.min(remainingToBuy, toBuy * share);
                        if (producer === "colony_treasury") {
                            warehousePortion += attributed;
                            remainingComposition[key]!.colony_treasury = Math.max(0, (remainingComposition[key]!.colony_treasury ?? 0) - attributed);
                        } else {
                            producers[producer] = (producers[producer] ?? 0) + attributed;
                            remainingComposition[key]![producer] = Math.max(0, (remainingComposition[key]![producer] ?? 0) - attributed);
                        }
                        remainingToBuy -= attributed;
                    }
                }
            }

            // 2. Then, buy from producer inventories (warehouse-first means we only go to producer inventories if warehouse is exhausted)
            if (remainingToBuy > 0) {
                // Get all producers who have this good in their inventory, sorted by name for deterministic ordering
                const producerSources = Object.entries(updatedProducerInventories)
                    .filter(([_, inv]) => (inv[key] ?? 0) > 0)
                    .sort(([a], [b]) => a.localeCompare(b));
                
                for (const [producerId, inventory] of producerSources) {
                    if (remainingToBuy <= 0) break;
                    const producerAvailable = inventory[key] ?? 0;
                    const toBuyFromProducer = Math.min(remainingToBuy, producerAvailable);
                    if (toBuyFromProducer > 0) {
                        producers[producerId] = (producers[producerId] ?? 0) + toBuyFromProducer;
                        inventory[key] = Math.max(0, producerAvailable - toBuyFromProducer);
                        remainingToBuy -= toBuyFromProducer;
                    }
                }
            }

            // If we still couldn't buy enough, adjust toBuy to what we actually bought
            const actualBought = toBuy - remainingToBuy;
            if (actualBought < toBuy) {
                // Adjust cost and money for actual quantity bought
                const priceRatio = actualBought / toBuy;
                cost *= priceRatio;
                sectorMoney = Math.max(0, sectorMoney + (toBuy - actualBought) * price);
                colonyGoodsAfterPurchase[key] = Math.max(0, available - actualBought);
                purchasedBySector[sectorName][key] = actualBought;
            }

            purchaseProvenance[sectorName][key] = {
                warehouse: warehousePortion,
                producers,
            };

            // Generate purchase lines for ledger
            if (warehousePortion > 0) {
                purchaseLines.push({
                    buyerId: sectorName,
                    sellerId: "colony_treasury",
                    goodId: key,
                    quantity: warehousePortion,
                    unitPrice: price,
                    amount: warehousePortion * price,
                });
            }
            for (const [producer, qty] of Object.entries(producers)) {
                if (qty > 0) {
                    purchaseLines.push({
                        buyerId: sectorName,
                        sellerId: producer,
                        goodId: key,
                        quantity: qty,
                        unitPrice: price,
                        amount: qty * price,
                    });
                }
            }
        }

        updatedMoney[sectorName] = sectorMoney;
    }

    return {
        colonyGoodsAfterPurchase,
        newMoney: updatedMoney,
        purchasedBySector,
        purchaseProvenance,
        purchaseLines,
        updatedProducerInventories,
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

	// Preflight: all consumed sectors must exist in purchases
	for (const sector of Object.keys(consumedBySector)) {
		if (!Object.hasOwn(purchasedBySector, sector)) {
			throw new Error(`Consumption recorded without purchases for ${sector}`);
		}
	}

	for (const [sector, purchases] of Object.entries(purchasedBySector)) {
		const consumed = consumedBySector[sector] ?? {};
		returnedBySector[sector] = {};

		let refund = 0;

		// Iterate over union of purchased and consumed goods
		const allGoods = new Set<keyof Goods>([
			...Object.keys(purchases) as (keyof Goods)[],
			...Object.keys(consumed) as (keyof Goods)[],
		]);

		for (const good of allGoods) {
			const purchased = purchases[good] ?? 0;
			const used = consumed[good] ?? 0;

			if (
				!Number.isFinite(purchased) ||
				purchased < 0 ||
				!Number.isFinite(used) ||
				used < 0
			) {
				throw new Error(
					`Invalid input reconciliation: ${sector}/${good} purchased=${purchased}, used=${used}`
				);
			}

			const price = prices[good];
			if (!Number.isFinite(price) || price < 0) {
				throw new Error(`Invalid price for ${good}: ${price}`);
			}

			// Scale-aware tolerance
			const tolerance = Math.max(
				1e-9,
				1e-10 * Math.max(1, purchased, used),
			);

			if (used > purchased + tolerance) {
				throw new Error(
					`Sector ${sector}/${good} consumed more than purchased: used=${used}, purchased=${purchased}, tolerance=${tolerance}`
				);
			}

			// Clamp only genuinely tiny floating-point overshoot
			const reconciledUsed = Math.min(used, purchased);
			const returned = purchased - reconciledUsed;

			returnedBySector[sector][good] = returned;
			updatedGoods[good] = (updatedGoods[good] ?? 0) + returned;

			refund += returned * price;
		}

		if (!Number.isFinite(refund)) {
			throw new Error(`Invalid input refund for ${sector}`);
		}

		updatedMoney[sector] = (updatedMoney[sector] ?? 0) + refund;
		refundedBySector[sector] = refund;

		// Validate updated money balance
		if (!Number.isFinite(updatedMoney[sector]) || updatedMoney[sector] < 0) {
			throw new Error(`Invalid updated money for ${sector}: ${updatedMoney[sector]}`);
		}
	}

	// Validate all updated goods are finite and nonnegative
	for (const [good, amount] of Object.entries(updatedGoods)) {
		if (!Number.isFinite(amount) || amount < 0) {
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
    // Compute all results first (atomic commit)
    const results: Record<keyof Goods, number> = {} as Record<keyof Goods, number>;
    
    for (const key in deltas) {
        if (!Object.hasOwn(goods, key)) {
            throw new Error(`Unknown good in modifier: ${key}`);
        }
        const delta = deltas[key];

        if (!Number.isFinite(delta)) {
            throw new Error(`Invalid modifier delta for ${key}`);
        }
        const current = goods[key as keyof Goods] ?? 0;
        const result = modifier(current, delta);

        if (!Number.isFinite(result) || result < 0) {
            throw new Error(`Invalid modified inventory for ${key}`);
        }
        results[key as keyof Goods] = result;
    }
    
    // Commit all at once
    for (const key of Object.keys(results) as (keyof Goods)[]) {
        goods[key] = results[key];
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
export function computeMarketRatios<TKey extends string | number>(
	demands: Record<TKey, number>,
	available: Record<TKey, number>,
): Record<TKey, number> {
	const ratios = {} as Record<TKey, number>;

	// Validate all availability keys for finiteness and non-negativity.
	// Object.keys returns string[], safe for string | number keys
	for(const key of Object.keys(available)) {
		const supply = available[key as TKey];
		if(!Number.isFinite(supply) || supply < 0) {
			throw new Error(`Invalid availability for ${String(key)}`);
		}
	}

	for(const key of Object.keys(demands)) {
		const demand = demands[key as TKey];
		const supply = available[key as TKey] ?? 0;

		if(!Number.isFinite(demand) || demand < 0) {
			throw new Error(`Invalid demand for ${String(key)}`);
		}

		if(!Number.isFinite(supply) || supply < 0) {
			throw new Error(`Invalid availability for ${String(key)}`);
		}

		ratios[key as TKey] = demand > 0
			? Math.min(1, supply / demand)
			: 1;
	}

	return ratios;
}
export function trySetPatchField<T extends Record<string, any>>(
    patch: Record<string, T>,
    field: string,
    lastVal: T | undefined,
    newVal: T,
    diffFn: (a: T | undefined, b: T) => Partial<T> | null | undefined
): boolean {
    const diff = diffFn(lastVal, newVal);
    if (diff && Object.keys(diff).length > 0) {
        patch[field] = { ...(lastVal ?? {}), ...diff } as T;
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

	// Validate all sectorInputCosts have corresponding sectorResults
	for (const sector of Object.keys(sectorInputCosts)) {
		if (!sectorResults[sector]) {
			throw new Error(`Missing sectorResults for ${sector} with inputCosts > 0`);
		}
	}

	// For each consuming sector, use actual purchase provenance to distribute revenue
	for (const [consumingSector, inputCost] of Object.entries(sectorInputCosts)) {
		const result = sectorResults[consumingSector];
		const provenance = purchaseProvenance[consumingSector];
		
		if (!result || !provenance || inputCost <= 0) continue;

		paymentBreakdown[consumingSector] = {};

		let expectedCost = 0;

		for (const [goodKey, consumedQty] of Object.entries(result.consumedGoods ?? {})) {
			const key = goodKey as keyof Goods;
			
			// Explicit validation (not Number() ?? 0)
			const consumed = consumedQty;
			if (!Number.isFinite(consumed) || consumed < 0) {
				throw new Error(`Invalid consumption for ${consumingSector}/${key}: ${consumed}`);
			}
			if (consumed <= 0) continue;

			// Validate price exists and is valid
			const price = prices[key];
			if (!Number.isFinite(price) || price < 0) {
				throw new Error(`Invalid price for ${key}: ${price}`);
			}

			const source = provenance[key];
			if (!source) {
				throw new Error(`Missing provenance for ${consumingSector}/${key} with consumption > 0`);
			}

			// Validate provenance quantities
			if (!Number.isFinite(source.warehouse) || source.warehouse < 0) {
				throw new Error(`Invalid warehouse provenance for ${consumingSector}/${key}`);
			}
			for (const [producer, qty] of Object.entries(source.producers)) {
				if (!Number.isFinite(qty) || qty < 0) {
					throw new Error(`Invalid producer provenance for ${consumingSector}/${key}/${producer}: ${qty}`);
				}
			}

			// Total purchased from all sources
			const totalPurchased = source.warehouse + Object.values(source.producers).reduce((sum, v) => sum + v, 0);
			if (totalPurchased <= 0) {
				throw new Error(`Zero total provenance for ${consumingSector}/${key} with consumption > 0`);
			}

			// Scale-aware tolerance
			const tolerance = Math.max(1e-9, 1e-10 * Math.max(1, totalPurchased, consumed));
			if (consumed > totalPurchased + tolerance) {
				throw new Error(`Consumption exceeds provenance for ${consumingSector}/${key}: consumed=${consumed}, provenance=${totalPurchased}`);
			}

			// Proportion of purchased goods that were actually consumed
			const consumptionRatio = consumed / totalPurchased;
			expectedCost += consumed * price;

			// Credit producing sectors based on actual units they supplied (proportional to consumption)
			for (const [producingSector, quantity] of Object.entries(source.producers)) {
				const revenue = quantity * consumptionRatio * price;
				sectorRevenue[producingSector] = (sectorRevenue[producingSector] ?? 0) + revenue;
				paymentBreakdown[consumingSector][producingSector] = (paymentBreakdown[consumingSector][producingSector] ?? 0) + revenue;
			}

			// Credit treasury for warehouse portion (proportional to consumption)
			const warehouseRevenue = source.warehouse * consumptionRatio * price;
			treasuryRevenue += warehouseRevenue;
			paymentBreakdown[consumingSector]["colony_treasury"] = (paymentBreakdown[consumingSector]["colony_treasury"] ?? 0) + warehouseRevenue;
		}

		// Per-sector reconciliation
		const sectorTolerance = Math.max(1e-6, 1e-9 * Math.max(1, inputCost, expectedCost));
		if (Math.abs(expectedCost - inputCost) > sectorTolerance) {
			throw new Error(`Sector cost mismatch for ${consumingSector}: expected=${expectedCost}, recorded=${inputCost}`);
		}
	}

	// Global reconciliation
	const totalDistributedRevenue = Object.values(sectorRevenue).reduce((sum, v) => sum + v, 0) + treasuryRevenue;
	const totalInputCosts = Object.values(sectorInputCosts).reduce((sum, v) => sum + v, 0);
	const globalTolerance = Math.max(1e-6, 1e-9 * Math.max(1, totalDistributedRevenue, totalInputCosts));
	
	if (Math.abs(totalDistributedRevenue - totalInputCosts) > globalTolerance) {
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
 * Explicit priority for essential sectors in Stage 1 reservation.
 * Higher priority = reserved first when workers are scarce.
 * Tie-breaker: sector name (alphabetical).
 */
export const ESSENTIAL_SECTOR_PRIORITY: Record<string, number> = {
	"powerPlant": 10,
	"government": 9,
	"forestry": 8,
	"healthcare": 8,
	"education": 7,
	"lawEnforcement": 7,
	"defense": 7,
	"logistics": 6,
	"services": 5,
	"entertainmentIndustry": 5,
	"bank": 5,
	"tourism": 4,
	"religion": 4,
};

/**
 * Computes minimum labor allocation for essential service sectors.
 * Returns a map of sector -> population type -> minimum workers needed.
 * Sectors are ordered by explicit priority (highest first), then alphabetically.
 */
export function computeMinimumEssentialLabor(
	sectorBids: { name: string; idealWorkerDemand: Record<string, number> }[]
): Record<string, Partial<Record<keyof Population, number>>> {
	const minLabor: Record<string, Partial<Record<keyof Population, number>>> = {};

	// Sort bids by essential priority desc, then name asc
	const sortedBids = [...sectorBids].sort((a, b) => {
		const priorityA = ESSENTIAL_SECTOR_PRIORITY[a.name] ?? 0;
		const priorityB = ESSENTIAL_SECTOR_PRIORITY[b.name] ?? 0;
		if (priorityB !== priorityA) return priorityB - priorityA;
		return String(a.name).localeCompare(String(b.name));
	});

	for (const bid of sortedBids) {
		if (!ESSENTIAL_SERVICE_SECTORS.has(bid.name)) continue;

		const scale = ESSENTIAL_MINIMUM_SCALE[bid.name] ?? MINIMUM_ESSENTIAL_SCALE;
		
		// Validate scale
		if (!Number.isFinite(scale) || scale < 0 || scale > 1) {
			throw new Error(`Invalid essential scale for ${bid.name}: ${scale}`);
		}

		minLabor[bid.name] = {};
		for (const [popType, demand] of Object.entries(bid.idealWorkerDemand)) {
			if (demand > 0) {
				if (!Number.isFinite(demand) || demand < 0) {
					throw new Error(`Invalid ideal demand for ${bid.name}/${popType}: ${demand}`);
				}
				const key = popType as keyof Population;
				minLabor[bid.name]![key] = demand * scale;
			}
		}
	}

	return minLabor;
}

/**
 * Two-stage labor allocation:
 * 1. Reserve minimum labor for essential sectors (sorted by explicit priority)
 * 2. Allocate remaining workers proportionally by priority using water-filling algorithm
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
	for (const [popType, count] of Object.entries(availableWorkers)) {
		if (!Number.isFinite(count) || count < 0) {
			throw new Error(`Invalid available workers for ${popType}: ${count}`);
		}
	}

	// Validate sectorRequests - check duplicates and unknown pop types
	const seenSectors = new Set<string>();
	const validPopTypes = Object.keys(availableWorkers) as (keyof Population)[];
	
	for (const req of sectorRequests) {
		if (!req.sectorId) {
			throw new Error("Sector request missing sectorId");
		}
		if (seenSectors.has(req.sectorId)) {
			throw new Error(`Duplicate sector request: ${req.sectorId}`);
		}
		seenSectors.add(req.sectorId);
		
		if (!Number.isFinite(req.priority) || req.priority < 0) {
			throw new Error(`Invalid priority for ${req.sectorId}: ${req.priority}`);
		}
		
		for (const [popType, demand] of Object.entries(req.idealDemand)) {
			if (!validPopTypes.includes(popType as keyof Population)) {
				throw new Error(`Unknown population type in demand: ${popType} for sector ${req.sectorId}`);
			}
			if (!Number.isFinite(demand) || demand < 0) {
				throw new Error(`Invalid ideal demand for ${req.sectorId}/${popType}: ${demand}`);
			}
		}
	}

	// Validate minimumEssentialLabor and initialize
	for (const [sectorId, minDemand] of Object.entries(minimumEssentialLabor)) {
		if (!allocation[sectorId]) {
			allocation[sectorId] = {};
			unmetDemand[sectorId] = {};
		}
		for (const [popType, minWorkers] of Object.entries(minDemand)) {
			if (!validPopTypes.includes(popType as keyof Population)) {
				throw new Error(`Unknown population type in minimum labor: ${popType} for sector ${sectorId}`);
			}
			if (!Number.isFinite(minWorkers) || minWorkers < 0) {
				throw new Error(`Invalid minimum labor for ${sectorId}/${popType}: ${minWorkers}`);
			}
		}
	}

	// Initialize all sectors from sectorRequests
	for (const req of sectorRequests) {
		if (!allocation[req.sectorId]) {
			allocation[req.sectorId] = {};
			unmetDemand[req.sectorId] = {};
		}
	}

	// Validate essential minimums against sector requests
	const requestsBySector = new Map(
		sectorRequests.map(req => [req.sectorId, req])
	);
	for (const [sectorId, minimum] of Object.entries(minimumEssentialLabor)) {
		const request = requestsBySector.get(sectorId);
		if (!request) {
			throw new Error(
				`Essential labor configured for sector without a request: ${sectorId}`
			);
		}
		for (const [popType, minWorkers] of Object.entries(minimum)) {
			const ideal = request.idealDemand[popType as keyof Population] ?? 0;
			if (minWorkers > ideal + EPSILON) {
				throw new Error(
					`Essential labor exceeds ideal demand for ${sectorId}/${popType}: ` +
					`${minWorkers} > ${ideal}`
				);
			}
		}
	}

	// Stage 1: Reserve minimum labor for essential sectors
	// Sort by explicit priority desc, then sector name asc for stability
	const essentialEntries = Object.entries(minimumEssentialLabor).sort((a, b) => {
		const priorityA = ESSENTIAL_SECTOR_PRIORITY[a[0]] ?? 0;
		const priorityB = ESSENTIAL_SECTOR_PRIORITY[b[0]] ?? 0;
		if (priorityB !== priorityA) return priorityB - priorityA;
		return String(a[0]).localeCompare(String(b[0]));
	});

	const remainingWorkers: Record<keyof Population, number> = { ...availableWorkers };

	for (const [sectorId, minDemand] of essentialEntries) {
		for (const [popType, minWorkers] of Object.entries(minDemand)) {
			const key = popType as keyof Population;
			const available = remainingWorkers[key] ?? 0;
			const allocated = Math.min(minWorkers, available);

			if (allocated > 0) {
				allocation[sectorId]![key] = (allocation[sectorId]![key] ?? 0) + allocated;
				remainingWorkers[key] = available - allocated;
			}

			// Track unmet essential demand
			if (minWorkers > allocated + EPSILON) {
				unmetDemand[sectorId]![key] = (unmetDemand[sectorId]![key] ?? 0) + (minWorkers - allocated);
			}
		}
	}

	// Stage 2: Proportional allocation of remaining workers for ALL sectors
	// using water-filling (capped weighted allocation)
	for (const popType of validPopTypes) {
		const available = remainingWorkers[popType] ?? 0;
		if (available <= EPSILON) continue;

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

		if (demands.length === 0) continue;

		let remainingWorkersForPop = available;

		// Water-filling algorithm: repeated proportional allocation with caps
		let active = demands;

		while (active.length > 0 && remainingWorkersForPop > EPSILON) {
			// Snapshot total weight at start of iteration
			const totalWeight = active.reduce(
				(sum, item) => sum + item.remaining * item.priority,
				0,
			);

			if (!Number.isFinite(totalWeight)) {
				throw new Error(`Invalid labor allocation weights for ${String(popType)}`);
			}

			if (totalWeight <= 0) {
				break;
			}

			// Check which sectors would saturate (hit their demand cap)
			const saturated = active.filter(item => {
				const proposed = remainingWorkersForPop * (item.remaining * item.priority) / totalWeight;
				return proposed >= item.remaining - EPSILON;
			});

			if (saturated.length > 0) {
				const saturatedIds = new Set(saturated.map(item => item.sectorId));

				// Allocate saturated sectors their full remaining demand
				for (const item of saturated) {
					const amount = Math.min(item.remaining, remainingWorkersForPop);
					allocation[item.sectorId]![popType] = (allocation[item.sectorId]![popType] ?? 0) + amount;
					remainingWorkersForPop -= amount;
					item.remaining -= amount;
				}

				// Remove saturated sectors and continue
				active = active.filter(item => !saturatedIds.has(item.sectorId));
				continue;
			}

			// No caps reached: distribute proportionally to ALL active sectors
			// using the same snapshot of remainingWorkersForPop and totalWeight
			// Calculate all proposed amounts first (from snapshot) then apply
			const proposedAmounts = active.map(item => {
				const proposed = remainingWorkersForPop * (item.remaining * item.priority) / totalWeight;
				return Math.min(proposed, item.remaining);
			});
			
			for (let i = 0; i < active.length; i++) {
				const item = active[i];
				const amount = proposedAmounts[i];
				allocation[item.sectorId]![popType] = (allocation[item.sectorId]![popType] ?? 0) + amount;
				remainingWorkersForPop -= amount;
				item.remaining -= amount;
			}

			// If we still have workers but no one can take more, we're done
			const stillActive = active.filter(item => item.remaining > EPSILON);
			if (stillActive.length === 0 || remainingWorkersForPop <= EPSILON) {
				break;
			}
			
			// Continue loop with updated active list
			active = stillActive;
		}

		// Track unmet demand
		for (const item of demands) {
			if (item.remaining > EPSILON) {
				unmetDemand[item.sectorId]![popType] = (unmetDemand[item.sectorId]![popType] ?? 0) + item.remaining;
			}
		}
	}

	return { allocation, unmetDemand };
}

export function validatePrices(
    prices: Record<keyof Goods, number>
): Record<keyof Goods, number> {
    const validated = { ...prices };

    for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
        const value = validated[key];

        if(!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid or missing price for ${key}: ${value}`);
        }
    }

    return validated;
}
