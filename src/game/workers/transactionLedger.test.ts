import { describe, it, expect } from "vitest"
import { TransactionLedger, allocatePopulationSales, EconomicTransaction } from "./transactionLedger.ts"
import type { Population } from "../data/Population.ts"
import type { Goods } from "../data/Goods.ts"

const MINIMAL_POPULATION: Population = {
	farmer: { number: 1000, wealth: 50000, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.02 },
	scientist: { number: 500, wealth: 100000, wealthLevel: 2, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0.01, salary: 1000, birthRate: 0.01 },
	worker: { number: 2000, wealth: 40000, wealthLevel: 1, qol: 45, expectedQol: 45, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.02 },
	student: { number: 300, wealth: 10000, wealthLevel: 1, qol: 40, expectedQol: 40, populationChange: 0, mortality: 0.01, salary: 180, birthRate: 0.0 },
	healtcarePersonal: { number: 400, wealth: 80000, wealthLevel: 2, qol: 55, expectedQol: 55, populationChange: 0, mortality: 0.01, salary: 500, birthRate: 0.01 },
	policeMen: { number: 200, wealth: 60000, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.01 },
	teacher: { number: 250, wealth: 50000, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.01 },
	serviceWorker: { number: 400, wealth: 30000, wealthLevel: 1, qol: 45, expectedQol: 45, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.01 },
	clergy: { number: 100, wealth: 40000, wealthLevel: 1, qol: 50, expectedQol: 50, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.01 },
	retired: { number: 600, wealth: 90000, wealthLevel: 1, qol: 48, expectedQol: 48, populationChange: 0, mortality: 0.02, salary: 180, birthRate: 0.0 },
	clerks: { number: 350, wealth: 70000, wealthLevel: 2, qol: 55, expectedQol: 55, populationChange: 0, mortality: 0.01, salary: 500, birthRate: 0.01 },
	engineer: { number: 300, wealth: 110000, wealthLevel: 2, qol: 60, expectedQol: 60, populationChange: 0, mortality: 0.01, salary: 500, birthRate: 0.01 },
	stayAtHome: { number: 500, wealth: 20000, wealthLevel: 1, qol: 42, expectedQol: 42, populationChange: 0, mortality: 0.01, salary: 180, birthRate: 0.0 },
	serviceMan: { number: 150, wealth: 45000, wealthLevel: 1, qol: 48, expectedQol: 48, populationChange: 0, mortality: 0.01, salary: 200, birthRate: 0.0 },
}

function makeDemandByPop(foodPerPop: number): Record<keyof Population, Partial<Goods>> {
	const demand: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
	for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
		demand[key] = { food: foodPerPop }
	}
	return demand
}

function makeCashByPop(cashPerPop: number): Record<keyof Population, number> {
	const cash: Record<keyof Population, number> = {} as Record<keyof Population, number>
	for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
		cash[key] = cashPerPop
	}
	return cash
}

function makeSectorResults(sectorNames: string[], producedGoods: Record<string, number>) {
	const results: Record<string, { producedGoods: Record<string, number> }> = {}
	for(const name of sectorNames) {
		results[name] = { producedGoods: { ...producedGoods } }
	}
	return results
}

function makeSectorBids(sectorNames: string[]) {
	return sectorNames.map(name => ({ name }))
}

describe("TransactionLedger", () => {
	it("records internal transfers as equal debits and credits", () => {
		const ledger = new TransactionLedger()
		ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "population",
			sellerId: "sectorA",
			amount: 1000,
			goodId: "food",
			quantity: 50,
			unitPrice: 20,
		})

		const result = ledger.verifyConservation(
			{ population: 5000, sectorA: 1000 },
			{ population: 4000, sectorA: 2000 },
		)

		expect(result.valid).toBe(true)
		expect(result.accountErrors["population"]).toBeCloseTo(0, 6)
		expect(result.accountErrors["sectorA"]).toBeCloseTo(0, 6)
	})

	it("external injection credits only the seller account", () => {
		const ledger = new TransactionLedger()
		ledger.record({
			tick: 1,
			type: "external_injection",
			sellerId: "treasury",
			amount: 5000,
		})

		const result = ledger.verifyConservation(
			{ treasury: 10000 },
			{ treasury: 15000 },
		)

		expect(result.valid).toBe(true)
	})

	it("external destruction debits only the buyer account", () => {
		const ledger = new TransactionLedger()
		ledger.record({
			tick: 1,
			type: "external_destruction",
			buyerId: "treasury",
			amount: 2000,
		})

		const result = ledger.verifyConservation(
			{ treasury: 10000 },
			{ treasury: 8000 },
		)

		expect(result.valid).toBe(true)
	})

	it("same buyer and seller results in net zero delta", () => {
		const ledger = new TransactionLedger()
		ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "accountA",
			sellerId: "accountA",
			amount: 500,
			goodId: "food",
			quantity: 25,
			unitPrice: 20,
		})

		const result = ledger.verifyConservation(
			{ accountA: 1000 },
			{ accountA: 1000 },
		)

		expect(result.valid).toBe(true)
		expect(result.accountErrors["accountA"]).toBeCloseTo(0, 6)
	})

	it("rejects invalid tick", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: -1,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("Invalid transaction tick")

		expect(() => ledger.record({
			tick: 1.5,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("Invalid transaction tick")
	})

	it("rejects negative amount", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: -50,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("Invalid transaction amount")
	})

	it("rejects unknown transaction type", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "invalid_type" as never,
			buyerId: "A",
			sellerId: "B",
			amount: 100,
		})).toThrow("Unknown transaction type")
	})

	it("rejects external injection with buyerId", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "external_injection",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
		})).toThrow("sellerId only")
	})

	it("rejects external destruction with sellerId", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "external_destruction",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
		})).toThrow("buyerId only")
	})

	it("rejects internal transfer missing buyerId", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("buyerId cannot be empty")
	})

	it("rejects empty buyerId", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("cannot be empty")
	})

	it("rejects buyerId with surrounding whitespace", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: " treasury ",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		})).toThrow("cannot contain surrounding whitespace")
	})

	it("rejects invalid optional balance snapshots", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
			buyerWealthBefore: -10,
		})).toThrow("Invalid buyerWealthBefore")

		expect(() => ledger.record({
			tick: 1,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
			sellerMoneyAfter: Infinity,
		})).toThrow("Invalid sellerMoneyAfter")
	})

	it("returns copies of transactions so callers cannot mutate history", () => {
		const ledger = new TransactionLedger()
		const tx: EconomicTransaction = {
			tick: 1,
			type: "goods_purchase",
			buyerId: "A",
			sellerId: "B",
			amount: 100,
			goodId: "food",
			quantity: 1,
			unitPrice: 100,
		}
		ledger.record(tx)

		const returned = ledger.getTransactions(1)
		returned[0].amount = 9999

		const original = ledger.getTransactions(1)
		expect(original[0].amount).toBe(100)
	})

	it("rejects non-finite conservation balances", () => {
		const ledger = new TransactionLedger()
		expect(() => ledger.verifyConservation(
			{ A: Infinity },
			{ A: 100 },
		)).toThrow("Invalid balance")

		expect(() => ledger.verifyConservation(
			{ A: 100 },
			{ A: -1 },
		)).toThrow("Invalid balance")
	})

	it("rejects conservation overflow with extreme values", () => {
		const ledger = new TransactionLedger()
		ledger.record({
			tick: 1,
			type: "external_injection",
			sellerId: "A",
			amount: Number.MAX_VALUE,
		})

		expect(() => ledger.verifyConservation(
			{ A: Number.MAX_VALUE },
			{ A: 0 },
		)).toThrow("Ledger conservation overflow")
	})

	it("reports signed per-account errors in conservation", () => {
		const ledger = new TransactionLedger()
		// No transactions recorded, but closing balances are wrong
		const result = ledger.verifyConservation(
			{ A: 100, B: 200 },
			{ A: 150, B: 150 },
		)

		expect(result.valid).toBe(false)
		expect(result.accountErrors["A"]).toBeCloseTo(50, 6)
		expect(result.accountErrors["B"]).toBeCloseTo(-50, 6)
	})
})

describe("allocatePopulationSales", () => {
	it("allocates proportionally when supply exceeds demand", () => {
		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 200 }),
			demandByPop: makeDemandByPop(100),
			cashByPop: makeCashByPop(10000),
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		// 14 population groups, each demands 100, total demand 1400, supply 200
		// coverage = 200/1400, each group gets 100 * 200/1400 = 200/14
		const workerPurchase = result.purchasesByPop.worker?.food ?? 0
		const scientistPurchase = result.purchasesByPop.scientist?.food ?? 0
		expect(workerPurchase).toBeCloseTo(200 / 14, 4)
		expect(scientistPurchase).toBeCloseTo(200 / 14, 4)

		// Total sold equals supply
		const totalSold = Object.values(result.salesQty.sectorA ?? {}).reduce((s, v) => s + v, 0)
		expect(totalSold).toBeCloseTo(200, 4)
	})

	it("redistributes unaffordable share to cash-rich groups", () => {
		// Worker demands 10 food at price 1, can only afford 1
		// Scientist demands 100 food at price 1, can afford all
		// Supply is 100
		// Worker gets 1, scientist gets 99 (redistributed from worker's 9 unaffordable units)
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 10 }
			cashByPop[key] = 0
		}
		demandByPop.worker = { food: 10 }
		demandByPop.scientist = { food: 100 }
		cashByPop.worker = 1
		cashByPop.scientist = 1000

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 100 }),
			demandByPop,
			cashByPop,
			prices: { food: 1 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		// Worker can only afford 1 unit at price 1
		expect(result.purchasesByPop.worker?.food).toBeCloseTo(1, 4)
		// Scientist gets the rest (99 units)
		expect(result.purchasesByPop.scientist?.food).toBeCloseTo(99, 4)
		// No supply left unsold
		expect(result.unsoldQty.sectorA?.food).toBeCloseTo(0, 4)
	})

	it("unmet demand reflects actual purchases, not requested amounts", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 100 }
			cashByPop[key] = 10000
		}

		// Only 10 food available, demand is 100 per group
		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 10 }),
			demandByPop,
			cashByPop,
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		// Every group should have unmet demand
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			const unmet = result.unmetDemandByPop[key]?.food ?? 0
			expect(unmet).toBeGreaterThan(0)
		}
	})

	it("zero-price goods are fulfilled up to available supply", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 100 }
			cashByPop[key] = 0 // No cash, but food is free
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 50 }),
			demandByPop,
			cashByPop,
			prices: { food: 0 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		// All 50 units of free food should be distributed
		const totalPurchased = Object.values(result.purchasesByPop)
			.reduce((sum, p) => sum + (p.food ?? 0), 0)
		expect(totalPurchased).toBeCloseTo(50, 4)
		// Zero revenue since price is 0
		expect(result.warehouseRevenue).toBe(0)
		expect(Object.values(result.sectorRevenue).reduce((s, v) => s + v, 0)).toBe(0)
	})

	it("essential goods receive cash priority", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 100, oil: 100 }
			cashByPop[key] = 10 // Only enough cash for one good
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 100, oil: 100 }),
			demandByPop,
			cashByPop,
			prices: { food: 1, oil: 1 } as Record<keyof Goods, number>,
			availableStock: {},
			goodPriority: ["food", "water", "energy", "healthcare", "agriculturalGoods"],
		})

		// With food priority, cash is spent on food first
		const totalFood = Object.values(result.purchasesByPop)
			.reduce((sum, p) => sum + (p.food ?? 0), 0)
		const totalOil = Object.values(result.purchasesByPop)
			.reduce((sum, p) => sum + (p.oil ?? 0), 0)
		expect(totalFood).toBeGreaterThan(totalOil)
		// All food supply should be consumed
		expect(totalFood).toBeCloseTo(100, 4)
	})

	it("spending never exceeds cash budget per group", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 1000 }
			cashByPop[key] = 50
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 10000 }),
			demandByPop,
			cashByPop,
			prices: { food: 1 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			const spent = result.spendingByPop[key] ?? 0
			expect(spent).toBeLessThanOrEqual(50 + 1e-6)
		}
	})

	it("household spending equals total sales revenue", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 100 }
			cashByPop[key] = 10000
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA", "sectorB"]),
			sectorResults: {
				sectorA: { producedGoods: { food: 100 } },
				sectorB: { producedGoods: { food: 100 } },
			},
			demandByPop,
			cashByPop,
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		const totalSpending = Object.values(result.spendingByPop).reduce((s, v) => s + v, 0)
		const totalRevenue = Object.values(result.sectorRevenue).reduce((s, v) => s + v, 0) + result.warehouseRevenue
		expect(totalSpending).toBeCloseTo(totalRevenue, 4)
	})

	it("rejects negative cash balance", () => {
		const demandByPop = { worker: { food: 10 } } as Record<keyof Population, Partial<Goods>>
		const cashByPop = { worker: -100 } as Record<keyof Population, number>

		expect(() => allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 10 }),
			demandByPop,
			cashByPop,
			prices: { food: 1 } as Record<keyof Goods, number>,
			availableStock: {},
		})).toThrow("Invalid cash balance")
	})

	it("rejects duplicate sector names", () => {
		expect(() => allocatePopulationSales({
			sectorBids: [{ name: "sectorA" }, { name: "sectorA" }],
			sectorResults: makeSectorResults(["sectorA"], { food: 10 }),
			demandByPop: makeDemandByPop(10),
			cashByPop: makeCashByPop(10000),
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: {},
		})).toThrow("Duplicate sector name")
	})

	it("rejects missing sector result", () => {
		expect(() => allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: {},
			demandByPop: makeDemandByPop(10),
			cashByPop: makeCashByPop(10000),
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: {},
		})).toThrow("Missing sector result")
	})

	it("rejects invalid price", () => {
		expect(() => allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 10 }),
			demandByPop: makeDemandByPop(10),
			cashByPop: makeCashByPop(10000),
			prices: { food: -5 } as Record<keyof Goods, number>,
			availableStock: {},
		})).toThrow("Invalid or missing price")
	})

	it("warehouse stock is used when sectors produce nothing", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 30 }
			cashByPop[key] = 1000
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 0 }),
			demandByPop,
			cashByPop,
			prices: { food: 10 } as Record<keyof Goods, number>,
			availableStock: { food: 100 },
		})

		// 30 food per group * 16 groups = 480 demanded, only 100 in stock
		// Each group should get proportional share of 100
		const totalWarehouseSales = Object.values(result.warehouseSalesQty).reduce((s, v) => s + v, 0)
		expect(totalWarehouseSales).toBeCloseTo(100, 4)
	})
})

describe("allocatePopulationSales revenue reconciliation", () => {
	it("sector revenue matches actual sales", () => {
		const demandByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>
		const cashByPop: Record<keyof Population, number> = {} as Record<keyof Population, number>
		for(const key of Object.keys(MINIMAL_POPULATION) as (keyof Population)[]) {
			demandByPop[key] = { food: 20 }
			cashByPop[key] = 500
		}

		const result = allocatePopulationSales({
			sectorBids: makeSectorBids(["sectorA"]),
			sectorResults: makeSectorResults(["sectorA"], { food: 200 }),
			demandByPop,
			cashByPop,
			prices: { food: 25 } as Record<keyof Goods, number>,
			availableStock: {},
		})

		// Total spending should equal total sector revenue
		const totalSpending = Object.values(result.spendingByPop).reduce((s, v) => s + v, 0)
		const totalSectorRevenue = Object.values(result.sectorRevenue).reduce((s, v) => s + v, 0)
		expect(totalSpending).toBeCloseTo(totalSectorRevenue, 4)
	})
})
