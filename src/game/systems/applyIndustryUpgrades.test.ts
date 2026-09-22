import { describe, it, expect } from "vitest"
import { applyIndustryUpgrades } from "./applyIndustryUpgrades"
import { createStarterIndustry } from "../factories/createStarterIndustry"
import { createStarterSectorWealth } from "../factories/createStarterIndustry"
import { sectorUpgradeCosts } from "./sectorUpgradeCosts"

function buildUpgradeInput(overrides: Partial<{
    sectorName: string;
    wealth: number;
    profit: number;
    autoUpgrade: boolean;
    manualUpgrade: boolean;
}> = {}) {
    const sectors = createStarterIndustry(1000);
    const sectorWealth = createStarterSectorWealth(sectors);
    const sectorName = overrides.sectorName ?? "mine";
    const initialLevel = sectors[sectorName as keyof typeof sectors];
    const upgradeCost = Math.round(sectorUpgradeCosts[sectorName as keyof typeof sectorUpgradeCosts] * Math.max(1, initialLevel));

    if (overrides.wealth !== undefined) {
        sectorWealth[sectorName as keyof typeof sectorWealth] = overrides.wealth;
    }

    const sectorProfits: Record<string, number> = {};
    const sectorMaintenance: Record<string, number> = {};

    if (overrides.profit !== undefined) {
        sectorProfits[sectorName] = overrides.profit;
    }
    sectorMaintenance[sectorName] = Math.round(sectorUpgradeCosts[sectorName as keyof typeof sectorUpgradeCosts] * initialLevel * 0.1);

    return {
        sectors,
        sectorWealth,
        sectorName,
        initialLevel,
        input: {
            sectors,
            sectorWealth: { ...sectorWealth },
            sectorProfits,
            sectorMaintenance,
            upgradeSectors: overrides.manualUpgrade ? [sectorName] : [],
            autoUpgradeSectors: overrides.autoUpgrade ? { [sectorName]: true } : {},
        },
    };
}

describe("applyIndustryUpgrades", () => {
    it("upgrades an auto-enabled sector when wealth is sufficient", () => {
        const { initialLevel, sectorName, input } = buildUpgradeInput({
            wealth: 1000,
            profit: 1,
            autoUpgrade: true,
        });

        const result = applyIndustryUpgrades(input);

        expect(result.sectors[sectorName as keyof typeof result.sectors]).toBe(initialLevel + 1);
    })

    it("does not upgrade when wealth is insufficient", () => {
        const { initialLevel, sectorName, input } = buildUpgradeInput({
            wealth: 0,
            profit: 1,
            autoUpgrade: true,
        });

        const result = applyIndustryUpgrades(input);

        expect(result.sectors[sectorName as keyof typeof result.sectors]).toBe(initialLevel);
    })

    it("does not auto-upgrade when sector had zero profit last tick", () => {
        const { initialLevel, sectorName, input } = buildUpgradeInput({
            wealth: 1000,
            profit: 0,
            autoUpgrade: true,
        });

        const result = applyIndustryUpgrades(input);

        expect(result.sectors[sectorName as keyof typeof result.sectors]).toBe(initialLevel);
    })

    it("does not auto-upgrade when sector had negative profit last tick", () => {
        const { initialLevel, sectorName, input } = buildUpgradeInput({
            wealth: 1000,
            profit: -1,
            autoUpgrade: true,
        });

        const result = applyIndustryUpgrades(input);

        expect(result.sectors[sectorName as keyof typeof result.sectors]).toBe(initialLevel);
    })
})
