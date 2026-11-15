import { Goods } from "../data/Goods.ts";

export type TransactionType =
	| "goods_purchase"
	| "population_consumption"
	| "wage_payment"
	| "capital_purchase"
	| "population_spending"
	| "external_injection"
	| "external_destruction";

export interface EconomicTransaction {
	tick: number;
	type: TransactionType;
	buyerId?: string;
	sellerId?: string;
	goodId?: keyof Goods;
	quantity?: number;
	unitPrice?: number;
	amount: number;
	buyerWealthBefore?: number;
	buyerWealthAfter?: number;
	sellerMoneyBefore?: number;
	sellerMoneyAfter?: number;
}

/**
 * TransactionLedger records all economic transactions for a colony.
 * Provides money conservation verification and audit trail.
 */
export class TransactionLedger {
	private transactions: EconomicTransaction[] = [];

	record(tx: EconomicTransaction) {
		this.transactions.push(tx);
	}

	getTransactions(tick?: number): EconomicTransaction[] {
		if(tick === undefined) return this.transactions;
		return this.transactions.filter(t => t.tick === tick);
	}

	clear() {
		this.transactions = [];
	}

	/**
	 * Verify money conservation: sum of all money changes should equal
	 * external injections minus external destructions.
	 */
	verifyConservation(): {
		valid: boolean;
		totalInjections: number;
		totalDestructions: number;
		netInternal: number;
		error: number;
	} {
		let totalInjections = 0;
		let totalDestructions = 0;
		let netInternal = 0;

		for(const tx of this.transactions) {
			if(tx.type === "external_injection") {
				totalInjections += tx.amount;
			} else if(tx.type === "external_destruction") {
				totalDestructions += tx.amount;
			} else {
				// Internal transfers should have paired entries:
				// buyer loses amount, seller gains amount → net = 0
				// We track this by looking at amount sign convention:
				// positive = money received, negative = money paid
				netInternal += tx.amount;
			}
		}

		const error = Math.abs(netInternal);
		const valid = error < 1e-6;

		return { valid, totalInjections, totalDestructions, netInternal, error };
	}
}

/**
 * Allocates population spending to sectors based on actual available production.
 * Unlike production-share allocation, this caps revenue at production * price
 * and tracks unsold goods.
 *
 * Returns:
 * - sectorRevenue: revenue per sector from population sales
 * - salesQty: actual quantity sold per sector per good
 * - unsoldQty: unsold production per sector per good
 * - unmetDemandQty: population demand not met by any sector
 */
export function allocatePopulationSales({
	sectorBids,
	sectorResults,
	populationConsumption,
	prices,
}: {
	sectorBids: { name: string }[];
	sectorResults: Record<string, { producedGoods: Record<string, number> }>;
	populationConsumption: Partial<Goods>;
	prices: Record<keyof Goods, number>;
}): {
	sectorRevenue: Record<string, number>;
	salesQty: Record<string, Partial<Record<keyof Goods, number>>>;
	unsoldQty: Record<string, Partial<Record<keyof Goods, number>>>;
	unmetDemandQty: Partial<Record<keyof Goods, number>>;
} {
	const sectorRevenue: Record<string, number> = {};
	const salesQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const unsoldQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const unmetDemandQty: Partial<Record<keyof Goods, number>> = {};

	// Initialize per-sector tracking
	for(const bid of sectorBids) {
		sectorRevenue[bid.name] = 0;
		salesQty[bid.name] = {};
		unsoldQty[bid.name] = {};
	}

	// For each good, allocate population demand to sectors proportionally
	for(const [goodKey, demandQty] of Object.entries(populationConsumption)) {
		if(!demandQty || demandQty <= 0) continue;
		const gKey = goodKey as keyof Goods;
		const price = prices[gKey] ?? 0;
		if(price <= 0) continue;

		// Collect production per sector for this good
		const sectorProduction: { sectorName: string; qty: number }[] = [];
		let totalProduction = 0;

		for(const bid of sectorBids) {
			const result = sectorResults[bid.name];
			if(!result) continue;
			const produced = result.producedGoods[gKey] ?? 0;
			if(produced > 0) {
				sectorProduction.push({ sectorName: bid.name, qty: produced });
				totalProduction += produced;
			}
		}

		if(totalProduction <= 0) {
			// No production → all demand is unmet
			unmetDemandQty[gKey] = (unmetDemandQty[gKey] ?? 0) + demandQty;
			continue;
		}

		// Proportional allocation: each sector sells min(their production, their share of demand)
		const demandCoverage = Math.min(1, demandQty / totalProduction);

		for(const { sectorName, qty: production } of sectorProduction) {
			const soldQty = production * demandCoverage;
			const revenue = soldQty * price;

			sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + revenue;
			salesQty[sectorName][gKey] = (salesQty[sectorName][gKey] ?? 0) + soldQty;
			unsoldQty[sectorName][gKey] = (unsoldQty[sectorName][gKey] ?? 0) + (production - soldQty);
		}

		// Track unmet demand (if demand > total production)
		if(demandQty > totalProduction) {
			unmetDemandQty[gKey] = (unmetDemandQty[gKey] ?? 0) + (demandQty - totalProduction);
		}
	}

	return { sectorRevenue, salesQty, unsoldQty, unmetDemandQty };
}
