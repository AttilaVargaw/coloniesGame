import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { convertToReadable } from "@/lib/utils";
import { useGameEngine } from "@/hooks/useGameContext";
import { UpgradeSectorCommand } from "@/game/commands/UpgradeSectorCommand";
import { sectorUpgradeCosts, getSectorOutputLevel } from "@/game/systems/factoryBlueprints";
import { useCallback } from "react";
import type { IndustrialSectors } from "@/game/components/Factories";

export function IndustryBreakdown({ industry, entity }: { industry: IndustryComponent; entity: Entity; }) {
    const engine = useGameEngine();

    const handleUpgrade = useCallback((sectorName: keyof IndustrialSectors) => {
        if(!engine) return;
        engine.addCommand(new UpgradeSectorCommand(entity.id, sectorName));
    }, [engine, entity]);

    const a = { ...industry }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-muted">
                    <th className="text-left p-2 font-medium">Sector</th>
                    <th className="text-center p-2 font-medium">Level</th>
                    <th className="text-center p-2 font-medium">Efficiency</th>
                    <th className="text-center p-2 font-medium">Profit</th>
                    <th className="text-center p-2 font-medium">Wealth</th>
                    <th className="text-center p-2 font-medium">Upgrade</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries((a.sectors as IndustrialSectors)).map(([key, value]) => {
                    const sectorKey = key as keyof IndustrialSectors;
                    const profit = a.sectorProfits[sectorKey] ?? 0;
                    const wealth = a.sectorWealth[sectorKey] ?? 0;
                    const upgradeCost = Math.round(sectorUpgradeCosts[sectorKey] * value);
                    const canUpgrade = wealth >= upgradeCost;
                    const outputLevel = getSectorOutputLevel(sectorKey, value);
                    const efficiency = value > 0 ? ((outputLevel / value) * 100) : 100;

                    return (
                        <tr key={key} className="border-b border-muted/50 last:border-0">
                            <td className="p-2 capitalize">{key}</td>
                            <td className="p-2 text-center">{convertToReadable(value)}</td>
                            <td className="p-2 text-center">{efficiency.toFixed(0)}%</td>
                            <td className={`p-2 text-center ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {convertToReadable(Math.round(profit))}
                            </td>
                            <td className="p-2 text-center">{convertToReadable(Math.round(wealth))}</td>
                            <td className="p-2 text-center">
                                <button
                                    onClick={() => handleUpgrade(sectorKey)}
                                    disabled={!canUpgrade}
                                    className={`px-2 py-1 rounded text-xs ${canUpgrade ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
                                >
                                    {upgradeCost}
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
