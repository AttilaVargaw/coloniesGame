import { describe, it, expect } from "vitest"
import { IndustrySystem } from "./industrySystem"
import { IndustryComponent } from "@/game/components/industryComponent"
import { IndustryNode } from "./IndustryNode"
import { World } from "@/engine/core/world"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "../factories/createStarterIndustry"
import { createStarterWarehouse } from "../factories/createStarterWarehouse"

describe("industrySystem", () => {
    describe("addToEngine", () => {
        it("registers IndustryNode type and populates nodes list", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000))
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
            entity.addComponent(new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000)))
            world.addEntity(entity)

            expect((system as any).nodes).toHaveLength(1)

            system.removeFromEngine()

            expect((system as any).nodes).toHaveLength(0)
            expect((system as any).engine).toBeUndefined()
        })
    })
})
