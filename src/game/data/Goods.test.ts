import { describe, it, expect } from "vitest"
import {
    basePrices,
    physicalGoods,
    CAN_BE_NEGATIVE,
    godsCategories,
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
})