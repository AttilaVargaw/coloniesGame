import type { IndustrialSectors } from "../components/Factories";
import { sectorUpgradeCosts } from "./sectorUpgradeCosts";

export interface ApplyUpgradesInput {
    sectors: Record<keyof IndustrialSectors, number>;
    sectorWealth: Record<keyof IndustrialSectors, number>;
    sectorProfits: Record<string, number>;
    sectorMaintenance: Record<string, number>;
    upgradeSectors: string[];
    autoUpgradeSectors: Record<string, boolean>;
}

export interface ApplyUpgradesResult {
    sectors: Record<keyof IndustrialSectors, number>;
    sectorWealth: Record<keyof IndustrialSectors, number>;
}

export function applyIndustryUpgrades(input: ApplyUpgradesInput): ApplyUpgradesResult {
    const sectors = { ...input.sectors };
    const sectorWealth = { ...input.sectorWealth };

    for (const sectorName of input.upgradeSectors) {
        const currentLevel = sectors[sectorName as keyof IndustrialSectors];
        const cost = Math.round((sectorUpgradeCosts[sectorName as keyof IndustrialSectors] || 10) * Math.max(1, currentLevel));
        if ((sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) >= cost) {
            sectors[sectorName as keyof IndustrialSectors] = currentLevel + 1;
            sectorWealth[sectorName as keyof IndustrialSectors] = Math.max(0, (sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) - cost);
        }
    }

    for (const [sectorName, shouldAutoUpgrade] of Object.entries(input.autoUpgradeSectors)) {
        if (!shouldAutoUpgrade) continue;
        const currentLevel = sectors[sectorName as keyof IndustrialSectors];
        const lastProfit = input.sectorProfits[sectorName] ?? 0;
        if (lastProfit <= 0) continue;
        const cost = Math.round((sectorUpgradeCosts[sectorName as keyof IndustrialSectors] || 10) * Math.max(1, currentLevel));
        if ((sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) >= cost) {
            sectors[sectorName as keyof IndustrialSectors] = currentLevel + 1;
            sectorWealth[sectorName as keyof IndustrialSectors] = Math.max(0, (sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) - cost);
        }
    }

    for (const [sector, profit] of Object.entries(input.sectorProfits)) {
        const sectorKey = sector as keyof IndustrialSectors;
        const maintenance = input.sectorMaintenance[sectorKey] ?? 0;
        const currentWealth = sectorWealth[sectorKey] ?? 0;
        const targetWealth = Math.max(0, currentWealth + profit - maintenance);
        const sectorWealthSmoothing = 0.5;
        const smoothedWealth = currentWealth + (targetWealth - currentWealth) * sectorWealthSmoothing;
        sectorWealth[sectorKey] = smoothedWealth;
    }

    for (const [sectorName, level] of Object.entries(sectors)) {
        const maintenance = input.sectorMaintenance[sectorName] ?? 0;
        const wealth = sectorWealth[sectorName as keyof IndustrialSectors] ?? 0;
        if (level > 1 && wealth < maintenance * 3) {
            sectors[sectorName as keyof IndustrialSectors] = level - 1;
            sectorWealth[sectorName as keyof IndustrialSectors] = Math.max(0, wealth - Math.round(maintenance * 0.5));
        }
    }

    return { sectors, sectorWealth };
}
