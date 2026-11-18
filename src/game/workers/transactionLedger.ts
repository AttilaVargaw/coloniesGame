import { Goods } from "../data/Goods.ts";
import type { Population } from "../data/Population";

export type TransactionType =
	| "goods_purchase"
	| "population_consumption"
	| "wage_payment"
	| "capital_purchase"
	| "population_spending"
	| "external_injection"
	| "external_destruction"
	| "treasury_subsidy";

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

	record(tx: EconomicTransaction): void {
		// All validation happens before any ledger mutation.
		if(!Number.isInteger(tx.tick) || tx.tick < 0) {
			throw new Error(`Invalid transaction tick: ${tx.tick}`);
		}

		if(!Number.isFinite(tx.amount) || tx.amount < 0) {
			throw new Error(`Invalid transaction amount: ${tx.amount}`);
		}

		if(
			tx.quantity !== undefined &&
			(!Number.isFinite(tx.quantity) || tx.quantity < 0)
		) {
			throw new Error(`Invalid transaction quantity: ${tx.quantity}`);
		}

		if(
			tx.unitPrice !== undefined &&
			(!Number.isFinite(tx.unitPrice) || tx.unitPrice < 0)
		) {
			throw new Error(`Invalid transaction unit price: ${tx.unitPrice}`);
		}

		for(const [field, value] of Object.entries({
			buyerWealthBefore: tx.buyerWealthBefore,
			buyerWealthAfter: tx.buyerWealthAfter,
			sellerMoneyBefore: tx.sellerMoneyBefore,
			sellerMoneyAfter: tx.sellerMoneyAfter,
		})) {
			if(value !== undefined && (!Number.isFinite(value) || value < 0)) {
				throw new Error(`Invalid ${field}: ${value}`);
			}
		}

		const changes: [string, number][] = [];

		if(tx.type === "external_injection") {
			// Injection: sellerId is the account receiving money
			this.validateAccountId(tx.sellerId, "sellerId");

			if(this.hasBuyer(tx)) {
				throw new Error(
					"External injection requires sellerId only (the credited account)",
				);
			}

			changes.push([tx.sellerId!, tx.amount]);
		} else if(tx.type === "external_destruction") {
			// Destruction: buyerId is the account losing money
			this.validateAccountId(tx.buyerId, "buyerId");

			if(this.hasSeller(tx)) {
				throw new Error(
					"External destruction requires buyerId only (the debited account)",
				);
			}

			changes.push([tx.buyerId!, -tx.amount]);
		} else if(
			tx.type === "goods_purchase" ||
			tx.type === "population_consumption" ||
			tx.type === "wage_payment" ||
			tx.type === "capital_purchase" ||
			tx.type === "population_spending" ||
			tx.type === "treasury_subsidy"
		) {
			// Internal transfers require both buyer and seller
			this.validateAccountId(tx.buyerId, "buyerId");
			this.validateAccountId(tx.sellerId, "sellerId");

			if (tx.type === "goods_purchase") {
				if (tx.goodId === undefined) {
					throw new Error("goods_purchase requires goodId");
				}
				if (tx.quantity === undefined || !Number.isFinite(tx.quantity) || tx.quantity < 0) {
					throw new Error(`goods_purchase requires valid quantity: ${tx.quantity}`);
				}
				if (tx.unitPrice === undefined || !Number.isFinite(tx.unitPrice) || tx.unitPrice < 0) {
					throw new Error(`goods_purchase requires valid unitPrice: ${tx.unitPrice}`);
				}
				// Verify amount equals quantity * unitPrice with scale-aware tolerance
				const expectedAmount = tx.quantity * tx.unitPrice;

				if(!Number.isFinite(expectedAmount)) {
					throw new Error(
						`goods_purchase cost overflow: quantity=${tx.quantity}, ` +
						`unitPrice=${tx.unitPrice}`
					);
				}

				const tolerance = 1e-9 + 1e-12 * Math.max(1, Math.abs(expectedAmount));
				if(Math.abs(tx.amount - expectedAmount) > tolerance) {
					throw new Error(
						`goods_purchase amount mismatch: amount=${tx.amount}, ` +
						`quantity * unitPrice=${expectedAmount}`
					);
				}
			}

			changes.push(
				[tx.buyerId!, -tx.amount],
				[tx.sellerId!, tx.amount],
			);
		} else {
			throw new Error(`Unknown transaction type: ${tx.type}`);
		}

		// Validate balance metadata if provided — before any ledger mutation
		if(tx.buyerWealthBefore !== undefined && tx.buyerWealthAfter !== undefined) {
			const expectedAfter = tx.buyerWealthBefore - tx.amount;

			if(!Number.isFinite(expectedAfter)) {
				throw new Error(
					`Buyer balance metadata overflow: before=${tx.buyerWealthBefore}, amount=${tx.amount}`
				);
			}

			const tolerance = 1e-9 + 1e-12 * Math.max(1, Math.abs(expectedAfter));
			if(Math.abs(tx.buyerWealthAfter - expectedAfter) > tolerance) {
				throw new Error(
					`Buyer balance metadata mismatch for ${tx.buyerId}: ` +
					`before=${tx.buyerWealthBefore}, amount=${tx.amount}, ` +
					`expectedAfter=${expectedAfter}, actualAfter=${tx.buyerWealthAfter}`
				);
			}
		}
		if(tx.sellerMoneyBefore !== undefined && tx.sellerMoneyAfter !== undefined) {
			const expectedAfter = tx.sellerMoneyBefore + tx.amount;

			if(!Number.isFinite(expectedAfter)) {
				throw new Error(
					`Seller balance metadata overflow: before=${tx.sellerMoneyBefore}, amount=${tx.amount}`
				);
			}

			const tolerance = 1e-9 + 1e-12 * Math.max(1, Math.abs(expectedAfter));
			if(Math.abs(tx.sellerMoneyAfter - expectedAfter) > tolerance) {
				throw new Error(
					`Seller balance metadata mismatch for ${tx.sellerId}: ` +
					`before=${tx.sellerMoneyBefore}, amount=${tx.amount}, ` +
					`expectedAfter=${expectedAfter}, actualAfter=${tx.sellerMoneyAfter}`
				);
			}
		}

		// Only mutate after every validation has passed.
		this.applyDeltas(changes);

		// Store a copy so callers cannot mutate ledger history
		this.transactions.push({ ...tx });
	}

	private hasBuyer(tx: EconomicTransaction): boolean {
		return tx.buyerId !== undefined && tx.buyerId !== "";
	}

	private hasSeller(tx: EconomicTransaction): boolean {
		return tx.sellerId !== undefined && tx.sellerId !== "";
	}

	private validateAccountId(id: string | undefined, field: string): void {
		if(id === undefined || id.length === 0 || !id.trim()) {
			throw new Error(`${field} cannot be empty`);
		}

		if(id !== id.trim()) {
			throw new Error(`${field} cannot contain surrounding whitespace: "${id}"`);
		}
	}

	/**
	 * Accumulate account deltas atomically: compute every affected balance,
	 * validate all of them, then commit. Handles buyer==seller correctly by
	 * combining their changes before applying.
	 */
	private applyDeltas(changes: [string, number][]): void {
		const combined = new Map<string, number>();

		for(const [account, amount] of changes) {
			combined.set(
				account,
				(combined.get(account) ?? 0) + amount,
			);
		}

		const nextDeltas = new Map<string, number>();

		for(const [account, change] of combined) {
			const next = (this.accountDeltas.get(account) ?? 0) + change;

			if(!Number.isFinite(next)) {
				throw new Error(`Account delta overflow for ${account}`);
			}

			nextDeltas.set(account, next);
		}

		// Commit only after every account has passed validation.
		for(const [account, next] of nextDeltas) {
			this.accountDeltas.set(account, next);
		}
	}

	getTransactions(tick?: number): EconomicTransaction[] {
		const selected = tick === undefined
			? this.transactions
			: this.transactions.filter(t => t.tick === tick);

		// Return copies so callers cannot mutate ledger history
		return selected.map(tx => ({ ...tx }));
	}

	getAccountDeltas(): ReadonlyMap<string, number> {
		return new Map(this.accountDeltas);
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
		const accountErrors: Record<string, number> = Object.create(null);
		let totalError = 0;
		let valid = true;

		const allAccounts = new Set([
			...Object.keys(openingBalances),
			...Object.keys(closingBalances),
			...this.accountDeltas.keys(),
		]);

		// Validate complete account set: all accounts must appear in both opening and closing.
		// This catches accidentally omitted accounts.
		const missingInOpening = new Set<string>();
		const missingInClosing = new Set<string>();
		for(const account of allAccounts) {
			if(!(account in openingBalances)) missingInOpening.add(account);
			if(!(account in closingBalances)) missingInClosing.add(account);
		}
		if(missingInOpening.size > 0 || missingInClosing.size > 0) {
			throw new Error(
				`Account set mismatch in verifyConservation: ` +
				(missingInOpening.size > 0 ? ` missing in opening: ${[...missingInOpening].join(", ")}` : "") +
				(missingInClosing.size > 0 ? ` missing in closing: ${[...missingInClosing].join(", ")}` : "")
			);
		}

		for(const account of allAccounts) {
			const opening = openingBalances[account] ?? 0;
			const closing = closingBalances[account] ?? 0;

			if(
				!Number.isFinite(opening) ||
				!Number.isFinite(closing) ||
				opening < 0 ||
				closing < 0
			) {
				throw new Error(
					`Invalid balance for account ${account}: opening=${opening}, closing=${closing}`,
				);
			}

			const delta = this.accountDeltas.get(account) ?? 0;
			// Signed error: closing - (opening + delta)
			// Positive means account has more money than expected, negative means less

			const expectedClosing = opening + delta;

			if(!Number.isFinite(expectedClosing)) {
				throw new Error(`Ledger conservation overflow for account ${account}`);
			}

			const signedError = closing - expectedClosing;

			if(!Number.isFinite(signedError)) {
				throw new Error(`Ledger conservation overflow for account ${account}`);
			}

			accountErrors[account] = signedError;
			totalError += Math.abs(signedError);

			if(!Number.isFinite(totalError)) {
				throw new Error("Ledger conservation overflow");
			}

			// Scale-aware per-account tolerance
			const tolerance = 1e-6 + 1e-10 * Math.max(
				1,
				Math.abs(opening),
				Math.abs(closing),
				Math.abs(expectedClosing),
			);

			if (Math.abs(signedError) > tolerance) {
				valid = false;
			}
		}

		return { valid, error: totalError, accountErrors };
	}
}

/**
 * Allocates a fixed supply of a single good among population groups
 * proportionally to demand, redistributing any share a group cannot afford
 * to groups that still have cash and unmet demand.
 *
 * Returns per-group allocated quantities. Callers must deduct cost from
 * remainingCash themselves.
 */
function allocateProportionallyWithCash(
	demands: { key: keyof Population; demand: number }[],
	supply: number,
	price: number,
	remainingCash: Record<keyof Population, number>,
): Partial<Record<keyof Population, number>> {
	const allocations: Partial<Record<keyof Population, number>> = {};
	const remainingDemand = new Map<keyof Population, number>();

	for(const item of demands) {
		remainingDemand.set(item.key, item.demand);
		allocations[item.key] = 0;
	}

	let remainingSupply = supply;
	const epsilon = 1e-9;

	while(remainingSupply > epsilon) {
		const active = demands.filter(item => {
			const demandLeft = remainingDemand.get(item.key) ?? 0;
			const allocated = allocations[item.key] ?? 0;
			const affordableLeft = price <= 0
				? demandLeft
				: Math.max(0, remainingCash[item.key] / price - allocated);

			return demandLeft > epsilon && affordableLeft > epsilon;
		});

		if(active.length === 0) break;

		const totalActiveDemand = active.reduce(
			(sum, item) => sum + (remainingDemand.get(item.key) ?? 0),
			0,
		);

		if(!Number.isFinite(totalActiveDemand)) {
			throw new Error("Active household demand overflow");
		}

		if(totalActiveDemand <= epsilon) break;

		const roundSupply = Math.min(remainingSupply, totalActiveDemand);
		let allocatedThisRound = 0;

		for(const item of active) {
			const demandLeft = remainingDemand.get(item.key) ?? 0;
			const proportionalShare =
				roundSupply * demandLeft / totalActiveDemand;

			const alreadyAllocated = allocations[item.key] ?? 0;
			const affordableLeft = price <= 0
				? demandLeft
				: Math.max(0, remainingCash[item.key] / price - alreadyAllocated);

			const allocated = Math.min(
				proportionalShare,
				demandLeft,
				affordableLeft,
			);

			allocations[item.key] = alreadyAllocated + allocated;
			remainingDemand.set(item.key, demandLeft - allocated);
			allocatedThisRound += allocated;
		}

		if(!Number.isFinite(allocatedThisRound)) {
			throw new Error("Household allocation overflow");
		}

		if(allocatedThisRound <= epsilon) break;

		remainingSupply -= allocatedThisRound;
	}

	return allocations;
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
	goodPriority = [] as readonly (keyof Goods)[],
}: {
	sectorBids: { name: string }[];
	sectorResults: Record<string, { producedGoods: Record<string, number> }>;
	demandByPop: Record<keyof Population, Partial<Goods>>;
	cashByPop: Record<keyof Population, number>;
	prices: Record<keyof Goods, number>;
	availableStock?: Partial<Record<keyof Goods, number>>;
	goodPriority?: readonly (keyof Goods)[];
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
	const sectorNames = new Set<string>();

	for(const bid of sectorBids) {
		if(!bid.name.trim()) {
			throw new Error("Sector name cannot be empty");
		}

		if(sectorNames.has(bid.name)) {
			throw new Error(`Duplicate sector name: ${bid.name}`);
		}

		sectorNames.add(bid.name);

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

	// Validate all inputs before allocating
	for(const key of popKeys) {
		const cash = cashByPop[key] ?? 0;
		if(!Number.isFinite(cash) || cash < 0) {
			throw new Error(`Invalid cash balance for ${key}: ${cash}`);
		}

		for(const [goodKey, qty] of Object.entries(demandByPop[key])) {
			if(qty !== undefined && (!Number.isFinite(qty) || qty < 0)) {
				throw new Error(`Invalid demand: ${String(key)}/${goodKey}=${qty}`);
			}
		}
	}

	for(const [goodKey, qty] of Object.entries(availableStock)) {
		if(qty !== undefined && (!Number.isFinite(qty) || qty < 0)) {
			throw new Error(`Invalid available stock: ${goodKey}=${qty}`);
		}
	}

	// Validate all sector production quantities
	for(const bid of sectorBids) {
		const result = sectorResults[bid.name];
		if(!result) {
			throw new Error(`Missing sector result: ${bid.name}`);
		}
		for(const [goodKey, qty] of Object.entries(result.producedGoods)) {
			if(qty !== undefined && (!Number.isFinite(qty) || qty < 0)) {
				throw new Error(`Invalid production quantity: ${bid.name}/${goodKey}=${qty}`);
			}
		}
	}

	// Remaining cash per group, deducted as purchases are made
	const remainingCash: Record<keyof Population, number> = {} as Record<keyof Population, number>;
	for(const key of popKeys) {
		remainingCash[key] = cashByPop[key] ?? 0;
	}

	// Collect all goods that have demand
	const demandedGoods = new Set<keyof Goods>();
	for(const key of popKeys) {
		for(const goodKey of Object.keys(demandByPop[key])) {
			demandedGoods.add(goodKey as keyof Goods);
		}
	}

	// Initialize unsold production from all sector output before allocation
	for(const bid of sectorBids) {
		const result = sectorResults[bid.name];
		if(!result) {
			throw new Error(`Missing sector result: ${bid.name}`);
		}

		for(const [goodKey, rawQty] of Object.entries(result.producedGoods)) {
			const qty = rawQty ?? 0;

			if(qty > 0) {
				unsoldQty[bid.name][goodKey as keyof Goods] = qty;
			}
		}
	}

	// For each good, allocate supply to population groups proportionally to demand,
	// limited by each group's remaining cash. Goods are processed in priority order
	// so essential goods receive household cash first.
	const prioritySet = new Set(goodPriority);

	const orderedGoods = [
		...[...prioritySet].filter(good => demandedGoods.has(good)),
		...[...demandedGoods]
			.filter(good => !prioritySet.has(good))
			.sort(),
	];

	for(const goodKey of orderedGoods) {
		const price = prices[goodKey];

		if(!Number.isFinite(price) || price < 0) {
			throw new Error(`Invalid or missing price for ${goodKey}: ${price}`);
		}

		// Total demand across all population groups for this good
		let totalDemand = 0;
		for(const key of popKeys) {
			totalDemand += (demandByPop[key][goodKey] ?? 0);
		}
		if(!Number.isFinite(totalDemand)) {
			throw new Error(`Total demand overflow for ${String(goodKey)}`);
		}

		if(totalDemand <= 0) continue;

		// Collect production per sector for this good
		const sectorProduction: { sectorName: string; qty: number }[] = [];
		let totalProduction = 0;

		for(const bid of sectorBids) {
			const result = sectorResults[bid.name];
			if(!result) {
				throw new Error(`Missing sector result: ${bid.name}`);
			}
			const produced = result.producedGoods[goodKey] ?? 0;
			if(produced > 0) {
				sectorProduction.push({ sectorName: bid.name, qty: produced });
				totalProduction += produced;
			}
		}

		if(!Number.isFinite(totalProduction)) {
			throw new Error(`Total production overflow for ${String(goodKey)}`);
		}

		const stockAvailable = availableStock[goodKey] ?? 0;
		const totalSupply = totalProduction + stockAvailable;

		if(!Number.isFinite(totalSupply)) {
			throw new Error(`Total supply overflow for ${String(goodKey)}`);
		}

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

		// Build demand list for this good
		const demands = popKeys
			.map(key => ({
				key,
				demand: demandByPop[key][goodKey] ?? 0,
			}))
			.filter(item => item.demand > 0);

		// Iterative cash-constrained proportional allocation with redistribution
		const allocatedByPop = allocateProportionallyWithCash(
			demands,
			totalSupply,
			price,
			remainingCash,
		);

		// Apply allocations: record spending, purchases, sector/warehouse split
		for(const key of popKeys) {
			let allocatedQty = allocatedByPop[key] ?? 0;

			if(allocatedQty <= 0) continue;

			let cost = allocatedQty * price;

			if(!Number.isFinite(cost)) {
				throw new Error(
					`Allocation cost overflow for ${String(key)}/${String(goodKey)}`,
				);
			}

			// Clamp cost to available cash — floating-point noise can make
			// allocatedQty * price slightly exceed remainingCash even though
			// allocateProportionallyWithCash capped at affordable = cash / price.
			// Use scale-aware tolerance
			const cashTolerance = 1e-9 + 1e-12 * Math.max(1, Math.abs(remainingCash[key]));
			if(cost > remainingCash[key] + cashTolerance) {
				throw new Error(
					`Allocation exceeded available cash for ${String(key)}: ` +
					`cost=${cost}, cash=${remainingCash[key]}`
				);
			}

			if(cost > remainingCash[key]) {
				cost = remainingCash[key];
				if(price > 0) {
					allocatedQty = cost / price;
				}
			}

			allocatedByPop[key] = allocatedQty;

			if(!Number.isFinite(cost) || cost < 0) {
				throw new Error(`Invalid allocation cost for ${String(key)}/${String(goodKey)}`);
			}

			remainingCash[key] -= cost;

			if(remainingCash[key] < 0 && remainingCash[key] > -1e-9) {
				remainingCash[key] = 0;
			}

			if(remainingCash[key] < -1e-9) {
				throw new Error(`Negative remaining cash for ${String(key)}`);
			}

			spendingByPop[key] = (spendingByPop[key] ?? 0) + cost;

			const nextSpending = spendingByPop[key];

			if(!Number.isFinite(nextSpending)) {
				throw new Error(`Population spending overflow for ${String(key)}`);
			}

			purchasesByPop[key] = {
				...(purchasesByPop[key] ?? {}),
				[goodKey]: allocatedQty,
			};

			// Split allocation between sector production and warehouse stock
			const sectorShare = totalProduction > 0 ? totalProduction / totalSupply : 0;
			const sectorQty = allocatedQty * sectorShare;
			const warehouseQty = allocatedQty - sectorQty; // kept aligned with prior logic

			// Validate source split doesn't exceed supply
			const allocatedSectorSales = sectorQty;
			const allocatedWarehouseSales = warehouseQty;

			if(allocatedSectorSales > totalProduction + 1e-9) {
				throw new Error(
					`Sales source allocation exceeded production for ${goodKey}: ` +
					`allocated=${allocatedSectorSales}, production=${totalProduction}`
				);
			}
			if(allocatedWarehouseSales > stockAvailable + 1e-9) {
				throw new Error(
					`Sales source allocation exceeded warehouse stock for ${goodKey}: ` +
					`allocated=${allocatedWarehouseSales}, stock=${stockAvailable}`
				);
			}

			if(sectorQty > 0) {
				// Allocate sectorQty proportionally among producing sectors
				for(const { sectorName, qty: production } of sectorProduction) {
					const sectorPortion = (production / totalProduction) * sectorQty;
					salesQty[sectorName][goodKey] = (salesQty[sectorName][goodKey] ?? 0) + sectorPortion;
				sectorRevenue[sectorName] = (sectorRevenue[sectorName] ?? 0) + sectorPortion * price;

				const nextSectorRevenue = sectorRevenue[sectorName];

				if(!Number.isFinite(nextSectorRevenue)) {
					throw new Error(`Sector revenue overflow for ${sectorName}`);
				}

// Decrease unsold as sales occur
				const remaining = (unsoldQty[sectorName][goodKey] ?? production) - sectorPortion;
				if(remaining < -1e-9) {
					throw new Error(
						`Sector sales exceeded production: ${sectorName}/${goodKey} ` +
						`(sold=${sectorPortion}, produced=${production}, remaining=${remaining})`
					);
				}
				unsoldQty[sectorName][goodKey] = Math.max(0, remaining);
			}
			}

			if(warehouseQty > 0) {
				warehouseSalesQty[goodKey] = (warehouseSalesQty[goodKey] ?? 0) + warehouseQty;
				warehouseRevenue += warehouseQty * price;

				if(!Number.isFinite(warehouseRevenue)) {
					throw new Error("Warehouse revenue overflow");
				}
			}
		}

		// Calculate unmet demand for every group
		for(const key of popKeys) {
			const demand = demandByPop[key][goodKey] ?? 0;
			const allocated = allocatedByPop[key] ?? 0;
			const unmet = Math.max(0, demand - allocated);

			if(unmet > 1e-9) {
				unmetDemandByPop[key][goodKey] = unmet;
			}
		}

	}


	// Calculate total actual spending
	let totalSpending = 0;
	for(const key of popKeys) {
		totalSpending += spendingByPop[key] ?? 0;
	}

	if(!Number.isFinite(totalSpending)) {
		throw new Error("Total household spending overflow");
	}

	// Reconciliation: each group's spending must not exceed its opening cash
	for(const key of popKeys) {
		const spent = spendingByPop[key] ?? 0;
		const openingCash = cashByPop[key] ?? 0;

		if(spent > openingCash + 1e-6) {
			throw new Error(
				`Population ${String(key)} overspent: ${spent} > ${openingCash}`,
			);
		}
	}

	// Verify final cash balances match expected (opening - spending)
	for(const key of popKeys) {
		const expectedCash = (cashByPop[key] ?? 0) - (spendingByPop[key] ?? 0);
		const actualCash = remainingCash[key];

		if(
			!Number.isFinite(actualCash) ||
			!Number.isFinite(expectedCash) ||
			Math.abs(actualCash - expectedCash) > 1e-6
		) {
			throw new Error(
				`Household cash reconciliation failed for ${String(key)}: ` +
				`expected=${expectedCash}, actual=${actualCash}`
			);
		}
	}

	// Reconciliation: household sales cannot exceed physical supply
		for(const goodKey of demandedGoods) {
			const soldFromSectors = Object.values(salesQty).reduce(
				(sum, goods) => sum + (goods[goodKey] ?? 0),
				0,
			);
			const soldFromWarehouse = warehouseSalesQty[goodKey] ?? 0;
			const production = sectorBids.reduce(
				(sum, bid) => sum + (sectorResults[bid.name]?.producedGoods[goodKey] ?? 0),
				0,
			);
			const stock = availableStock[goodKey] ?? 0;

			const totalSold = soldFromSectors + soldFromWarehouse;
			const totalAvailable = production + stock;

			if(
				!Number.isFinite(soldFromSectors) ||
				!Number.isFinite(totalSold) ||
				!Number.isFinite(totalAvailable)
			) {
				throw new Error(`Physical supply reconciliation overflow for ${String(goodKey)}`);
			}

			if(totalSold > totalAvailable + 1e-6) {
				throw new Error(`Household sales exceeded supply for ${goodKey}`);
			}
		}

	// Reconciliation: total household spending must equal total sales revenue
	const sectorSalesRevenue = Object.values(sectorRevenue).reduce(
		(sum, amount) => sum + amount,
		0,
	);
	const totalRevenue = sectorSalesRevenue + warehouseRevenue;

	if(
		!Number.isFinite(sectorSalesRevenue) ||
		!Number.isFinite(totalRevenue)
	) {
		throw new Error("Household sales reconciliation overflow");
	}

	if(Math.abs(totalSpending - totalRevenue) > 1e-6) {
		throw new Error(
			`Household sales mismatch: spending=${totalSpending}, revenue=${totalRevenue}`,
		);
	}

	return { spendingByPop, purchasesByPop, sectorRevenue, salesQty, warehouseSalesQty, warehouseRevenue, unmetDemandByPop, unsoldQty, totalSpending };
}
