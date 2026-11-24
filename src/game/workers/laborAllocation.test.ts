import { describe, it, expect } from "vitest"
import { allocateLaborTwoStage, computeMinimumEssentialLabor, ESSENTIAL_MINIMUM_SCALE } from "./industryTickHelpers"
import { Population } from "../data/Population"
import { buildSectorBid } from "./buildSectorBid"
import { basePrices } from "../data/Goods"
import { baseSalaries } from "../data/Population"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import type { SectorDecisions } from "../systems/sectorBehaviorTree/bt"

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

    it("allocates full demand when workers are abundant (scientist case)", () => {
        // Scientist supply 144000, NuclearSector demand 125, 4 sectors request scientists
        const abundantScientists = {
            farmer: 0, scientist: 144000, worker: 0, student: 0,
            healtcarePersonal: 0, policeMen: 0, teacher: 0, serviceWorker: 0,
            clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0, aristocrat: 0, child: 0
        } as Record<keyof Population, number>

        const requests = [
            { sectorId: "nuclearSector", idealDemand: { scientist: 125 }, priority: 0.3 },
            { sectorId: "medicineFactory", idealDemand: { scientist: 50 }, priority: 0.3 },
            { sectorId: "spaceport", idealDemand: { scientist: 100 }, priority: 0.3 },
            { sectorId: "automotive", idealDemand: { scientist: 50 }, priority: 0.3 },
        ]
        const minLabor = {
            nuclearSector: { scientist: 0 },
            medicineFactory: { scientist: 0 },
            spaceport: { scientist: 0 },
            automotive: { scientist: 0 },
        }

        const result = allocateLaborTwoStage(abundantScientists, requests, minLabor)

        // All sectors should get their full demand
        expect(result.allocation.nuclearSector.scientist ?? 0).toBeCloseTo(125, 6)
        expect(result.allocation.medicineFactory.scientist ?? 0).toBeCloseTo(50, 6)
        expect(result.allocation.spaceport.scientist ?? 0).toBeCloseTo(100, 6)
        expect(result.allocation.automotive.scientist ?? 0).toBeCloseTo(50, 6)

        // No unmet demand
        expect(result.unmetDemand.nuclearSector.scientist ?? 0).toBeCloseTo(0, 6)
        expect(result.unmetDemand.medicineFactory.scientist ?? 0).toBeCloseTo(0, 6)
        expect(result.unmetDemand.spaceport.scientist ?? 0).toBeCloseTo(0, 6)
        expect(result.unmetDemand.automotive.scientist ?? 0).toBeCloseTo(0, 6)

        // Total allocated should equal total demand (325)
        const totalAllocated = Object.values(result.allocation).reduce(
            (sum, sector) => sum + (sector.scientist ?? 0), 0
        )
        expect(totalAllocated).toBeCloseTo(325, 6)

        // Remaining workers should be supply - demand = 144000 - 325 = 143675
        // Note: remainingWorkers is not returned, but we can verify via unmetDemand being 0
    })

    it("allocates full demand when workers are abundant (healthcare personnel case)", () => {
        // Healthcare personnel supply 431585, 33 sectors request
        const abundantHealthcare = {
            farmer: 0, scientist: 0, worker: 0, student: 0,
            healtcarePersonal: 431585, policeMen: 0, teacher: 0, serviceWorker: 0,
            clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0, aristocrat: 0, child: 0
        } as Record<keyof Population, number>

        // Create 33 sectors with small demands
        const requests = Array.from({ length: 33 }, (_, i) => ({
            sectorId: `sector${i}`,
            idealDemand: { healtcarePersonal: 10 + (i % 5) * 5 }, // demands: 10, 15, 20, 25, 30 repeating
            priority: 0.3,
        }))
        const minLabor = Object.fromEntries(
            requests.map(r => [r.sectorId, { healtcarePersonal: 0 }])
        )

        const result = allocateLaborTwoStage(abundantHealthcare, requests, minLabor)

        // All sectors should get their full demand
        for (const req of requests) {
            const allocated = result.allocation[req.sectorId]?.healtcarePersonal ?? 0
            const expected = req.idealDemand.healtcarePersonal ?? 0
            expect(allocated).toBeCloseTo(expected, 6)
            expect(result.unmetDemand[req.sectorId]?.healtcarePersonal ?? 0).toBeCloseTo(0, 6)
        }

        // Total allocated should equal total demand
        const totalDemand = requests.reduce((sum, r) => sum + (r.idealDemand.healtcarePersonal ?? 0), 0)
        const totalAllocated = Object.values(result.allocation).reduce(
            (sum, sector) => sum + (sector.healtcarePersonal ?? 0), 0
        )
        expect(totalAllocated).toBeCloseTo(totalDemand, 6)
    })

    it("allocates full demand when workers are abundant (worker case)", () => {
        // Worker supply after Stage 1 is 2035282, 30 sectors request
        const abundantWorkers = {
            farmer: 0, scientist: 0, worker: 2035282, student: 0,
            healtcarePersonal: 0, policeMen: 0, teacher: 0, serviceWorker: 0,
            clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0, aristocrat: 0, child: 0
        } as Record<keyof Population, number>

        // Create 30 sectors with varying demands
        const requests = Array.from({ length: 30 }, (_, i) => ({
            sectorId: `workerSector${i}`,
            idealDemand: { worker: 100 + i * 10 }, // demands: 100, 110, 120, ... 390
            priority: 0.3 + (i % 3) * 0.2, // priorities: 0.3, 0.5, 0.7
        }))
        const minLabor = Object.fromEntries(
            requests.map(r => [r.sectorId, { worker: 0 }])
        )

        const result = allocateLaborTwoStage(abundantWorkers, requests, minLabor)

        // All sectors should get their full demand
        for (const req of requests) {
            const allocated = result.allocation[req.sectorId]?.worker ?? 0
            const expected = req.idealDemand.worker ?? 0
            expect(allocated).toBeCloseTo(expected, 6)
            expect(result.unmetDemand[req.sectorId]?.worker ?? 0).toBeCloseTo(0, 6)
        }

        // Total allocated should equal total demand
        const totalDemand = requests.reduce((sum, r) => sum + (r.idealDemand.worker ?? 0), 0)
        const totalAllocated = Object.values(result.allocation).reduce(
            (sum, sector) => sum + (sector.worker ?? 0), 0
        )
        expect(totalAllocated).toBeCloseTo(totalDemand, 6)
    })

    it("handles zero priority gracefully (should not allocate)", () => {
        // If priority is 0, totalWeight = 0, loop breaks early, no allocation
        const workers = {
            farmer: 0, scientist: 0, worker: 1000, student: 0,
            healtcarePersonal: 0, policeMen: 0, teacher: 0, serviceWorker: 0,
            clergy: 0, retired: 0, clerks: 0, engineer: 0,
            stayAtHome: 0, serviceMan: 0, aristocrat: 0, child: 0
        } as Record<keyof Population, number>

        const requests = [
            { sectorId: "sectorA", idealDemand: { worker: 100 }, priority: 0 },
            { sectorId: "sectorB", idealDemand: { worker: 100 }, priority: 0 },
        ]
        const minLabor = { sectorA: { worker: 0 }, sectorB: { worker: 0 } }

        const result = allocateLaborTwoStage(workers, requests, minLabor)

        // With priority 0, no allocation should happen (totalWeight = 0)
        expect(result.allocation.sectorA.worker ?? 0).toBe(0)
        expect(result.allocation.sectorB.worker ?? 0).toBe(0)
        expect(result.unmetDemand.sectorA.worker ?? 0).toBe(100)
        expect(result.unmetDemand.sectorB.worker ?? 0).toBe(100)
    })

    it("allocates correctly with realistic sector bids and industry pipeline", () => {
        // This test mimics the actual industryTick.worker.ts pipeline:
        // 1. Build sector bids using buildSectorBid
        // 2. Construct laborRequests with priority from investmentPriority (fallback 0.5)
        // 3. Compute minimumEssentialLabor
        // 4. Call allocateLaborTwoStage
        
        const decisions: SectorDecisions = {
            stopProduction: false,
            sectorInvestment: 0,
            laborAssigned: 0,
            restartProduction: false,
            buyCapital: false,
        }
        
        function makeBid(name: string, capitalStock: Record<string, number> = {}, money = 1_000_000) {
            return buildSectorBid(
                name as any,
                basePrices as any,
                1,
                0,
                capitalStock,
                baseSalaries as any,
                0,
                decisions,
                { sectorStartingMoney: money },
            )
        }

        // Create bids for sectors that request scientists
        const bids = [
            makeBid("nuclearSector", { machinery: 1, buildings: 0.1 }),
            makeBid("medicineFactory", { machinery: 0.5, buildings: 0.1 }),
            makeBid("spaceport", { machinery: 0.8, buildings: 0.1 }),
            makeBid("automotive", { machinery: 0.8, metals: 0.5 }),
        ].filter(b => b !== null)

        // Simulate investmentPriority from industry behavior tree (empty = fallback 0.5)
        const investmentPriority: Record<string, number> = {}

        // Build laborRequests exactly as industryTick.worker.ts does
        const laborRequests = bids.map(bid => ({
            sectorId: bid!.name,
            idealDemand: bid!.idealWorkerDemand as Partial<Record<keyof Population, number>>,
            priority: investmentPriority[bid!.name] ?? 0.5,
        }))

        // Build availableWorkers exactly as industryTick.worker.ts does
        const population = createStarterPopulation(200000, {
            scientist: 144000,
            worker: 2035282,
            healtcarePersonal: 431585,
        })
        const availableWorkers: Record<keyof Population, number> = {} as Record<keyof Population, number>
        for(const key of Object.keys(population) as (keyof Population)[]) {
            availableWorkers[key] = key === "stayAtHome" ? 0 : population[key].number
        }

        // Compute minimumEssentialLabor exactly as industryTick.worker.ts does
        const minimumEssentialLabor = computeMinimumEssentialLabor(bids)

        // Call allocateLaborTwoStage
        const result = allocateLaborTwoStage(availableWorkers, laborRequests, minimumEssentialLabor)

        // Verify all scientist demands are met
        const scientistDemand = laborRequests.reduce((sum, r) => sum + (r.idealDemand.scientist ?? 0), 0)
        const scientistAllocated = Object.values(result.allocation).reduce((sum, s) => sum + (s.scientist ?? 0), 0)
        expect(scientistAllocated).toBeCloseTo(scientistDemand, 6)
        
        // Verify no unmet scientist demand
        const scientistUnmet = Object.values(result.unmetDemand).reduce((sum, s) => sum + (s.scientist ?? 0), 0)
        expect(scientistUnmet).toBeCloseTo(0, 6)

        // Verify worker demands are met
        const workerDemand = laborRequests.reduce((sum, r) => sum + (r.idealDemand.worker ?? 0), 0)
        const workerAllocated = Object.values(result.allocation).reduce((sum, s) => sum + (s.worker ?? 0), 0)
        expect(workerAllocated).toBeCloseTo(workerDemand, 6)

        // Verify healthcare demands are met
        const healthcareDemand = laborRequests.reduce((sum, r) => sum + (r.idealDemand.healtcarePersonal ?? 0), 0)
        const healthcareAllocated = Object.values(result.allocation).reduce((sum, s) => sum + (s.healtcarePersonal ?? 0), 0)
        expect(healthcareAllocated).toBeCloseTo(healthcareDemand, 6)
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