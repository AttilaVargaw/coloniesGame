import { describe, it, expect } from "vitest"
import { IndustrySystem } from "./industrySystem"
import { IndustryComponent } from "@/game/components/industryComponent"
import { IndustryNode } from "./IndustryNode"
import { World } from "@/engine/core/world"
import { createStarterPopulation } from "../data/getPopulationBreakdown"
import { createStarterIndustry } from "../factories/createStarterIndustry"
import { createStarterWarehouse } from "../factories/createStarterWarehouse"
import { sectorUpgradeCosts } from "./sectorUpgradeCosts"

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

    describe("auto-upgrade", () => {
        it("upgrades an auto-enabled sector when wealth is sufficient", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000))
            industry.autoUpgradeSectors = { mine: true }
            entity.addComponent(industry)
            world.addEntity(entity)

            const sectorName = "mine"
            const initialLevel = industry.sectors[sectorName]
            const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * Math.max(1, initialLevel))
            industry.sectorWealth[sectorName] = upgradeCost + 1
            industry.sectorProfits[sectorName] = 1

            ;(system as any).processAutoUpgrades()

            expect(industry.sectors[sectorName]).toBe(initialLevel + 1)
        })

        it("does not upgrade when wealth is insufficient", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000))
            industry.autoUpgradeSectors = { mine: true }
            entity.addComponent(industry)
            world.addEntity(entity)

            const sectorName = "mine"
            const initialLevel = industry.sectors[sectorName]
            industry.sectorWealth[sectorName] = 0
            industry.sectorProfits[sectorName] = 1

            ;(system as any).processAutoUpgrades()

            expect(industry.sectors[sectorName]).toBe(initialLevel)
        })

        it("does not auto-upgrade when sector had zero profit last tick", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000))
            industry.autoUpgradeSectors = { mine: true }
            entity.addComponent(industry)
            world.addEntity(entity)

            const sectorName = "mine"
            const initialLevel = industry.sectors[sectorName]
            const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * initialLevel)
            industry.sectorWealth[sectorName] = upgradeCost + 1
            industry.sectorProfits[sectorName] = 0

            ;(system as any).processAutoUpgrades()

            expect(industry.sectors[sectorName]).toBe(initialLevel)
        })

        it("does not auto-upgrade when sector had negative profit last tick", () => {
            const world = new World()
            const system = new IndustrySystem()
            system.addToEngine(world)

            const entity = world.createEntity("colony")
            const industry = new IndustryComponent(createStarterIndustry(1000), createStarterWarehouse(1000), createStarterPopulation(1000))
            industry.autoUpgradeSectors = { mine: true }
            entity.addComponent(industry)
            world.addEntity(entity)

            const sectorName = "mine"
            const initialLevel = industry.sectors[sectorName]
            const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * initialLevel)
            industry.sectorWealth[sectorName] = upgradeCost + 1
            industry.sectorProfits[sectorName] = -1

            ;(system as any).processAutoUpgrades()

            expect(industry.sectors[sectorName]).toBe(initialLevel)
        })
    })
})
