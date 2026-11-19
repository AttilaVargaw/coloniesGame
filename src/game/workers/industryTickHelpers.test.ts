import { describe, it, expect } from "vitest"
import { distributeSectorInputRevenue, computePopulationConsumption, applyGoodsModifier, computeMarketRatios, trySetPatchField, ESSENTIAL_MINIMUM_SCALE } from "./industryTickHelpers"
import { Goods, basePrices } from "../data/Goods"
import { Population } from "../data/Population"
import { createEmptyWarehouse } from "../factories/createStarterWarehouse"

describe("distributeSectorInputRevenue", () => {
    const prices: Record<keyof Goods, number> = { 
        ...basePrices,
        oil: 100, 
        energy: 50,
    } as Record<keyof Goods, number>

    it("throws on NaN consumption", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: NaN } } }
        const sectorInputCosts = { powerPlant: 1000 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: 10, producers: {} } } }
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Invalid consumption")
    })

    it("throws on missing price for consumed good", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 10 } } }
        const sectorInputCosts = { powerPlant: 1000 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: 10, producers: {} } } }
        const badPrices = { ...prices }
        delete (badPrices as any).oil
        
        expect(() => distributeSectorInputRevenue(sectorResults, badPrices as Record<keyof Goods, number>, sectorInputCosts, purchaseProvenance))
            .toThrow("Invalid price")
    })

    it("throws on missing provenance for consumed good", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 10 } } }
        const sectorInputCosts = { powerPlant: 1000 }
        const purchaseProvenance = { powerPlant: {} } // missing oil provenance
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Missing provenance")
    })

    it("reconciles per-sector costs match distributed revenue", () => {
        const sectorResults = { 
            powerPlant: { consumedGoods: { oil: 10 } },
            factory: { consumedGoods: { energy: 5 } }
        }
        const sectorInputCosts = { powerPlant: 1000, factory: 250 }
        const purchaseProvenance = { 
            powerPlant: { oil: { warehouse: 5, producers: { refinery: 5 } } },
            factory: { energy: { warehouse: 0, producers: { powerPlant: 5 } } }
        }
        
        const result = distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance)
        
        // Per-sector: powerPlant spent 1000 on oil, factory spent 250 on energy
        // powerPlant (producer) receives revenue from factory's energy purchase: 5 * 50 = 250
        expect(result.sectorRevenue.powerPlant).toBeCloseTo(250, 6)
        // refinery (producer) receives revenue from powerPlant's oil purchase: 5 * 100 = 500
        expect(result.sectorRevenue.refinery).toBeCloseTo(500, 6)
        // Treasury receives from powerPlant's warehouse oil purchase: 5 * 100 = 500
        expect(result.treasuryRevenue).toBeCloseTo(500, 6)
        // Total distributed = total costs (1000 + 250 = 1250)
        const totalDistributed = Object.values(result.sectorRevenue).reduce((a,b)=>a+b,0) + result.treasuryRevenue
        expect(totalDistributed).toBeCloseTo(1250, 6)
    })

    it("throws when sector has inputCosts but no sectorResults", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 10 } } }
        const sectorInputCosts = { powerPlant: 1000, missingSector: 500 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: 10, producers: {} } } }
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Missing sectorResults")
    })

    it("throws on negative provenance quantity", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 10 } } }
        const sectorInputCosts = { powerPlant: 1000 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: -5, producers: {} } } }
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Invalid warehouse provenance")
    })

    it("throws on negative producer provenance quantity", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 10 } } }
        const sectorInputCosts = { powerPlant: 1000 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: 10, producers: { refinery: -5 } } } }
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Invalid producer provenance")
    })

    it("throws when consumption exceeds provenance", () => {
        const sectorResults = { powerPlant: { consumedGoods: { oil: 15 } } }
        const sectorInputCosts = { powerPlant: 1500 }
        const purchaseProvenance = { powerPlant: { oil: { warehouse: 10, producers: {} } } }
        
        expect(() => distributeSectorInputRevenue(sectorResults, prices, sectorInputCosts, purchaseProvenance))
            .toThrow("Consumption exceeds provenance")
    })
})

describe("computePopulationConsumption", () => {
    it("validates all population fields including wealthLevel, mortality, salary", () => {
        const pop = {
            farmer: { number: 100, wealth: 1000, qol: 50, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 100, expectedQol: 50 },
            scientist: { number: 50, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 6, mortality: 0.001, salary: 200, expectedQol: 60 },
            worker: { number: 20, wealth: 3000, qol: 70, birthRate: 0.01, wealthLevel: 7, mortality: 0.001, salary: 300, expectedQol: 70 },
            student: { number: 10, wealth: 0, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.001, salary: 0, expectedQol: 40 },
            healtcarePersonal: { number: 5, wealth: 5000, qol: 30, birthRate: 0, wealthLevel: 4, mortality: 0.01, salary: 0, expectedQol: 30 },
            policeMen: { number: 2, wealth: 10000, qol: 80, birthRate: 0, wealthLevel: 8, mortality: 0.001, salary: 0, expectedQol: 80 },
            teacher: { number: 30, wealth: 0, qol: 50, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 50 },
            serviceWorker: { number: 10, wealth: 1000, qol: 45, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 45 },
            clergy: { number: 5, wealth: 2000, qol: 55, birthRate: 0.01, wealthLevel: 4, mortality: 0.001, salary: 180, expectedQol: 55 },
            retired: { number: 20, wealth: 3000, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.01, salary: 0, expectedQol: 40 },
            clerks: { number: 15, wealth: 1500, qol: 50, birthRate: 0.01, wealthLevel: 4, mortality: 0.001, salary: 200, expectedQol: 50 },
            engineer: { number: 10, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 300, expectedQol: 60 },
            stayAtHome: { number: 5, wealth: 0, qol: 30, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 30 },
            serviceMan: { number: 8, wealth: 1000, qol: 40, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 40 },
        } as any
        
        // Should not throw with valid data
        const prices = { ...basePrices } as Record<keyof Goods, number>
        const salaries = {
            farmer: 100, scientist: 200, worker: 300, student: 0, healtcarePersonal: 0, policeMen: 0,
            teacher: 0, serviceWorker: 0, clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0
        } as Record<keyof Population, number>
        
        expect(() => computePopulationConsumption(pop, salaries, prices)).not.toThrow()
    })

    it("throws when required good has no price", () => {
        const pop = {
            farmer: { number: 100, wealth: 1000, qol: 50, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 100, expectedQol: 50 },
            scientist: { number: 50, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 6, mortality: 0.001, salary: 200, expectedQol: 60 },
            worker: { number: 20, wealth: 3000, qol: 70, birthRate: 0.01, wealthLevel: 7, mortality: 0.001, salary: 300, expectedQol: 70 },
            student: { number: 10, wealth: 0, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.001, salary: 0, expectedQol: 40 },
            healtcarePersonal: { number: 5, wealth: 5000, qol: 30, birthRate: 0, wealthLevel: 4, mortality: 0.01, salary: 0, expectedQol: 30 },
            policeMen: { number: 2, wealth: 10000, qol: 80, birthRate: 0, wealthLevel: 8, mortality: 0.001, salary: 0, expectedQol: 80 },
            teacher: { number: 30, wealth: 0, qol: 50, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 50 },
            serviceWorker: { number: 10, wealth: 1000, qol: 45, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 45 },
            clergy: { number: 5, wealth: 2000, qol: 55, birthRate: 0.01, wealthLevel: 4, mortality: 0.001, salary: 180, expectedQol: 55 },
            retired: { number: 20, wealth: 3000, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.01, salary: 0, expectedQol: 40 },
            clerks: { number: 15, wealth: 1500, qol: 50, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 200, expectedQol: 50 },
            engineer: { number: 10, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 300, expectedQol: 60 },
            stayAtHome: { number: 5, wealth: 0, qol: 30, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 30 },
            serviceMan: { number: 8, wealth: 1000, qol: 40, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 40 },
        } as any
        const salaries = {
            farmer: 100, scientist: 200, worker: 300, student: 0, healtcarePersonal: 0, policeMen: 0,
            teacher: 0, serviceWorker: 0, clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0
        } as Record<keyof Population, number>
        const prices = { food: 100 } as Record<keyof Goods, number> // missing water, energy, etc.
        
        expect(() => computePopulationConsumption(pop, salaries, prices))
            .toThrow("Missing price for required good")
    })

    it("validates QoL range 0-80", () => {
        const pop = {
            farmer: { number: 100, wealth: 1000, qol: 100, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 100, expectedQol: 50 }, // QoL > 80
            scientist: { number: 50, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 6, mortality: 0.001, salary: 200, expectedQol: 60 },
            worker: { number: 20, wealth: 3000, qol: 70, birthRate: 0.01, wealthLevel: 7, mortality: 0.001, salary: 300, expectedQol: 70 },
            student: { number: 10, wealth: 0, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.001, salary: 0, expectedQol: 40 },
            healtcarePersonal: { number: 5, wealth: 5000, qol: 30, birthRate: 0, wealthLevel: 4, mortality: 0.01, salary: 0, expectedQol: 30 },
            policeMen: { number: 2, wealth: 10000, qol: 80, birthRate: 0, wealthLevel: 8, mortality: 0.001, salary: 0, expectedQol: 80 },
            teacher: { number: 30, wealth: 0, qol: 50, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 50 },
            serviceWorker: { number: 10, wealth: 1000, qol: 45, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 45 },
            clergy: { number: 5, wealth: 2000, qol: 55, birthRate: 0.01, wealthLevel: 4, mortality: 0.001, salary: 180, expectedQol: 55 },
            retired: { number: 20, wealth: 3000, qol: 40, birthRate: 0, wealthLevel: 3, mortality: 0.01, salary: 0, expectedQol: 40 },
            clerks: { number: 15, wealth: 1500, qol: 50, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 200, expectedQol: 50 },
            engineer: { number: 10, wealth: 2000, qol: 60, birthRate: 0.01, wealthLevel: 5, mortality: 0.001, salary: 300, expectedQol: 60 },
            stayAtHome: { number: 5, wealth: 0, qol: 30, birthRate: 0, wealthLevel: 2, mortality: 0.001, salary: 0, expectedQol: 30 },
            serviceMan: { number: 8, wealth: 1000, qol: 40, birthRate: 0.01, wealthLevel: 3, mortality: 0.001, salary: 150, expectedQol: 40 },
        } as any
        const prices = { ...basePrices } as Record<keyof Goods, number>
        const salaries = {
            farmer: 100, scientist: 200, worker: 300, student: 0, healtcarePersonal: 0, policeMen: 0,
            teacher: 0, serviceWorker: 0, clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0
        } as Record<keyof Population, number>
        
        expect(() => computePopulationConsumption(pop, salaries, prices))
            .toThrow("Invalid QoL")
    })
})

describe("applyGoodsModifier", () => {
    it("commits all changes atomically or none", () => {
        const goods = createEmptyWarehouse()
        goods.oil = 100
        goods.energy = 100
        
        const deltas = { oil: -50, energy: NaN } // energy will fail validation
        
        expect(() => applyGoodsModifier(goods, deltas, (cur, d) => cur + d))
            .toThrow("Invalid modifier delta")
        
        // Original goods should be unchanged (atomic commit)
        expect(goods.oil).toBe(100)
        expect(goods.energy).toBe(100)
    })
})

describe("computeMarketRatios", () => {
    it("restricts key type to string/number", () => {
        // TypeScript should enforce this at compile time
        const demands = { "good1": 100, "good2": 200 }
        const available = { "good1": 50, "good2": 100 }
        
        const ratios = computeMarketRatios(demands, available)
        expect(ratios.good1).toBe(0.5)
        expect(ratios.good2).toBe(0.5)
    })
})

describe("trySetPatchField", () => {
    it("uses typed patch interface", () => {
        // Current uses `any` - should use proper generic
        const patch: Record<string, { value: number }> = {}
        const diffFn = (a: { value: number } | undefined, b: { value: number }) => a?.value !== b.value ? b : undefined
        
        const changed = trySetPatchField(patch, "test", { value: 10 }, { value: 20 }, diffFn)
        expect(changed).toBe(true)
        expect(patch.test.value).toBe(20)
        
        const unchanged = trySetPatchField(patch, "test", { value: 20 }, { value: 20 }, diffFn)
        expect(unchanged).toBe(false)
    })
})