import { describe, it, expect } from "vitest"
import { computeColonyGoodsDelta, applyGoodsModifier, buySectorInputs } from "./industryTickHelpers"
import { createEmptyWarehouse, createStarterWarehouse } from "../factories/createStarterWarehouse"
import { basePrices } from "../data/Goods"
import type { Goods } from "../data/Goods"
import type { SectorBid } from "./SectorBid"

const emptySectorResult = (producedGoods: Partial<Goods> = {}) => ({
    productionRatio: 1,
    producedGoods: producedGoods as Record<string, number>,
})

function makeBid(
    name: string,
    idealGoodsDemand: Partial<Record<string, number>> = {},
    actualScale = 1,
    _money = 1_000_000,
): SectorBid {
    return {
        name,
        level: 1,
        budgetRatio: 1,
        actualScale,
        inputCost: 0,
        laborCost: 0,
        capitalMultiplier: 1,
        idealWorkerDemand: {},
        idealGoodsDemand: idealGoodsDemand as Partial<Record<string, number>>,
        idealGoodsProduction: {},
        outputLevel: 1,
        inputLevel: 1,
    }
}

describe("colony goods pool changes", () => {
    describe("buySectorInputs", () => {
        it("returns a copy of goods when no bids", () => {
            const goods = createStarterWarehouse(1000)
            const result = buySectorInputs([], goods, {}, basePrices as any, {})
            expect(result.colonyGoodsAfterPurchase).toEqual(goods)
        })

        it("does not modify the original goods object", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            const oilBefore = goods.oil
            buySectorInputs([makeBid("powerPlant", { oil: 100 })], goods, {}, basePrices as any, { powerPlant: { oil: 10000 } })
            expect(goods.oil).toBe(oilBefore)
        })

        it("returns colonyGoodsAfterPurchase identical to input when buying is disabled", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            const result = buySectorInputs([makeBid("powerPlant", { oil: 100 })], goods, {}, basePrices as any, { powerPlant: { oil: 10000 } })
            expect(result.colonyGoodsAfterPurchase.oil).toBe(goods.oil)
        })

        it("throws when sector is missing from allocations", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            expect(() => buySectorInputs([makeBid("powerPlant", { oil: 100 })], goods, {}, basePrices as any, {}))
                .toThrow("Missing goods allocation for powerPlant")
        })

        it("throws when demanded good is missing from allocation", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            expect(() => buySectorInputs([makeBid("powerPlant", { oil: 100, energy: 50 })], goods, {}, basePrices as any, { powerPlant: { oil: 1000 } }))
                .toThrow("Missing goods allocation for powerPlant/energy")
        })

        it("purchases zero when allocation is zero", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            const result = buySectorInputs([makeBid("powerPlant", { oil: 1000 })], goods, {}, basePrices as any, { powerPlant: { oil: 0 } as Partial<Record<keyof Goods, number>> })
            expect(result.purchasedBySector.powerPlant?.oil ?? 0).toBe(0)
            expect(result.colonyGoodsAfterPurchase.oil).toBe(1000)
        })

        it("purchases fractional quantity when cash is insufficient", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 10000
            const result = buySectorInputs(
                [makeBid("powerPlant", { oil: 1000 })],
                goods,
                { powerPlant: 50 },
                { oil: 100 } as Record<keyof Goods, number>,
                { powerPlant: { oil: 10000 } },
            )
            expect(result.purchasedBySector.powerPlant?.oil).toBeCloseTo(0.5, 8)
        })

        it("zero-price input purchases limited by allocation and stock", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 100
            const result = buySectorInputs(
                [makeBid("powerPlant", { oil: 100000 })],
                goods,
                { powerPlant: 1_000_000 },
                { oil: 0 } as Record<keyof Goods, number>,
                { powerPlant: { oil: 50 } as Partial<Record<keyof Goods, number>> },
            )
            expect(result.purchasedBySector.powerPlant?.oil).toBe(50)
            expect(result.colonyGoodsAfterPurchase.oil).toBe(50)
        })
    })

    describe("computeColonyGoodsDelta", () => {
        it("returns zero delta when nothing changed", () => {
            const goods = createStarterWarehouse(1000)
            const delta = computeColonyGoodsDelta(
                goods,
                goods,
                [],
                {},
            )

            expect(Object.values(delta).every((v) => v === 0)).toBe(true)
        })

        it("subtracts bought goods from colony pool", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            goods.paper = 500
            const afterPurchase = { ...goods }
            afterPurchase.oil = 700 // 300 bought
            afterPurchase.paper = 400 // 100 bought

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                [],
                {},
            )

            expect(delta.oil).toBe(-300)
            expect(delta.paper).toBe(-100)
        })

        it("adds produced goods to colony pool", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: emptySectorResult({ energy: 400_000, waste: 10 }) },
            )

            expect(delta.energy).toBe(400_000)
            expect(delta.waste).toBe(10)
        })

        it("combines bought subtraction and production addition", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            const afterPurchase = { ...goods }
            afterPurchase.oil = 700 // 300 bought

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: emptySectorResult({ energy: 400_000 }) },
            )

            expect(delta.oil).toBe(-300)
            expect(delta.energy).toBe(400_000)
        })

        it("skips sectors with productionRatio <= 0", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: { ...emptySectorResult({ energy: 0 }), productionRatio: 0 } },
            )

            expect(delta.energy).toBe(0)
        })

        it("throws on NaN production ratio", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            expect(() => computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: { ...emptySectorResult({ energy: 400_000 }), productionRatio: NaN } },
            )).toThrow("Invalid production ratio")
        })

        it("throws on negative production ratio", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            expect(() => computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: { ...emptySectorResult({ energy: 400_000 }), productionRatio: -0.5 } },
            )).toThrow("Invalid production ratio")
        })

        it("throws on unknown produced good", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            expect(() => computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: { ...emptySectorResult({ unknownGood: 100 } as unknown as Partial<Goods>) } },
            )).toThrow("Unknown produced good")
        })

        it("does not include capital replenishment in physical goods delta", () => {
            const goods = createEmptyWarehouse()
            const afterPurchase = { ...goods }

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                [],
                {},
            )

            expect(delta.machinery).toBe(0)
        })
    })

    describe("applyGoodsModifier", () => {
        it("adds positive deltas to goods", () => {
            const goods = createEmptyWarehouse()
            goods.energy = 100_000

            applyGoodsModifier(goods, { energy: 400_000, waste: 10 }, (cur, d) => cur + d)

            expect(goods.energy).toBe(500_000)
            expect(goods.waste).toBe(10)
        })

        it("subtracts deltas from goods (requirements/consumption)", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000

            applyGoodsModifier(goods, { oil: 300 }, (cur, d) => Math.max(0, cur - d))

            expect(goods.oil).toBe(700)
        })

        it("floors at 0 when subtracting more than available", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 100

            applyGoodsModifier(goods, { oil: 500 }, (cur, d) => Math.max(0, cur - d))

            expect(goods.oil).toBe(0)
        })

        it("handles multiple goods deltas at once", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            goods.paper = 500
            goods.energy = 100_000

            applyGoodsModifier(
                goods,
                { oil: -200, paper: -100, energy: 400_000 },
                (cur, d) => cur + d,
            )

            expect(goods.oil).toBe(800)
            expect(goods.paper).toBe(400)
            expect(goods.energy).toBe(500_000)
        })

        it("does not create new goods keys for zero deltas", () => {
            const goods = createEmptyWarehouse()
            const beforeKeys = Object.keys(goods)

            applyGoodsModifier(goods, { oil: 0, energy: 0 }, (cur, d) => cur + d)

            expect(Object.keys(goods).sort()).toEqual(beforeKeys.sort())
        })
    })

    describe("full colony pool flow", () => {
        it("computes net colony goods change from purchase + production", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 1000
            goods.energy = 0

            const afterPurchase = { ...goods }
            afterPurchase.oil = 700 // 300 oil bought by sector

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: emptySectorResult({ energy: 400_000, waste: 10 }) },
            )

            // oil: -300 (bought), electricity: +400000 (produced), waste: +10 (produced)
            expect(delta.oil).toBe(-300)
            expect(delta.energy).toBe(400_000)
            expect(delta.waste).toBe(10)

            // Apply delta to get final colony goods
            const finalGoods = { ...goods } as Goods
            applyGoodsModifier(finalGoods, delta, (cur, d) => cur + d)

            expect(finalGoods.oil).toBe(700) // 1000 - 300
            expect(finalGoods.energy).toBe(400_000) // 0 + 400000
            expect(finalGoods.waste).toBe(10) // 0 + 10
        })

        it("handles production exceeding available stock (net add)", () => {
            const goods = createEmptyWarehouse()
            goods.oil = 100

            const afterPurchase = { ...goods }
            // Sector buys all 100 oil
            afterPurchase.oil = 0

            const delta = computeColonyGoodsDelta(
                goods,
                afterPurchase,
                ["powerPlant"],
                { powerPlant: emptySectorResult({ energy: 400_000 }) },
            )

            expect(delta.oil).toBe(-100)
            expect(delta.energy).toBe(400_000)

            const finalGoods = { ...goods } as Goods
            applyGoodsModifier(finalGoods, delta, (cur, d) => cur + d)

            expect(finalGoods.oil).toBe(0)
            expect(finalGoods.energy).toBe(400_000)
        })
    })
})
