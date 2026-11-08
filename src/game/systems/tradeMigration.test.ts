import { describe, it, expect, beforeEach } from "vitest"
import { World } from "@/engine/core/world"
import { createEntity } from "@/engine/lib/entityRegistry"
import { TradeSystem } from "@/game/systems/tradeSystem"
import { MigrationSystem } from "@/game/systems/migrationSystem"
import { PositionComponent } from "@/engine/components/position"
import { IndustryComponent } from "@/game/components/industryComponent"
import { DayPassedEvent } from "@/engine/lib/events"
import { CreateTradeRouteCommand } from "@/game/commands/createTradeRouteCommand"
import { CancelTradeRouteCommand } from "@/game/commands/cancelTradeRouteCommand"
import { CreateMigrationRouteCommand } from "@/game/commands/createMigrationRouteCommand"
import { CancelMigrationRouteCommand } from "@/game/commands/cancelMigrationRouteCommand"
import { TradeRouteComponent } from "@/game/components/tradeRouteComponent"
import { MigrationRouteComponent } from "@/game/components/migrationRouteComponent"
import { Goods } from "../data/Goods"
import { Population } from "../data/Population"
import type { IndustrialSectors } from "@/game/components/Factories"

function makeGoods(overrides: Partial<Goods> = {}): Goods {
    return {
        food: 0,
        tourism: 0,
        consumerGoods: 0,
        water: 0,
        energy: 0,
        services: 0,
        agriculturalGoods: 0,
        tylium: 0,
        metals: 0,
        fissionMaterial: 0,
        machinery: 0,
        medicine: 0,
        lumber: 0,
        oil: 0,
        spaceShips: 0,
        nuclearWeapons: 0,
        vehicles: 0,
        environmentFactor: 0,
        faith: 0,
        lawEnforcement: 0,
        healthcare: 0,
        chemicals: 0,
        buildings: 0,
        waste: 0,
        governance: 0,
        logistics: 0,
        paper: 0,
        entertainment: 0,
        education: 0,
        defense: 0,
        monetaryServices: 0,
        militaryEquipment: 0,
        mobility: 0,
        ...overrides,
    }
}

function makePopulation(overrides: Partial<Population> = {}): Population {
    const createBreakdown = (number: number): any => ({
        number,
        wealth: 1,
        wealthLevel: 1,
        qol: 50,
        expectedQol: 50,
        populationChange: 0,
        mortality: 0,
        salary: 200,
        birthRate: 0,
    })
    return {
        farmer: createBreakdown(100),
        scientist: createBreakdown(100),
        worker: createBreakdown(1000),
        student: createBreakdown(100),
        healtcarePersonal: createBreakdown(100),
        policeMen: createBreakdown(100),
        teacher: createBreakdown(100),
        serviceWorker: createBreakdown(100),
        clergy: createBreakdown(100),
        retired: createBreakdown(100),
        clerks: createBreakdown(100),
        engineer: createBreakdown(100),
        stayAtHome: createBreakdown(500),
        serviceMan: createBreakdown(100),
        ...overrides,
    } as Population
}

function createSettlementEntity(
    world: World,
    id: string,
    x: number,
    y: number,
    goods: Goods,
    population: Population,
    activeSectors: Set<keyof IndustrialSectors> = new Set<keyof IndustrialSectors>(["powerPlant"]),
): ReturnType<typeof createEntity> {
    const entity = createEntity(id)
        .addComponent(new PositionComponent(x, y))
        .addComponent(new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        ))
    world.addEntity(entity)
    return entity
}

function findRouteEntity(world: World, componentClass: any): ReturnType<typeof createEntity> | undefined {
    return world.getAllEntities().find(e => e.getComponent(componentClass))
}

function passDay(world: World) {
    world.dispatchEvent(new DayPassedEvent())
    world.update(0)
}

describe("TradeSystem", () => {
    let world: World
    let source: ReturnType<typeof createEntity>
    let destination: ReturnType<typeof createEntity>

    beforeEach(() => {
        world = new World()
        world.addSystem(TradeSystem)

        const goods = makeGoods({ oil: 500, paper: 100 })
        const population = makePopulation()

        source = createEntity("source")
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new IndustryComponent(
                new Set<keyof IndustrialSectors>(["powerPlant"]),
                goods,
                population,
                "standard",
                "colony",
                {} as Record<keyof IndustrialSectors, number>,
                {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
                0,
                {} as Record<keyof IndustrialSectors, Partial<Goods>>,
            ))
        world.addEntity(source)

        destination = createEntity("destination")
            .addComponent(new PositionComponent(100, 0))
            .addComponent(new IndustryComponent(
                new Set<keyof IndustrialSectors>(["powerPlant"]),
                makeGoods(),
                makePopulation(),
                "standard",
                "colony",
                {} as Record<keyof IndustrialSectors, number>,
                {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
                0,
                {} as Record<keyof IndustrialSectors, Partial<Goods>>,
            ))
        world.addEntity(destination)
    })

    it("creates a trade route and deducts goods from source on day pass", () => {
        const sourceBefore = source.getComponent(IndustryComponent)!.goods.oil

        world.addCommand(new CreateTradeRouteCommand("source", "destination", { oil: 100 }, 1))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!.goods.oil
        expect(sourceAfter).toBe(sourceBefore - 100)
    })

    it("deducts only available goods when requesting more than available", () => {
        world.addCommand(new CreateTradeRouteCommand("source", "destination", { oil: 1000 }, 1))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!.goods.oil
        expect(sourceAfter).toBe(0)
    })

    it("refunds goods to source when route is cancelled", () => {
        world.addCommand(new CreateTradeRouteCommand("source", "destination", { oil: 100 }, 1))
        passDay(world)

        const routeEntity = findRouteEntity(world, TradeRouteComponent)
        expect(routeEntity).toBeDefined()

        world.addCommand(new CancelTradeRouteCommand(routeEntity!.id))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!.goods.oil
        expect(sourceAfter).toBe(500)
    })

    it("does not create route when source has no industry", () => {
        const noIndustryEntity = createEntity("noIndustry")
            .addComponent(new PositionComponent(200, 0))
        world.addEntity(noIndustryEntity)

        world.addCommand(new CreateTradeRouteCommand("noIndustry", "destination", { oil: 100 }, 1))
        passDay(world)

        const sourceGoods = source.getComponent(IndustryComponent)!.goods
        expect(sourceGoods.oil).toBe(500)
    })

    it("delivers goods to destination when route completes", () => {
        const closeDest = createSettlementEntity(world, "closeDest", 1, 0, makeGoods(), makePopulation())
        world.addCommand(new CreateTradeRouteCommand("source", "closeDest", { oil: 100 }, 10))
        passDay(world)

        const destGoods = closeDest.getComponent(IndustryComponent)!.goods
        // travelDays = Math.max(1, Math.ceil(1 / (10 * 0.5))) = 1
        // After one day pass, travelDaysRemaining goes to 0, route completes
        expect(destGoods.oil).toBe(100)
    })
})

describe("MigrationSystem", () => {
    let world: World
    let source: ReturnType<typeof createEntity>
    let destination: ReturnType<typeof createEntity>

    beforeEach(() => {
        world = new World()
        world.addSystem(MigrationSystem)

        const goods = makeGoods()
        const population = makePopulation()

        source = createEntity("source")
            .addComponent(new PositionComponent(0, 0))
            .addComponent(new IndustryComponent(
                new Set<keyof IndustrialSectors>(["powerPlant"]),
                goods,
                population,
                "standard",
                "colony",
                {} as Record<keyof IndustrialSectors, number>,
                {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
                0,
                {} as Record<keyof IndustrialSectors, Partial<Goods>>,
            ))
        world.addEntity(source)

        destination = createEntity("destination")
            .addComponent(new PositionComponent(100, 0))
            .addComponent(new IndustryComponent(
                new Set<keyof IndustrialSectors>(["powerPlant"]),
                makeGoods(),
                makePopulation(),
                "standard",
                "colony",
                {} as Record<keyof IndustrialSectors, number>,
                {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
                0,
                {} as Record<keyof IndustrialSectors, Partial<Goods>>,
            ))
        world.addEntity(destination)

        // Initialize freeWorkers to match population workers (MigrationSystem requires freeWorkers > 0)
        const sourceIndustry = source.getComponent(IndustryComponent)!
        sourceIndustry.freeWorkers.worker.number = 1000
    })

    it("creates a migration route and transfers workers on day pass", () => {
        const sourceIndustry = source.getComponent(IndustryComponent)!
        expect(sourceIndustry.freeWorkers.worker.number).toBe(1000)

        world.addCommand(new CreateMigrationRouteCommand("source", "destination", 100, 1))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!
        expect(sourceAfter.freeWorkers.worker.number).toBe(900)
        expect(sourceAfter.population.worker.number).toBe(900)
    })

    it("migrates only available workers when requesting more than available", () => {
        world.addCommand(new CreateMigrationRouteCommand("source", "destination", 5000, 1))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!
        expect(sourceAfter.freeWorkers.worker.number).toBe(0)
        expect(sourceAfter.population.worker.number).toBe(0)
    })

    it("refunds workers to source when route is cancelled", () => {
        world.addCommand(new CreateMigrationRouteCommand("source", "destination", 100, 1))
        passDay(world)

        const routeEntity = findRouteEntity(world, MigrationRouteComponent)
        expect(routeEntity).toBeDefined()

        world.addCommand(new CancelMigrationRouteCommand(routeEntity!.id))
        passDay(world)

        const sourceAfter = source.getComponent(IndustryComponent)!
        expect(sourceAfter.freeWorkers.worker.number).toBe(1000)
        expect(sourceAfter.population.worker.number).toBe(1000)
    })

    it("does not create route when source has no free workers", () => {
        const noWorkersPop = makePopulation({ worker: { ...makePopulation().worker, number: 0 } })
        const noWorkersEntity = createSettlementEntity(world, "noWorkers", 200, 0, makeGoods(), noWorkersPop)
        const noWorkersIndustry = noWorkersEntity.getComponent(IndustryComponent)!
        noWorkersIndustry.freeWorkers.worker.number = 0

        world.addCommand(new CreateMigrationRouteCommand("noWorkers", "destination", 100, 1))
        passDay(world)

        const sourceIndustry = source.getComponent(IndustryComponent)!
        expect(sourceIndustry.freeWorkers.worker.number).toBe(1000)
    })

    it("delivers workers to destination when route completes", () => {
        const closeDest = createSettlementEntity(world, "closeDest", 1, 0, makeGoods(), makePopulation())
        const closeDestIndustry = closeDest.getComponent(IndustryComponent)!
        closeDestIndustry.freeWorkers.worker.number = 1000

        world.addCommand(new CreateMigrationRouteCommand("source", "closeDest", 100, 10))
        passDay(world)

        const destIndustry = closeDest.getComponent(IndustryComponent)!
        expect(destIndustry.freeWorkers.worker.number).toBe(1100)
        expect(destIndustry.population.worker.number).toBe(1100)
    })
})
