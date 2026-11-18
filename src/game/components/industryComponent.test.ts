import { describe, it, expect } from "vitest"
import { IndustryComponent } from "./industryComponent"
import type { IndustrialSectors } from "./Factories"
import { Goods } from "../data/Goods"
import { Population } from "../data/Population"
import { CAN_BE_NEGATIVE } from "../data/Goods"

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
    const createBreakdown = (): any => ({
        number: 100,
        wealth: 0,
        wealthLevel: 0,
        qol: 0,
        expectedQol: 0,
        populationChange: 0,
        mortality: 0,
        salary: 0,
        birthRate: 0,
    })
    return {
        farmer: createBreakdown(),
        scientist: createBreakdown(),
        worker: createBreakdown(),
        student: createBreakdown(),
        healtcarePersonal: createBreakdown(),
        policeMen: createBreakdown(),
        teacher: createBreakdown(),
        serviceWorker: createBreakdown(),
        clergy: createBreakdown(),
        retired: createBreakdown(),
        clerks: createBreakdown(),
        engineer: createBreakdown(),
        stayAtHome: createBreakdown(),
        serviceMan: createBreakdown(),
        ...overrides,
    } as Population
}

describe("IndustryComponent", () => {
    it("initializes with default values", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant"])
        const goods = makeGoods({ oil: 1000 })
        const population = makePopulation()

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.activeSectors).toContain("powerPlant")
        expect(industry.goods).toEqual(goods)
        expect(industry.population).toEqual(population)
        expect(industry.colonyType).toBe("standard")
        expect(industry.sectorUtilization["powerPlant"]).toBe(0)
        expect(industry.sectorStopReason["powerPlant"]).toBe("")
        expect(industry.sectorResults.size).toBe(0)
        expect(industry.sectorProfits["powerPlant"]).toBe(0)
        expect(industry.sectorRevenue["powerPlant"]).toBe(0)
        expect(industry.capitalStock["powerPlant"]).toEqual({})
        expect(industry.money["powerPlant"]).toBe(0)
    })

    it("initializes starter capital stock from constructor arg", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant"])
        const goods = makeGoods()
        const population = makePopulation()
        const starterCapitalStock: Partial<Record<keyof IndustrialSectors, Partial<Goods>>> = {
            powerPlant: { machinery: 5, buildings: 1 },
        }

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            starterCapitalStock,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.capitalStock["powerPlant"]).toEqual({ machinery: 5, buildings: 1 })
    })

    it("initializes starter money from constructor arg", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant", "metalFactory"])
        const goods = makeGoods()
        const population = makePopulation()
        const starterMoney: Partial<Record<keyof IndustrialSectors, number>> = {
            powerPlant: 500000,
            metalFactory: 200000,
        }

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            starterMoney as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.money["powerPlant"]).toBe(500000)
        expect(industry.money["metalFactory"]).toBe(200000)
    })

    it("initializes all active sectors with zero utilization", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant", "metalFactory", "farm"])
        const goods = makeGoods()
        const population = makePopulation()

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.sectorUtilization["powerPlant"]).toBe(0)
        expect(industry.sectorUtilization["metalFactory"]).toBe(0)
        expect(industry.sectorUtilization["farm"]).toBe(0)
    })

    it("initializes tech multipliers to 1 for all sectors", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant", "metalFactory"])
        const goods = makeGoods()
        const population = makePopulation()

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.techMultipliers["powerPlant"]).toBe(1)
        expect(industry.techMultipliers["metalFactory"]).toBe(1)
    })

    it("initializes workerEfficiencyMultipliers to 1 for all population types", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant"])
        const goods = makeGoods()
        const population = makePopulation()

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.workerEfficiencyMultipliers["worker"]).toBe(1)
        expect(industry.workerEfficiencyMultipliers["clerks"]).toBe(1)
        expect(industry.workerEfficiencyMultipliers["engineer"]).toBe(1)
    })

    it("initializes materialRequirementMultipliers to 1 for all goods", () => {
        const activeSectors: Set<keyof IndustrialSectors> = new Set(["powerPlant"])
        const goods = makeGoods()
        const population = makePopulation()

        const industry = new IndustryComponent(
            activeSectors,
            goods,
            population,
            "standard",
            "colony",
            {} as Record<keyof IndustrialSectors, number>,
            {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
            0,
            {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        )

        expect(industry.materialRequirementMultipliers["oil"]).toBe(1)
        expect(industry.materialRequirementMultipliers["paper"]).toBe(1)
    })
})

describe("CAN_BE_NEGATIVE set", () => {
    it("contains environmentFactor", () => {
        expect(CAN_BE_NEGATIVE.has("environmentFactor")).toBe(true)
    })

    it("does not contain oil", () => {
        expect(CAN_BE_NEGATIVE.has("oil")).toBe(false)
    })

    it("does not contain paper", () => {
        expect(CAN_BE_NEGATIVE.has("paper")).toBe(false)
    })

    it("does not contain governance", () => {
        expect(CAN_BE_NEGATIVE.has("governance")).toBe(false)
    })
})
