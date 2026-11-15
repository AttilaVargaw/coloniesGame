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
 * Each record represents a single transfer: buyer loses amount, seller gains amount.
 * Provides money conservation verification against opening/closing balances.
 */
export class TransactionLedger {
	private transactions: EconomicTransaction[] = [];

	// Per-account balance deltas computed from recorded transfers
	private accountDeltas: Map<string, number> = new Map();

	record(tx: EconomicTransaction) {
		this.transactions.push(tx);

		// For internal transfers (buyer + seller both present),
		// track the net balance change per account
		if(tx.buyerId && tx.sellerId) {
			const buyerDelta = (this.accountDeltas.get(tx.buyerId) ?? 0) - tx.amount;
			const sellerDelta = (this.accountDeltas.get(tx.sellerId) ?? 0) + tx.amount;
			this.accountDeltas.set(tx.buyerId, buyerDelta);
			this.accountDeltas.set(tx.sellerId, sellerDelta);
		}
	}

	getTransactions(tick?: number): EconomicTransaction[] {
		if(tick === undefined) return this.transactions;
		return this.transactions.filter(t => t.tick === tick);
	}

	clear() {
		this.transactions = [];
		this.accountDeltas.clear();
	}

	/**
	 * Verify money conservation: closing balances should equal opening balances
	 * plus recorded deltas plus external injections minus external destructions.
	 * Internal transfers cancel out by construction.
	 */
	verifyConservation(
		openingBalances: Record<string, number>,
		closingBalances: Record<string, number>,
	): {
		valid: boolean;
		error: number;
		accountErrors: Record<string, number>;
	} {
		const accountErrors: Record<string, number> = {};
		let totalError = 0;

		const allAccounts = new Set([
			...Object.keys(openingBalances),
			...Object.keys(closingBalances),
			...this.accountDeltas.keys(),
		]);

		for(const account of allAccounts) {
			const opening = openingBalances[account] ?? 0;
			const closing = closingBalances[account] ?? 0;
			const delta = this.accountDeltas.get(account) ?? 0;
			const expected = opening + delta;
			const err = Math.abs(closing - expected);
			accountErrors[account] = err;
			totalError += err;
		}

		return { valid: totalError < 1e-6, error: totalError, accountErrors };
	}
}

/**
 * Allocates population spending to sectors based on actual available supply.
 * Supply includes current-tick sector production plus any available-for-sale
 * stock passed in (e.g. colony warehouse inventory). Zero-priced goods are
 * still physically sold; they simply produce zero revenue.
 *
 * Returns:
 * - sectorRevenue: revenue per sector from population sales (zero-priced sales yield zero revenue)
 * - salesQty: actual quantity sold per sector per good (from sector production)
 * - warehouseSalesQty: quantity sold from available-for-sale stock (not attributed to any sector)
 * - unsoldQty: unsold production per sector per good
 * - unmetDemandQty: population demand not met by any source
 */
export function allocatePopulationSales({
	sectorBids,
	sectorResults,
	populationConsumption,
	prices,
	availableStock = {} as Partial<Record<keyof Goods, number>>,
}: {
	sectorBids: { name: string }[];
	sectorResults: Record<string, { producedGoods: Record<string, number> }>;
	populationConsumption: Partial<Goods>;
	prices: Record<keyof Goods, number>;
	availableStock?: Partial<Record<keyof Goods, number>>;
}): {
	sectorRevenue: Record<string, number>;
	salesQty: Record<string, Partial<Record<keyof Goods, number>>>;
	warehouseSalesQty: Partial<Record<keyof Goods, number>>;
	warehouseRevenue: number;
	unsoldQty: Record<string, Partial<Record<keyof Goods, number>>>;
	unmetDemandQty: Partial<Record<keyof Goods, number>>;
} {
	const sectorRevenue: Record<string, number> = {};
	const salesQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const warehouseSalesQty: Partial<Record<keyof Goods, number>> = {};
	let warehouseRevenue = 0;
	const unsoldQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const unmetDemandQty: Partial<Record<keyof Goods, number>> = {};

	// Initialize per-sector tracking
	for(const bid of sectorBids) {
		sectorRevenue[bid.name] = 0;
		salesQty[bid.name] = {};
		unsoldQty[bid.name] = {};
	}

	// For each good, allocate population demand to sectors and available stock proportionally
	for(const [goodKey, demandQty] of Object.entries(populationConsumption)) {
		if(!demandQty || demandQty <= 0) continue;
		const gKey = goodKey as keyof Goods;
		const price = prices[gKey] ?? 0;
		if(!Number.isFinite(price) || price < 0) {
			throw new Error(`Invalid price for ${gKey}: ${price}`);
		}

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

		const stockAvailable = availableStock[gKey] ?? 0;
		const totalSupply = totalProduction + stockAvailable;

		if(totalSupply <= 0) {
			// No supply → all demand is unmet
			unmetDemandQty[gKey] = (unmetDemandQty[gKey] ?? 0) + demandQty;
			continue;
		}

		// Proportional allocation: each source sells its share of demand, scaled by coverage
		// coverage = min(1, demand / totalSupply)
		// When demand <= totalSupply: coverage = demand/totalSupply < 1, all demand met
		// When demand > totalSupply: coverage = 1, all supply sold, remainder unmet
		const demandCoverage = Math.min(1, demandQty / totalSupply);

		for(const { sectorName, qty: production } of sectorProduction) {
			const soldQty = production * demandCoverage;
			const revenue = soldQty * price;

			sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + revenue;
			salesQty[sectorName][gKey] = (salesQty[sectorName][gKey] ?? 0) + soldQty;
			unsoldQty[sectorName][gKey] = (unsoldQty[sectorName][gKey] ?? 0) + (production - soldQty);
		}

		// Sell from available stock (colony warehouse inventory, not attributed to any sector)
		const warehouseSold = stockAvailable * demandCoverage;
		if(warehouseSold > 0) {
			warehouseSalesQty[gKey] = (warehouseSalesQty[gKey] ?? 0) + warehouseSold;
			warehouseRevenue += warehouseSold * price;
		}

		// Track unmet demand (if demand > total supply)
		if(demandQty > totalSupply) {
			unmetDemandQty[gKey] = (unmetDemandQty[gKey] ?? 0) + (demandQty - totalSupply);
		}
	}

	return { sectorRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unsoldQty, unmetDemandQty };
}
