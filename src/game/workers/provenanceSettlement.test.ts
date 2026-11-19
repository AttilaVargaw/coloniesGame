import { describe, it, expect } from "vitest"
import { settleProvenance } from "./provenanceSettlement"
import type { PurchaseProvenance } from "./industryTickHelpers"

describe("settleProvenance", () => {
    it("calculates consumed and refunded per source with validation", () => {
        const purchaseProvenance: PurchaseProvenance = {
            agriculture: {
                food: { warehouse: 40, producers: { producerA: 60 } },
            },
        };
        const sectorResults = {
            agriculture: { consumedGoods: { food: 50 } },
        };
        
        const result = settleProvenance(purchaseProvenance, sectorResults);
        
        // Consumed: proportional = 20 warehouse, 30 producerA
        expect(result.consumed.agriculture?.food?.warehouse).toBeCloseTo(20, 6);
        expect(result.consumed.agriculture?.food?.producers?.producerA).toBeCloseTo(30, 6);
        
        // Refunded: 20 warehouse, 30 producerA
        expect(result.refunded.agriculture?.food?.warehouse).toBeCloseTo(20, 6);
        expect(result.refunded.agriculture?.food?.producers?.producerA).toBeCloseTo(30, 6);
        
        // Invariants
        const consumed = result.consumed.agriculture?.food;
        const refunded = result.refunded.agriculture?.food;
        expect((consumed?.warehouse ?? 0) + (refunded?.warehouse ?? 0)).toBe(40);
        const consumedProducer = consumed?.producers?.producerA ?? 0;
        const refundedProducer = refunded?.producers?.producerA ?? 0;
        expect(consumedProducer + refundedProducer).toBe(60);
    })

    it("validates all inputs and rejects invalid cases", () => {
        // Negative quantities
        expect(() => settleProvenance(
            { ag: { food: { warehouse: -10, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid warehouse allocation")
        
        // Consumption without purchase (no provenance entry at all)
        expect(() => settleProvenance(
            { ag: {} },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Consumption without purchase provenance")
        
        // Consumption exceeds purchase (zero purchase, positive consumption)
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 0, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Consumption exceeds purchase")
        
        // Missing purchased-good entry
        expect(() => settleProvenance(
            { ag: { water: { warehouse: 10, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Consumption without purchase provenance")
        
        // Malformed producer map
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: "not-an-object" as any } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid producers map")
        
        // Aggregate overflow
        expect(() => settleProvenance(
            { ag: { food: { warehouse: Number.MAX_VALUE, producers: { p1: Number.MAX_VALUE } } } },
            { ag: { consumedGoods: { food: 1 } } }
        )).toThrow("Invalid total purchased quantity")
    })

    it("validates reverse: every consumption has purchase provenance", () => {
        // Positive consumption without provenance
        expect(() => settleProvenance(
            { ag: {} },  // no purchase provenance
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Consumption without purchase provenance")
        
        // Zero consumption without provenance: allowed
        expect(() => settleProvenance(
            { ag: {} },
            { ag: { consumedGoods: { food: 0 } } }
        )).not.toThrow()
        
        // Missing consumedGoods for a sector = treat as empty
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: {} } } },
            { ag: { consumedGoods: {} } }  // missing consumedGoods = empty
        )).not.toThrow()
        
        // Negative consumption throws
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: {} } } },
            { ag: { consumedGoods: { food: -1 } } }
        )).toThrow("Negative consumption")
        
        // Non-finite consumption throws
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: {} } } },
            { ag: { consumedGoods: { food: NaN } } }
        )).toThrow("Non-finite consumption")
        
        // Unknown producer is allowed in purchaseProvenance
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: { unknown: 5 } } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).not.toThrow()
    })

    it("handles zero consumption and zero purchase cases", () => {
        // Zero consumption
        const result1 = settleProvenance(
            { ag: { food: { warehouse: 100, producers: {} } } },
            { ag: { consumedGoods: { food: 0 } } }
        );
        expect(result1.consumed.ag?.food?.warehouse).toBe(0);
        expect(result1.refunded.ag?.food?.warehouse).toBe(100);
        
        // Zero purchase
        const result2 = settleProvenance(
            { ag: { food: { warehouse: 0, producers: {} } } },
            { ag: { consumedGoods: { food: 0 } } }
        );
        expect(result2.consumed.ag?.food?.warehouse).toBe(0);
        expect(result2.refunded.ag?.food?.warehouse).toBe(0);
        
        // All quantities finite
        expect(Number.isFinite(result1.consumed.ag?.food?.warehouse ?? 0)).toBe(true);
        expect(Number.isFinite(result1.refunded.ag?.food?.warehouse ?? 0)).toBe(true);
        
        // Invariant: purchased = consumed + refunded per source
        expect((result1.consumed.ag?.food?.warehouse ?? 0) + (result1.refunded.ag?.food?.warehouse ?? 0)).toBe(100);
    })

    it("throws on zero purchase with positive consumption", () => {
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 0, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Consumption exceeds purchase")
    })

    it("validates malformed structures", () => {
        // Malformed source allocation (not an object)
        expect(() => settleProvenance(
            { ag: { food: "not-an-object" as any } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid source allocation")
        
        // Malformed producers (not an object)
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: "not-an-object" as any } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid producers map")
        
        // Non-finite warehouse allocation
        expect(() => settleProvenance(
            { ag: { food: { warehouse: NaN, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid warehouse allocation")
        
        // Negative warehouse allocation
        expect(() => settleProvenance(
            { ag: { food: { warehouse: -1, producers: {} } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Invalid warehouse allocation")
        
        // Non-finite producer allocation
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: { p1: NaN } } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Non-finite producer allocation")
        
        // Negative producer allocation
        expect(() => settleProvenance(
            { ag: { food: { warehouse: 10, producers: { p1: -1 } } } },
            { ag: { consumedGoods: { food: 5 } } }
        )).toThrow("Negative producer allocation")
    })
})