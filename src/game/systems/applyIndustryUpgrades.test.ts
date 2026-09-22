import { describe, it, expect } from "vitest"
import { applyIndustryUpgrades } from "./applyIndustryUpgrades"
import { createStarterIndustry } from "../factories/createStarterIndustry"
import { createStarterSectorWealth } from "../factories/createStarterIndustry"
import { sectorUpgradeCosts } from "./sectorUpgradeCosts"

describe("applyIndustryUpgrades", () => {
    it("upgrades an auto-enabled sector when wealth is sufficient", () => {
        const sectors = createStarterIndustry(1000)
        const sectorWealth = createStarterSectorWealth(sectors)
        const sectorName = "mine"
        const initialLevel = sectors[sectorName]
        const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * Math.max(1, initialLevel))

        const result = applyIndustryUpgrades({
            sectors,
            sectorWealth: { ...sectorWealth, [sectorName]: upgradeCost + 1 },
            sectorProfits: { [sectorName]: 1 },
            sectorMaintenance: { [sectorName]: Math.round(sectorUpgradeCosts[sectorName] * initialLevel * 0.1) },
            upgradeSectors: [],
            autoUpgradeSectors: { [sectorName]: true },
        })

        expect(result.sectors[sectorName]).toBe(initialLevel + 1)
    })

    it("does not upgrade when wealth is insufficient", () => {
        const sectors = createStarterIndustry(1000)
        const sectorWealth = createStarterSectorWealth(sectors)
        const sectorName = "mine"
        const initialLevel = sectors[sectorName]

        const result = applyIndustryUpgrades({
            sectors,
            sectorWealth: { ...sectorWealth, [sectorName]: 0 },
            sectorProfits: { [sectorName]: 1 },
            sectorMaintenance: { [sectorName]: Math.round(sectorUpgradeCosts[sectorName] * initialLevel * 0.1) },
            upgradeSectors: [],
            autoUpgradeSectors: { [sectorName]: true },
        })

        expect(result.sectors[sectorName]).toBe(initialLevel)
    })

    it("does not auto-upgrade when sector had zero profit last tick", () => {
        const sectors = createStarterIndustry(1000)
        const sectorWealth = createStarterSectorWealth(sectors)
        const sectorName = "mine"
        const initialLevel = sectors[sectorName]
        const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * initialLevel)

        const result = applyIndustryUpgrades({
            sectors,
            sectorWealth: { ...sectorWealth, [sectorName]: upgradeCost + 1 },
            sectorProfits: { [sectorName]: 0 },
            sectorMaintenance: { [sectorName]: Math.round(sectorUpgradeCosts[sectorName] * initialLevel * 0.1) },
            upgradeSectors: [],
            autoUpgradeSectors: { [sectorName]: true },
        })

        expect(result.sectors[sectorName]).toBe(initialLevel)
    })

    it("does not auto-upgrade when sector had negative profit last tick", () => {
        const sectors = createStarterIndustry(1000)
        const sectorWealth = createStarterSectorWealth(sectors)
        const sectorName = "mine"
        const initialLevel = sectors[sectorName]
        const upgradeCost = Math.round(sectorUpgradeCosts[sectorName] * initialLevel)

        const result = applyIndustryUpgrades({
            sectors,
            sectorWealth: { ...sectorWealth, [sectorName]: upgradeCost + 1 },
            sectorProfits: { [sectorName]: -1 },
            sectorMaintenance: { [sectorName]: Math.round(sectorUpgradeCosts[sectorName] * initialLevel * 0.1) },
            upgradeSectors: [],
            autoUpgradeSectors: { [sectorName]: true },
        })

        expect(result.sectors[sectorName]).toBe(initialLevel)
    })
})
