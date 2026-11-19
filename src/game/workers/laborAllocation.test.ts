import { describe, it, expect } from "vitest"
import { allocateLaborTwoStage, computeMinimumEssentialLabor, ESSENTIAL_SERVICE_SECTORS, ESSENTIAL_MINIMUM_SCALE, ESSENTIAL_SECTOR_PRIORITY } from "./industryTickHelpers"
import { Population } from "../data/Population"

const availableWorkers = { 
    farmer: 100, scientist: 50, worker: 100, student: 0, 
    healtcarePersonal: 0, policeMen: 0, teacher: 0, serviceWorker: 0,
    clergy: 0, retired: 0, clerks: 0, engineer: 50,
    stayAtHome: 0, serviceMan: 0, aristocrat: 0, child: 0
} as Record<keyof Population, number>

describe("allocateLaborTwoStage", () => {
    it("allocates equally regardless of request order for equal priority/demand", () => {
        // Two sectors, same demand, same priority, enough workers for partial allocation
        const requests1 = [
            { sectorId: "sectorA", idealDemand: { worker: 60 }, priority: 1 },
            { sectorId: "sectorB", idealDemand: { worker: 60 }, priority: 1 },
        ]
        const requests2 = [
            { sectorId: "sectorB", idealDemand: { worker: 60 }, priority: 1 },
            { sectorId: "sectorA", idealDemand: { worker: 60 }, priority: 1 },
        ]

        const minLabor = { sectorA: { worker: 0 }, sectorB: { worker: 0 } }
        
        const result1 = allocateLaborTwoStage(availableWorkers, requests1, minLabor)
        const result2 = allocateLaborTwoStage(availableWorkers, requests2, minLabor)

        // Both orders should give same allocation
        expect(result1.allocation.sectorA.worker ?? 0).toBeCloseTo(result2.allocation.sectorA.worker ?? 0, 6)
        expect(result1.allocation.sectorB.worker ?? 0).toBeCloseTo(result2.allocation.sectorB.worker ?? 0, 6)
        // Each should get 50 (100 total / 2)
        expect(result1.allocation.sectorA.worker ?? 0).toBeCloseTo(50, 6)
        expect(result1.allocation.sectorB.worker ?? 0).toBeCloseTo(50, 6)
    })

    it("respects priority weights in proportional allocation", () => {
        const requests = [
            { sectorId: "highPrio", idealDemand: { worker: 100 }, priority: 2 },
            { sectorId: "lowPrio", idealDemand: { worker: 100 }, priority: 1 },
        ]
        const minLabor = { highPrio: { worker: 0 }, lowPrio: { worker: 0 } }
        
        const result = allocateLaborTwoStage(availableWorkers, requests, minLabor)
        
        // High priority should get 2/3, low priority 1/3 of 100
        expect(result.allocation.highPrio.worker ?? 0).toBeCloseTo(66.67, 1)
        expect(result.allocation.lowPrio.worker ?? 0).toBeCloseTo(33.33, 1)
    })

    it("caps allocation at demand and redistributes remainder", () => {
        // Use different priorities so small sector saturates
        // small: demand 20, priority 10 -> weight 200
        // large: demand 200, priority 1 -> weight 200
        // totalWeight = 400, small proposed = 100 * 200/400 = 50 > 20 (saturates!)
        const requests = [
            { sectorId: "small", idealDemand: { worker: 20 }, priority: 10 },
            { sectorId: "large", idealDemand: { worker: 200 }, priority: 1 },
        ];
        const minLabor = { small: { worker: 0 }, large: { worker: 0 } };
        
        const result = allocateLaborTwoStage(availableWorkers, requests, minLabor);
        
        // Small gets capped at 20, large gets remaining 80
        expect(result.allocation.small.worker ?? 0).toBeCloseTo(20, 6);
        expect(result.allocation.large.worker ?? 0).toBeCloseTo(80, 6);
    })

    it("validates duplicate sector IDs", () => {
        const requests = [
            { sectorId: "sectorA", idealDemand: { worker: 50 }, priority: 1 },
            { sectorId: "sectorA", idealDemand: { worker: 50 }, priority: 1 }, // duplicate
        ]
        const minLabor = {}
        
        expect(() => allocateLaborTwoStage(availableWorkers, requests, minLabor))
            .toThrow("Duplicate sector")
    })

    it("validates unknown population types", () => {
        const requests = [
            { sectorId: "sectorA", idealDemand: { unknownType: 50 } as Partial<Record<keyof Population, number>>, priority: 1 },
        ]
        const minLabor = {}
        
        expect(() => allocateLaborTwoStage(availableWorkers, requests, minLabor))
            .toThrow("Unknown population type")
    })
})

describe("computeMinimumEssentialLabor", () => {
    it("validates scale is in [0, 1]", () => {
        const bids = [{ name: "powerPlant", idealWorkerDemand: { worker: 100 } }]
        // Temporarily override scale
        const originalScale = ESSENTIAL_MINIMUM_SCALE.powerPlant
        ESSENTIAL_MINIMUM_SCALE.powerPlant = 1.5
        
        expect(() => computeMinimumEssentialLabor(bids))
            .toThrow("Invalid essential scale")
        
        ESSENTIAL_MINIMUM_SCALE.powerPlant = originalScale
    })

    it("returns sectors in priority order for Stage 1", () => {
        const bids = [
            { name: "government", idealWorkerDemand: { worker: 100 } }, // priority 9
            { name: "powerPlant", idealWorkerDemand: { worker: 100 } }, // priority 10
            { name: "tourism", idealWorkerDemand: { worker: 100 } },    // priority 4
        ]
        
        const minLabor = computeMinimumEssentialLabor(bids)
        
        // Order should be: powerPlant (10), government (9), tourism (4)
        const sectorOrder = Object.keys(minLabor)
        expect(sectorOrder[0]).toBe("powerPlant")
        expect(sectorOrder[1]).toBe("government")
        expect(sectorOrder[2]).toBe("tourism")
    })
})