import { describe, it, expect, beforeEach } from "vitest"
import { IndustrySystem } from "./industrySystem"
import { Entity } from "@/engine/entities/entity"
import { IndustryComponent } from "@/game/components/industryComponent"
import { IndustryNode } from "./IndustryNode"
import { World } from "@/engine/core/world"
import { DayPassedEvent } from "@/engine/lib/events"

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
            const industry = new IndustryComponent(1000, 0.6, 200, 0.3)
            entity.addComponent(industry)
            world.addEntity(entity)

            const nodes = (system as any).nodes as IndustryNode[]
            expect(nodes).toHaveLength(1)
            expect(nodes[0]).toBeInstanceOf(IndustryNode)
            expect(nodes[0].industry).toBe(industry)
        })

        it("subscribes to DayPassedEvent and updates on dispatch", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(1000, 0.6, 200, 0.3)
            entity.addComponent(industry)
            world.addEntity(entity)

            const eventBus = (world as any).eventBus
            eventBus.dispatchEvent(new DayPassedEvent(null))
            eventBus.processEventHandlers()

            expect(industry.population).toBeGreaterThan(1000)
        })
    })

    describe("removeFromEngine", () => {
        it("clears nodes and unsubscribes from DayPassedEvent", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            entity.addComponent(new IndustryComponent(1000, 0.6, 200, 0.3))
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
            industry = new IndustryComponent(1000, 0.6, 200, 0.3)
            entity.addComponent(industry)
            ;(system as any).nodes = [makeNode(entity)]
        })

        it("increases population when happiness > 0.5", () => {
            const initial = industry.population
            ;(system as any).onDayPassed()
            expect(industry.population).toBeGreaterThan(initial)
        })

        it("decreases population when happiness < 0.5", () => {
            industry.happiness = 0.4
            const initial = industry.population
            ;(system as any).onDayPassed()
            expect(industry.population).toBeLessThan(initial)
        })

        it("does not change population when happiness === 0.5", () => {
            industry.happiness = 0.5
            const initial = industry.population
            ;(system as any).onDayPassed()
            expect(industry.population).toBeCloseTo(initial)
        })

        it("increases production when happiness > 0.5", () => {
            const initial = industry.production
            ;(system as any).onDayPassed()
            expect(industry.production).toBeGreaterThan(initial)
        })

        it("does not change production when happiness === 0.5", () => {
            industry.happiness = 0.5
            const initial = industry.production
            ;(system as any).onDayPassed()
            expect(industry.production).toBeCloseTo(initial)
        })

        it("increases happiness when consumerGoodsRatio produces per-capita ratio > 0.5", () => {
            industry.population = 100
            industry.production = 200
            industry.consumerGoodsRatio = 0.9
            industry.happiness = 0.5
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeGreaterThan(0.5)
        })

        it("decreases happiness when consumerGoodsRatio produces per-capita ratio < 0.5", () => {
            industry.consumerGoodsRatio = 0.1
            industry.happiness = 0.5
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeLessThan(0.5)
        })

        it("clamps happiness to 1 maximum", () => {
            industry.happiness = 0.99
            industry.consumerGoodsRatio = 1.0
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeLessThanOrEqual(1)
        })

        it("clamps happiness to 0 minimum", () => {
            industry.happiness = 0.01
            industry.consumerGoodsRatio = 0.0
            ;(system as any).onDayPassed()
            expect(industry.happiness).toBeGreaterThanOrEqual(0)
        })

        it("processes multiple colonies independently", () => {
            const entity2 = new Entity("colony2")
            const industry2 = new IndustryComponent(500, 0.7, 100, 0.5)
            entity2.addComponent(industry2)
            ;(system as any).nodes = [makeNode(entity), makeNode(entity2)]

            ;(system as any).onDayPassed()

            expect(industry.population).toBeGreaterThan(1000)
            expect(industry2.population).toBeGreaterThan(500)
        })
    })
})
