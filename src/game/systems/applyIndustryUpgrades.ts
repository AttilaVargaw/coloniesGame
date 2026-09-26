import type { IndustrialSectors } from "../components/Factories";
import { SettlementType } from "../components/industryComponent";
import { sectorUpgradeCosts } from "./sectorUpgradeCosts";

export interface ApplyUpgradesInput {
    sectors: Record<keyof IndustrialSectors, number>;
    sectorWealth: Record<keyof IndustrialSectors, number>;
    sectorProfits: Record<string, number>;
    sectorMaintenance: Record<string, number>;
    upgradeSectors: string[];
    autoUpgradeSectors: Record<string, boolean>;
    settlementType: SettlementType;
    allowedSectors: (keyof IndustrialSectors)[] | undefined;
}

export interface ApplyUpgradesResult {
    sectors: Record<keyof IndustrialSectors, number>;
    sectorWealth: Record<keyof IndustrialSectors, number>;
}

export function applyIndustryUpgrades(input: ApplyUpgradesInput): ApplyUpgradesResult {
    const sectors = { ...input.sectors };
    const sectorWealth = { ...input.sectorWealth };
    const allowedSectors = new Set(input.allowedSectors ?? Object.keys(sectors) as (keyof IndustrialSectors)[]);

    for(const sectorName of input.upgradeSectors) {
        if(!isSectorAllowed(sectorName, input.settlementType, allowedSectors)) continue;
        tryUpgradeSector(sectorName, sectors, sectorWealth, input.sectorProfits, false);
    }

    for(const [sectorName, shouldAutoUpgrade] of Object.entries(input.autoUpgradeSectors)) {
        if(!shouldAutoUpgrade) continue;
        if(!isSectorAllowed(sectorName, input.settlementType, allowedSectors)) continue;
        tryUpgradeSector(sectorName, sectors, sectorWealth, input.sectorProfits, true);
    }

    for(const [sector, profit] of Object.entries(input.sectorProfits)) {
        const sectorKey = sector as keyof IndustrialSectors;
        const maintenance = input.sectorMaintenance[sectorKey] ?? 0;
        const currentWealth = sectorWealth[sectorKey] ?? 0;
        const targetWealth = Math.max(0, currentWealth + profit - maintenance);
        const sectorWealthSmoothing = 0.5;
        const smoothedWealth = currentWealth + (targetWealth - currentWealth) * sectorWealthSmoothing;
        sectorWealth[sectorKey] = smoothedWealth;
    }

    for(const [sectorName, level] of Object.entries(sectors)) {
        const maintenance = input.sectorMaintenance[sectorName] ?? 0;
        const wealth = sectorWealth[sectorName as keyof IndustrialSectors] ?? 0;
        if(level > 1 && wealth < maintenance * 3) {
            sectors[sectorName as keyof IndustrialSectors] = level - 1;
            sectorWealth[sectorName as keyof IndustrialSectors] = Math.max(0, wealth - Math.round(maintenance * 0.5));
        }
    }

    return { sectors, sectorWealth };
}

function isSectorAllowed(
    sectorName: string,
    settlementType: SettlementType,
    allowedSectors: Set<keyof IndustrialSectors>
): boolean {
    if(settlementType === "colony") return true;
    return allowedSectors.has(sectorName as keyof IndustrialSectors);
}

function tryUpgradeSector(
    sectorName: string,
    sectors: Record<keyof IndustrialSectors, number>,
    sectorWealth: Record<keyof IndustrialSectors, number>,
    sectorProfits: Record<string, number>,
    requireProfit: boolean
) {
    const currentLevel = sectors[sectorName as keyof IndustrialSectors];
    const cost = Math.round((sectorUpgradeCosts[sectorName as keyof IndustrialSectors] || 10) * Math.max(1, currentLevel));

    if(requireProfit) {
        const lastProfit = sectorProfits[sectorName] ?? 0;
        if(lastProfit <= 0) return;
    }

    if((sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) >= cost) {
        sectors[sectorName as keyof IndustrialSectors] = currentLevel + 1;
        sectorWealth[sectorName as keyof IndustrialSectors] = Math.max(0, (sectorWealth[sectorName as keyof IndustrialSectors] ?? 0) - cost);
    }
}
