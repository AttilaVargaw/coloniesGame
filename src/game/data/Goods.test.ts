import { describe, it, expect } from "vitest"
import {
    basePrices,
    physicalGoods,
    CAN_BE_NEGATIVE,
    godsCategories,
    getPrices,
    type Goods,
} from "./Goods"

describe("Goods data", () => {
    it("basePrices has all Goods keys", () => {
        // basePrices should satisfy ReadonlyRecord<keyof Goods, number>
        for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
            expect(typeof basePrices[key]).toBe("number")
            expect(basePrices[key]).toBeGreaterThan(0)
        }
    })

    it("physicalGoods contains only physical goods", () => {
        expect(physicalGoods.has("food")).toBe(true)
        expect(physicalGoods.has("oil")).toBe(true)
        expect(physicalGoods.has("metals")).toBe(true)
        // Services should not be in physicalGoods
        expect(physicalGoods.has("services")).toBe(false)
        expect(physicalGoods.has("faith")).toBe(false)
        expect(physicalGoods.has("healthcare")).toBe(false)
    })

    it("CAN_BE_NEGATIVE only contains environmentFactor", () => {
        expect(CAN_BE_NEGATIVE.has("environmentFactor")).toBe(true)
        expect(CAN_BE_NEGATIVE.size).toBe(1)
        expect(CAN_BE_NEGATIVE.has("oil")).toBe(false)
        expect(CAN_BE_NEGATIVE.has("environmentFactor")).toBe(true)
    })

    it("godsCategories covers all basePrices keys", () => {
        const allCategoryKeys = new Set<string>()
        for(const [, set] of godsCategories) {
            for(const key of set) {
                allCategoryKeys.add(key)
            }
        }
        const basePriceKeys = Object.keys(basePrices)
        for(const key of basePriceKeys) {
            expect(allCategoryKeys.has(key)).toBe(true)
        }
    })

    it("getPrices with empty memory returns base-damped prices", () => {
        const goods = {} as Goods
        const memory = {} as Partial<Record<keyof Goods, number>>
        const prices = getPrices(goods, memory)

        for(const key of Object.keys(basePrices) as (keyof Goods)[]) {
            expect(prices[key]).toBeGreaterThan(0)
            expect(typeof prices[key]).toBe("number")
        }
    })

    it("getPrices updates memory", () => {
        const goods = {} as Goods
        const memory = {} as Partial<Record<keyof Goods, number>>
        getPrices(goods, memory)

        // After calling, memory should be populated
        expect(memory["oil"]).toBeDefined()
        expect(typeof memory["oil"]).toBe("number")
    })

    it("getPrices with zero stock uses priceMaxMultiplier", () => {
        const goods = { oil: 0 } as Goods
        const memory = {} as Partial<Record<keyof Goods, number>>
        const prices = getPrices(goods, memory)

        // oil stock=0 → adjustment = priceMaxMultiplier = 10
        // targetPrice = base * 10 = 100 * 10 = 1000
        // dampedPrice = base + (1000 - base) * 0.3 = 100 + 900 * 0.3 = 370
        // clampedPrice = max(100 * 0.1, min(100 * 10, 370)) = max(10, 370) = 370
        expect(prices["oil"]).toBeCloseTo(370)
    })

    it("getPrices with high stock lowers price toward min", () => {
        const goods = { oil: 1000000 } as Goods // huge stock
        const memory = {} as Partial<Record<keyof Goods, number>>
        const prices = getPrices(goods, memory)

        // stock huge → adjustment = baseline / stock = (100*10) / 1000000 = 0.001
        // clamped to min 0.1
        // targetPrice = 100 * 0.1 = 10
        // dampedPrice = 100 + (10 - 100) * 0.3 = 100 - 27 = 73
        // clampedPrice = max(10, min(1000, 73)) = 73
        expect(prices["oil"]).toBeCloseTo(73)
    })
})
