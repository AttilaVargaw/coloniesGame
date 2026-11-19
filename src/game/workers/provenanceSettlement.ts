import type { PurchaseProvenance, InputSourceAllocation } from "./industryTickHelpers";
import type { Goods } from "../data/Goods";

export type ProvenanceSettlement = {
	consumed: Record<string, Partial<Record<keyof Goods, InputSourceAllocation>>>;
	refunded: Record<string, Partial<Record<keyof Goods, InputSourceAllocation>>>;
};

function getPhysicalTolerance(totalPurchased: number): number {
	if (!Number.isFinite(totalPurchased) || totalPurchased < 0) {
		throw new Error("Invalid total purchased for tolerance calculation");
	}
	return Math.max(1e-12, 1e-10 * Math.max(1, totalPurchased));
}

function validateSourceAllocation(
	source: InputSourceAllocation
): void {
	if (!source || typeof source !== "object" || Array.isArray(source)) {
		throw new Error("Invalid source allocation");
	}

	if (!Number.isFinite(source.warehouse) || source.warehouse < 0) {
		throw new Error("Invalid warehouse allocation");
	}

	if (!source.producers || typeof source.producers !== "object" || Array.isArray(source.producers)) {
		throw new Error("Invalid producers map");
	}

	for (const qty of Object.values(source.producers)) {
		if (qty < 0) {
			throw new Error("Negative producer allocation");
		}
		if (!Number.isFinite(qty)) {
			throw new Error("Non-finite producer allocation");
		}
	}
}

export function settleProvenance(
	purchaseProvenance: PurchaseProvenance,
	sectorResults: Record<string, { consumedGoods: Record<string, number> }>
): ProvenanceSettlement {
	// 1. Validate complete input structure BEFORE iterating
	if (!purchaseProvenance || typeof purchaseProvenance !== "object" || Array.isArray(purchaseProvenance)) {
		throw new Error("Invalid purchaseProvenance: must be an object");
	}

	if (!sectorResults || typeof sectorResults !== "object" || Array.isArray(sectorResults)) {
		throw new Error("Invalid sectorResults: must be an object");
	}

	// Validate all purchaseProvenance entries
	for (const goods of Object.values(purchaseProvenance)) {
		if (!goods || typeof goods !== "object" || Array.isArray(goods)) {
			throw new Error("Invalid source allocation");
		}
		for (const source of Object.values(goods)) {
			validateSourceAllocation(source as InputSourceAllocation);
		}
	}

	// 2. Reverse check: every positive consumption must have provenance
	for (const [sector, result] of Object.entries(sectorResults)) {
		const consumedGoods = result?.consumedGoods ?? {};
		for (const [good, consumedQty] of Object.entries(consumedGoods)) {
			if (consumedQty < 0) {
				throw new Error("Negative consumption");
			}
			if (!Number.isFinite(consumedQty)) {
				throw new Error("Non-finite consumption");
			}
			if (consumedQty > 0) {
				const sectorProvenance = purchaseProvenance[sector] as Partial<Record<keyof Goods, InputSourceAllocation>> | undefined;
				const provenance = sectorProvenance?.[good as keyof Goods];
				if (!provenance) {
					throw new Error("Consumption without purchase provenance");
				}
				const totalPurchased = provenance.warehouse + Object.values(provenance.producers).reduce((sum: number, v: number) => sum + v, 0);
				if (totalPurchased <= 0) {
					throw new Error("Consumption exceeds purchase");
				}
			}
		}
	}

	// 3. Build result structure
	const consumed: Record<string, Partial<Record<keyof Goods, InputSourceAllocation>>> = {};
	const refunded: Record<string, Partial<Record<keyof Goods, InputSourceAllocation>>> = {};

	// 4. Iterate purchaseProvenance and compute proportional allocation
	for (const [sector, goods] of Object.entries(purchaseProvenance)) {
		consumed[sector] = {};
		refunded[sector] = {};

		for (const [good, source] of Object.entries(goods)) {
			const validatedSource = source as InputSourceAllocation;
			const totalPurchased = validatedSource.warehouse + Object.values(validatedSource.producers).reduce((sum: number, v: number) => sum + v, 0);
			
			if (!Number.isFinite(totalPurchased)) {
				throw new Error("Invalid total purchased quantity");
			}

			const consumedQty = sectorResults[sector]?.consumedGoods?.[good] ?? 0;
			
			if (consumedQty < 0) {
				throw new Error("Negative consumption");
			}
			if (!Number.isFinite(consumedQty)) {
				throw new Error("Non-finite consumption");
			}

			if (totalPurchased === 0) {
				if (consumedQty > 0) {
					throw new Error("Consumption exceeds purchase");
				}
// Zero purchased, zero consumed: zero consumed, zero refunded
			consumed[sector][good as keyof Goods] = { warehouse: 0, producers: {} };
			refunded[sector][good as keyof Goods] = { warehouse: 0, producers: {} };
				continue;
			}

			const consumptionRatio = consumedQty / totalPurchased;

			// 5. Proportional allocation
			const consumedWarehouse = validatedSource.warehouse * consumptionRatio;
			const consumedProducers: Record<string, number> = {};
			for (const [producer, qty] of Object.entries(validatedSource.producers)) {
				consumedProducers[producer] = qty * consumptionRatio;
			}

			// 6. Refund = purchased - consumed (per source)
			const refundedWarehouse = validatedSource.warehouse - consumedWarehouse;
			const refundedProducers: Record<string, number> = {};
			for (const [producer, qty] of Object.entries(validatedSource.producers)) {
				refundedProducers[producer] = qty - consumedProducers[producer];
			}

			// 7. Invariant: purchased = consumed + refunded per source (within physical tolerance)
			const tolerance = getPhysicalTolerance(totalPurchased);
			const warehouseCheck = Math.abs((consumedWarehouse + refundedWarehouse) - validatedSource.warehouse);
			if (warehouseCheck > tolerance) {
				throw new Error(`Warehouse invariant violated for ${sector}/${good}: ${warehouseCheck} > ${tolerance}`);
			}
			for (const [producer, qty] of Object.entries(validatedSource.producers)) {
				const consumedP = consumedProducers[producer] ?? 0;
				const refundedP = refundedProducers[producer] ?? 0;
				const check = Math.abs((consumedP + refundedP) - qty);
				if (check > tolerance) {
					throw new Error(`Producer invariant violated for ${sector}/${good}/${producer}: ${check} > ${tolerance}`);
				}
			}

			consumed[sector][good as keyof Goods] = { warehouse: consumedWarehouse, producers: consumedProducers };
			refunded[sector][good as keyof Goods] = { warehouse: refundedWarehouse, producers: refundedProducers };
		}
	}

	return { consumed, refunded };
}