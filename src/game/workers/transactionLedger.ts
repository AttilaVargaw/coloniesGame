import { Goods } from "../data/Goods.ts";
import type { Population } from "../data/Population";

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
		// Validate transaction record before accepting it
		if(!Number.isFinite(tx.amount) || tx.amount < 0) {
			throw new Error(`Invalid transaction amount: ${tx.amount}`);
		}
		if(tx.quantity !== undefined && (!Number.isFinite(tx.quantity) || tx.quantity < 0)) {
			throw new Error(`Invalid transaction quantity: ${tx.quantity}`);
		}
		if(tx.unitPrice !== undefined && (!Number.isFinite(tx.unitPrice) || tx.unitPrice < 0)) {
			throw new Error(`Invalid transaction unit price: ${tx.unitPrice}`);
		}

		// Internal transfers require both buyer and seller
		if((tx.buyerId !== undefined) !== (tx.sellerId !== undefined)) {
			throw new Error(`Transaction ${tx.type} has incomplete buyer/seller pair`);
		}

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
 * Household purchases are constrained per population group by available cash.
 * Each group's purchases never exceed that group's remaining cash, deducted
 * as goods are allocated across all demanded goods.
 *
 * Returns:
 * - spendingByPop: total money spent by each population group
 * - purchasesByPop: actual quantity purchased by each group, by good
 * - sectorRevenue: revenue per sector from population sales
 * - salesQty: actual quantity sold per sector per good (from sector production)
 * - warehouseSalesQty: quantity sold from available-for-sale stock
 * - warehouseRevenue: revenue from warehouse stock sales (credited to treasury)
 * - unmetDemandByPop: demand not met by each population group, by good
 * - unsoldQty: unsold production per sector per good
 * - totalSpending: total household money spent
 */
export function allocatePopulationSales({
	sectorBids,
	sectorResults,
	demandByPop,
	cashByPop,
	prices,
	availableStock = {} as Partial<Record<keyof Goods, number>>,
}: {
	sectorBids: { name: string }[];
	sectorResults: Record<string, { producedGoods: Record<string, number> }>;
	demandByPop: Record<keyof Population, Partial<Goods>>;
	cashByPop: Record<keyof Population, number>;
	prices: Record<keyof Goods, number>;
	availableStock?: Partial<Record<keyof Goods, number>>;
}): {
	spendingByPop: Record<keyof Population, number>;
	purchasesByPop: Record<keyof Population, Partial<Record<keyof Goods, number>>>;
	sectorRevenue: Record<string, number>;
	salesQty: Record<string, Partial<Record<keyof Goods, number>>>;
	warehouseSalesQty: Partial<Record<keyof Goods, number>>;
	warehouseRevenue: number;
	unmetDemandByPop: Record<keyof Population, Partial<Record<keyof Goods, number>>>;
	unsoldQty: Record<string, Partial<Record<keyof Goods, number>>>;
	totalSpending: number;
} {
	const sectorRevenue: Record<string, number> = {};
	const salesQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const warehouseSalesQty: Partial<Record<keyof Goods, number>> = {};
	let warehouseRevenue = 0;
	const unsoldQty: Record<string, Partial<Record<keyof Goods, number>>> = {};
	const spendingByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	const purchasesByPop: Record<keyof Population, Partial<Record<keyof Goods, number>>> = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>;
	const unmetDemandByPop: Record<keyof Population, Partial<Record<keyof Goods, number>>> = {} as Record<keyof Population, Partial<Record<keyof Goods, number>>>;

	const popKeys = Object.keys(demandByPop) as (keyof Population)[];

	// Initialize per-sector tracking
	for(const bid of sectorBids) {
		sectorRevenue[bid.name] = 0;
		salesQty[bid.name] = {};
		unsoldQty[bid.name] = {};
	}

	// Initialize per-population tracking
	for(const key of popKeys) {
		spendingByPop[key] = 0;
		purchasesByPop[key] = {};
		unmetDemandByPop[key] = {};
	}

	// Remaining cash per group, deducted as purchases are made
	const remainingCash: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	for(const key of popKeys) {
		remainingCash[key] = Math.max(0, cashByPop[key] ?? 0);
	}

	// Collect all goods that have demand
	const demandedGoods = new Set<keyof Goods>();
	for(const key of popKeys) {
		for(const goodKey of Object.keys(demandByPop[key])) {
			demandedGoods.add(goodKey as keyof Goods);
		}
	}

	// For each good, allocate supply to population groups proportionally to demand,
	// limited by each group's remaining cash
	for(const goodKey of demandedGoods) {
		const price = prices[goodKey] ?? 0;
		if(!Number.isFinite(price) || price < 0) {
			throw new Error(`Invalid price for ${goodKey}: ${price}`);
		}

		// Total demand across all population groups for this good
		let totalDemand = 0;
		for(const key of popKeys) {
			totalDemand += (demandByPop[key][goodKey] ?? 0);
		}
		if(totalDemand <= 0) continue;

		// Collect production per sector for this good
		const sectorProduction: { sectorName: string; qty: number }[] = [];
		let totalProduction = 0;

		for(const bid of sectorBids) {
			const result = sectorResults[bid.name];
			if(!result) continue;
			const produced = result.producedGoods[goodKey] ?? 0;
			if(produced > 0) {
				sectorProduction.push({ sectorName: bid.name, qty: produced });
				totalProduction += produced;
			}
		}

		const stockAvailable = availableStock[goodKey] ?? 0;
		const totalSupply = totalProduction + stockAvailable;

		if(totalSupply <= 0) {
			// No supply → all demand is unmet
			for(const key of popKeys) {
				const d = demandByPop[key][goodKey] ?? 0;
				if(d > 0) {
					unmetDemandByPop[key][goodKey] = d;
				}
			}
			continue;
		}

		// Proportional coverage: fraction of demand that can be physically met
		const coverage = Math.min(1, totalSupply / totalDemand);

		// Each group's desired quantity after physical coverage, and affordable quantity after cash
		const groupRequests: { key: keyof Population; desired: number; affordable: number }[] = [];
		let totalRequested = 0;

		for(const key of popKeys) {
			const demand = demandByPop[key][goodKey] ?? 0;
			if(demand <= 0) continue;
			const desiredQty = demand * coverage;
			let affordableQty: number;
			if(price <= 0) {
				// Free goods: limited by stock only
				affordableQty = desiredQty;
			} else {
				affordableQty = remainingCash[key] / price;
			}
			const requestQty = Math.min(desiredQty, affordableQty);
			if(requestQty > 0) {
				groupRequests.push({ key, desired: desiredQty, affordable: affordableQty });
				totalRequested += requestQty;
			}
		}

		if(totalRequested <= 0) continue;

		// If total requests exceed physical supply, scale down proportionally
		let supplyScale = 1;
		if(totalRequested > totalSupply) {
			supplyScale = totalSupply / totalRequested;
		}

		// Allocate to each group
		for(const { key, desired } of groupRequests) {
			let allocatedQty = desired * supplyScale;
			const unitPrice = prices[goodKey] ?? 0;

			// Re-check affordability after supply scaling
			if(unitPrice > 0) {
				allocatedQty = Math.min(allocatedQty, remainingCash[key] / unitPrice);
			}
			if(allocatedQty <= 0) continue;

			const cost = allocatedQty * unitPrice;
			remainingCash[key] -= cost;
			spendingByPop[key] = (spendingByPop[key] ?? 0) + cost;

			purchasesByPop[key] = { ...(purchasesByPop[key] ?? {}), [goodKey]: allocatedQty };

			// Split allocation between sector production and warehouse stock
			const sectorShare = totalProduction > 0 ? totalProduction / totalSupply : 0;
			const sectorQty = allocatedQty * sectorShare;
			const warehouseQty = allocatedQty - sectorQty;

			if(sectorQty > 0) {
				// Allocate sectorQty proportionally among producing sectors
				for(const { sectorName, qty: production } of sectorProduction) {
					const sectorPortion = (production / totalProduction) * sectorQty;
					salesQty[sectorName][goodKey] = (salesQty[sectorName][goodKey] ?? 0) + sectorPortion;
					sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + sectorPortion * price;
				}
			}

			if(warehouseQty > 0) {
				warehouseSalesQty[goodKey] = (warehouseSalesQty[goodKey] ?? 0) + warehouseQty;
				warehouseRevenue += warehouseQty * price;
			}

            // Track unmet demand for this group
            const groupDemand = demandByPop[key][goodKey] ?? 0;
            const unmet = groupDemand - allocatedQty;
			if(unmet > 0) {
				unmetDemandByPop[key][goodKey] = unmet;
			}
		}

		// Compute unsold per sector after all groups have allocated for this good
		for(const { sectorName, qty: production } of sectorProduction) {
			const totalSold = salesQty[sectorName][goodKey] ?? 0;
			unsoldQty[sectorName][goodKey] = Math.max(0, production - totalSold);
		}
	}

	// Calculate total actual spending
	let totalSpending = 0;
	for(const key of popKeys) {
		totalSpending += spendingByPop[key] ?? 0;
	}

	return { spendingByPop, purchasesByPop, sectorRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unmetDemandByPop, unsoldQty, totalSpending };
}
