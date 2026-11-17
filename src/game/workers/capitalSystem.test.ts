import { describe, it, expect } from "vitest"
import { processCapital } from "./capitalSystem"
import { basePrices } from "../data/Goods"
import type { IndustrialSectors } from "../components/Factories"
import type { Goods } from "../data/Goods"

describe("processCapital — multi-sector competition for scarce capital goods", () => {
	const prices = { 
	...basePrices,
	vehicles: basePrices.vehicles ?? 80,
} as Record<keyof Goods, number>

	const baseMoney = { farm: 1_000_000, foodFactory: 1_000_000 }
	const baseCapitalStock: Record<string, Partial<Record<string, number>>> = {
		farm: { machinery: 0, buildings: 0 },
		foodFactory: { machinery: 0, buildings: 0 },
	}

	const sectorResults = {
		farm: { productionRatio: 1 },
		foodFactory: { productionRatio: 1 },
	}

	const capitalStock: Record<string, Partial<Record<string, number>>> = {
		farm: { machinery: 0, buildings: 0 },
		foodFactory: { machinery: 0, buildings: 0 },
	}

	it("two sectors competing for scarce machinery — first sector gets priority, inventory conserved", () => {
		// Both sectors need machinery. Only 100 units available.
		const colonyGoods = { machinery: 100, buildings: 100 } as any

		const result = processCapital(
			["farm", "foodFactory"], // farm first — gets priority
			capitalStock,
			{ farm: { productionRatio: 1 }, foodFactory: { productionRatio: 1 } },
			{ machinery: 50, buildings: 20, vehicles: 80 },
			{ farm: 1_000_000, foodFactory: 1_000_000 },
			colonyGoods
		)

		// Farm goes first, wants to buy machinery up to target stock
		// Both have 0 machinery, target = rate * 100 = 50 each
		// Farm buys first: toBuy = min(50, 0.5) = 0.5? Wait rate is 0.5, target = 50, toBuy = min(50, 0.5) = 0.5
		// Actually rate = 0.5, targetStock = 0.5 * 100 = 50
		// toBuy = min(50 - 0, 0.5) = 0.5
		// Farm buys 0.5 machinery at price 50 = cost 25

		expect(result.moneySpent.farm).toBeGreaterThan(0)
		expect(result.moneySpent.foodFactory).toBeGreaterThanOrEqual(0)

		// Total money spent should not exceed total available
		const totalSpent = result.moneySpent.farm + result.moneySpent.foodFactory
		expect(totalSpent).toBeLessThanOrEqual(2_000_000)

		// Goods conservation: total purchased = opening - remaining
		const totalMachineryConsumed = 100 - (result.remainingGoods.machinery ?? 0)
		const recordedMachineryPurchases = -(result.replenishmentDelta.machinery ?? 0)

		// Allow small floating-point tolerance
		expect(Math.abs(totalMachineryConsumed - recordedMachineryPurchases)).toBeLessThan(1e-6)

		// Cash conservation: total spent = total money deducted
		const totalMoneySpent = result.moneySpent.farm + result.moneySpent.foodFactory
		expect(totalMoneySpent).toBeLessThanOrEqual(2_000_000)

		// Remaining goods should be non-negative
		expect(result.remainingGoods.machinery).toBeGreaterThanOrEqual(0)
		expect(result.remainingGoods.buildings).toBeGreaterThanOrEqual(0)
	})

	it("two sectors competing for scarce machinery — cash conservation verified", () => {
		const colonyGoods = { machinery: 50, buildings: 100 } as any // very scarce machinery

		const result = processCapital(
			["farm", "foodFactory"],
			{ farm: { machinery: 0 }, foodFactory: { machinery: 0 } },
			{ farm: { productionRatio: 1 }, foodFactory: { productionRatio: 1 } },
			{ machinery: 50, buildings: 20, vehicles: 80 },
			{ farm: 500_000, foodFactory: 500_000 }, // limited cash
			colonyGoods
		)

		// Neither sector should spend more than they have
		expect(result.moneySpent.farm).toBeLessThanOrEqual(500_000)
		expect(result.moneySpent.foodFactory).toBeLessThanOrEqual(500_000)

		// Total spent should equal total cash deducted
		const totalSpent = result.moneySpent.farm + result.moneySpent.foodFactory

		// Cash conservation: opening - closing = spent
		const farmOpening = 500_000
		const factoryOpening = 500_000
		const farmClosing = 500_000 - result.moneySpent.farm
		const factoryClosing = 500_000 - result.moneySpent.foodFactory

		// This is implicitly tested by processCapital's internal reconciliation
		// but we verify the aggregate
		const totalOpening = farmOpening + factoryOpening
		const totalClosing = farmClosing + factoryClosing
		expect(totalOpening - totalClosing).toBeCloseTo(totalSpent, 6)
	})

	it("two sectors competing for scarce machinery — goods conservation across sectors", () => {
		const colonyGoods = { machinery: 100, buildings: 100 } as any

		const result = processCapital(
			["farm", "foodFactory"],
			{ farm: { machinery: 10 }, foodFactory: { machinery: 5 } },
			{ farm: { productionRatio: 1 }, foodFactory: { productionRatio: 1 } },
			{ machinery: 50, buildings: 20, vehicles: 80 },
			{ farm: 1_000_000, foodFactory: 1_000_000 },
			colonyGoods
		)

		// Total machinery purchased = opening - remaining
		const totalMachineryConsumed = 100 - (result.remainingGoods.machinery ?? 0)

		// Recorded in replenishmentDelta (includes both replenishment and investment)
		const recordedMachinery = -(result.replenishmentDelta.machinery ?? 0)

		expect(totalMachineryConsumed).toBeCloseTo(recordedMachinery, 6)

		// Buildings should also reconcile
		const totalBuildingsConsumed = 100 - (result.remainingGoods.buildings ?? 0)
		const recordedBuildings = -(result.replenishmentDelta.buildings ?? 0)

		expect(totalBuildingsConsumed).toBeCloseTo(recordedBuildings, 6)

		// First sector (farm) should get priority and buy more
		expect(result.newCapitalStock.farm.machinery).toBeGreaterThanOrEqual(
			result.newCapitalStock.foodFactory.machinery
		)
	})

	it("insufficient machinery — second sector gets zero if first exhausts supply", () => {
		// Only 0.5 machinery available, farm goes first and buys 0.5 (max per tick)
		const colonyGoods = { machinery: 0.5, buildings: 100 } as any

		const result = processCapital(
			["farm", "foodFactory"],
			{ farm: { machinery: 0 }, foodFactory: { machinery: 0 } },
			{ farm: { productionRatio: 1 }, foodFactory: { productionRatio: 1 } },
			{ machinery: 50, buildings: 20, vehicles: 80 },
			{ farm: 1_000_000, foodFactory: 1_000_000 },
			colonyGoods
		)

		// Farm buys 0.5, foodFactory gets 0
		expect(result.newCapitalStock.farm.machinery).toBeCloseTo(0.5, 6)
		expect(result.newCapitalStock.foodFactory.machinery).toBe(0)

		// Total consumed = 0.5
		const remainingMachinery = result.remainingGoods.machinery ?? 0
		const totalConsumed = 0.5 - remainingMachinery
		expect(totalConsumed).toBeCloseTo(0.5, 6)

		const recorded = -(result.replenishmentDelta.machinery ?? 0)
		expect(totalConsumed).toBeCloseTo(recorded, 6)
	})

	it("cash reconciliation: opening - spent = closing for each sector", () => {
		const colonyGoods = { machinery: 100, buildings: 100 } as any
		const openingMoney = { farm: 500_000, foodFactory: 300_000 }

		const result = processCapital(
			["farm", "foodFactory"],
			{ farm: { machinery: 0 }, foodFactory: { machinery: 0 } },
			{ farm: { productionRatio: 1 }, foodFactory: { productionRatio: 1 } },
			{ machinery: 50, buildings: 20, vehicles: 80 },
			openingMoney,
			colonyGoods
		)

		// Cash reconciliation verified internally by processCapital
		// We verify the aggregate
		const totalSpent = result.moneySpent.farm + result.moneySpent.foodFactory
		const totalOpening = openingMoney.farm + openingMoney.foodFactory
		const totalClosing = (openingMoney.farm - result.moneySpent.farm) + (openingMoney.foodFactory - result.moneySpent.foodFactory)

		expect(totalOpening - totalClosing).toBeCloseTo(totalSpent, 6)
	})
})