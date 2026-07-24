import { describe, it, expect, beforeEach } from "vitest"
import { IndustrySystem } from "./industrySystem"
import { Entity } from "@/engine/entities/entity"
import { IndustryComponent } from "@/game/components/industryComponent"
import { IndustryNode } from "./IndustryNode"
import { World } from "@/engine/core/world"

function makeNode(entity: Entity): IndustryNode {
    const industry = entity.getComponent(IndustryComponent)!
    return new IndustryNode(industry, entity)
}

describe("industrySystem", () => {
    describe("addToEngine", () => {
        it("registers IndustryNode type and populates nodes list", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(1000, 0.6, 200)
            entity.addComponent(industry)
            world.addEntity(entity)

            const nodes = (system as any).nodes as IndustryNode[]
            expect(nodes).toHaveLength(1)
            expect(nodes[0]).toBeInstanceOf(IndustryNode)
            expect(nodes[0].industry).toBe(industry)
        })
    })

    describe("removeFromEngine", () => {
        it("clears nodes and engine reference", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            entity.addComponent(new IndustryComponent(1000, 0.6, 200))
            world.addEntity(entity)

            expect((system as any).nodes).toHaveLength(1)

            system.removeFromEngine()

            expect((system as any).nodes).toHaveLength(0)
            expect((system as any).engine).toBeUndefined()
        })
    })

    describe("onDayPassed", () => {
        let system: IndustrySystem
        let entity: Entity
        let industry: IndustryComponent

        beforeEach(() => {
            system = new IndustrySystem()
            entity = new Entity("colony")
            industry = new IndustryComponent(1000, 0.6, 200)
            entity.addComponent(industry)
            ;(system as any).nodes = [makeNode(entity)]
        })

        it("mines ore from labor force", () => {
            ;(system as any).onDayPassed()
            expect(industry.ore).toBeGreaterThan(0)
        })

        it("refines ore into tylium up to refinery capacity", () => {
            industry.laborForce = 0
            industry.ore = 5
            industry.refineryCapacity = 10
            ;(system as any).onDayPassed()
            expect(industry.tylium).toBeCloseTo(5 * (1 - industry.civilianAllocation / (industry.civilianAllocation + industry.militaryAllocation)))
            expect(industry.ore).toBe(0)
        })

        it("does not refine more ore than refinery capacity", () => {
            industry.laborForce = 0
            industry.ore = 20
            industry.refineryCapacity = 10
            ;(system as any).onDayPassed()
            expect(industry.tylium).toBeCloseTo(10 * (1 - industry.civilianAllocation / (industry.civilianAllocation + industry.militaryAllocation)))
            expect(industry.ore).toBeCloseTo(10)
        })

        it("collects taxes from population", () => {
            industry.population = 1000
            industry.taxRate = 0.15
            industry.tylium = 0
            industry.laborForce = 0
            ;(system as any).onDayPassed()
            expect(industry.credits).toBeCloseTo(1000 * 0.1 * 0.15)
        })

        it("collects taxes from tylium production", () => {
            industry.tylium = 100
            industry.taxRate = 0.15
            ;(system as any).onDayPassed()
            expect(industry.credits).toBeGreaterThan(0)
        })

        it("pays maintenance costs", () => {
            industry.credits = 100
            industry.maintenanceCosts = 30
            ;(system as any).onDayPassed()
            expect(industry.credits).toBeLessThan(100)
        })

        it("zeroes credits if maintenance exceeds credits", () => {
            industry.credits = 10
            industry.maintenanceCosts = 50
            ;(system as any).onDayPassed()
            expect(industry.credits).toBe(0)
        })

        it("increases happiness with high civilian allocation", () => {
            industry.civilianAllocation = 0.8
            industry.militaryAllocation = 0.2
            industry.tylium = 1000
            industry.happiness = 0.5
            industry.population = 100
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeGreaterThan(0.5)
        })

        it("does not decrease happiness below 0", () => {
            industry.civilianAllocation = 0
            industry.tylium = 0
            industry.happiness = 0.01
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeGreaterThanOrEqual(0)
        })

        it("clamps happiness to 1 maximum", () => {
            industry.civilianAllocation = 1.0
            industry.militaryAllocation = 0
            industry.tylium = 1000
            industry.happiness = 0.99
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeLessThanOrEqual(1)
        })

        it("processes build orders consuming ore, tylium, and credits", () => {
            industry.buildOrders = [{
                id: 1,
                name: "Destroyer",
                imageUrl: "",
                totalDays: 5,
                remainingDays: 5,
                oreCost: 50,
                tyliumCost: 30,
                creditCost: 100,
                orePaid: 0,
                tyliumPaid: 0,
                creditsPaid: 0,
            }]
            industry.ore = 100
            industry.tylium = 100
            industry.credits = 200
            industry.civilianAllocation = 0
            industry.militaryAllocation = 1.0

            ;(system as any).onDayPassed()

            expect(industry.ore).toBeGreaterThan(0)
            expect(industry.tylium).toBeGreaterThan(0)
            expect(industry.credits).toBeGreaterThan(0)
            expect(industry.buildOrders[0].orePaid).toBeGreaterThan(0)
            expect(industry.buildOrders[0].tyliumPaid).toBeGreaterThan(0)
            expect(industry.buildOrders[0].creditsPaid).toBeGreaterThan(0)
        })

        it("removes completed build orders", () => {
            industry.buildOrders = [{
                id: 1,
                name: "Fighter",
                imageUrl: "",
                totalDays: 1,
                remainingDays: 1,
                oreCost: 1,
                tyliumCost: 1,
                creditCost: 1,
                orePaid: 0,
                tyliumPaid: 0,
                creditsPaid: 0,
            }]
            industry.ore = 100
            industry.tylium = 100
            industry.credits = 200
            industry.civilianAllocation = 0
            industry.militaryAllocation = 1.0

            ;(system as any).onDayPassed()

            expect(industry.buildOrders).toHaveLength(0)
        })

        it("does not process build orders without military allocation", () => {
            industry.buildOrders = [{
                id: 1,
                name: "Destroyer",
                imageUrl: "",
                totalDays: 5,
                remainingDays: 5,
                oreCost: 50,
                tyliumCost: 30,
                creditCost: 100,
                orePaid: 0,
                tyliumPaid: 0,
                creditsPaid: 0,
            }]
            industry.ore = 100
            industry.tylium = 100
            industry.credits = 200
            industry.civilianAllocation = 1.0
            industry.militaryAllocation = 0

            ;(system as any).onDayPassed()

            expect(industry.buildOrders[0].orePaid).toBe(0)
            expect(industry.buildOrders[0].tyliumPaid).toBe(0)
            expect(industry.buildOrders[0].creditsPaid).toBe(0)
        })

        it("grows population when happiness > 0.5", () => {
            const initial = industry.population
            ;(system as any).onDayPassed()
            expect(industry.population).toBeGreaterThan(initial)
        })

        it("shrinks population when happiness < 0.5", () => {
            industry.happiness = 0.4
            const initial = industry.population
            ;(system as any).onDayPassed()
            expect(industry.population).toBeLessThan(initial)
        })
    })
})
