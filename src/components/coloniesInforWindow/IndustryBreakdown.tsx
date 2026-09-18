import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { convertToReadable } from "@/lib/utils";
import { useGameEngine } from "@/hooks/useGameContext";
import { UpgradeSectorCommand } from "@/game/commands/UpgradeSectorCommand";
import { sectorUpgradeCosts, getSectorOutputLevel, industryReducers } from "@/game/systems/factoryBlueprints";
import { useCallback, useState } from "react";
import type { IndustrialSectors } from "@/game/components/Factories";
import type { Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { Toggle } from "@/components/ui/toggle";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { PopulationIcon, POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";

export function IndustryBreakdown({ industry, entity }: { industry: IndustryComponent; entity: Entity; }) {
    const engine = useGameEngine();
    const [autoUpgrade, setAutoUpgrade] = useState<Partial<Record<keyof IndustrialSectors, boolean>>>(industry.autoUpgradeSectors)

    const handleUpgrade = useCallback((sectorName: keyof IndustrialSectors) => {
        if(!engine) return;
        engine.addCommand(new UpgradeSectorCommand(entity.id, sectorName));
    }, [engine, entity]);

    const toggleAutoUpgrade = useCallback((sectorName: keyof IndustrialSectors) => {
        setAutoUpgrade(prev => {
            const next = { ...prev, [sectorName]: !prev[sectorName] }
            industry.autoUpgradeSectors = next
            return next
        })
    }, [industry])

    const a = { ...industry }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-muted">
                        <th className="text-left p-2 font-medium">Sector</th>
                        <th className="text-center p-2 font-medium">Level</th>
                        <th className="text-center p-2 font-medium">Utilization</th>
                        <th className="text-center p-2 font-medium">Efficiency</th>
                        <th className="text-center p-2 font-medium">Profit</th>
                        <th className="text-center p-2 font-medium">Wealth</th>
                        <th className="text-left p-2 font-medium">Requirements</th>
                        <th className="text-center p-2 font-medium">Upgrade</th>
                        <th className="text-center p-2 font-medium">Auto</th>
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
                        const utilization = a.sectorUtilization[sectorKey] ?? 0;

                        const blueprintEntry = industryReducers.find(([n]) => n === sectorKey);
                        const config = blueprintEntry?.[1] && (blueprintEntry[1] as any)?.config;
                        const inputLevel = config?.levelModifier ? config.levelModifier(value) : value;

                        const sectorResult = a.sectorResults?.[sectorKey];
                        const hasData = !!sectorResult;

                        const reqs: React.ReactNode[] = [];

                        const addReq = (name: string, scaledReq: number, actual: number) => {
                            const isFilled = !hasData || actual >= scaledReq * 0.99;
                            const colorClass = !hasData ? 'text-muted-foreground' : (isFilled ? 'text-green-400' : 'text-red-400');
                            const isPopulation = name in POPULATION_NAMES

                            reqs.push(
                                <span key={name} className={`inline-flex items-center gap-1 ${colorClass}`}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex items-center">
                                                {isPopulation ? (
                                                    <PopulationIcon name={name} />
                                                ) : (
                                                    <ResourceIcon name={name} />
                                                )}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <span>{isPopulation ? POPULATION_NAMES[name] : RESOURCE_NAMES[name] || name}</span>
                                        </TooltipContent>
                                    </Tooltip>
                                    {convertToReadable(Math.round(scaledReq))}
                                </span>
                            );
                        };

                        if(config?.goodsRequirements) {
                            for(const [good, req] of Object.entries(config.goodsRequirements) as [keyof Goods, number][]) {
                                const scaledReq = (req as number) * inputLevel;
                                const consumed = sectorResult?.consumedGoods?.[good] ?? 0;
                                addReq(good, scaledReq, consumed);
                            }
                        }

                        if(config?.workerRequirement) {
                            for(const [worker, req] of Object.entries(config.workerRequirement) as [keyof Population, number][]) {
                                const scaledReq = (req as number) * inputLevel;
                                const employed = sectorResult?.workersEmployed?.[worker] ?? 0;
                                addReq(worker, scaledReq, employed);
                            }
                        }

                        return (
                            <tr key={key} className="border-b border-muted/50 last:border-0">
                                <td className="p-2 capitalize">{key}</td>
                                <td className="p-2 text-center">{convertToReadable(value)}</td>
                                <td className="p-2 text-center">{(utilization * 100).toFixed(0)}%</td>
                                <td className="p-2 text-center">{efficiency.toFixed(0)}%</td>
                                <td className={`p-2 text-center ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {convertToReadable(Math.round(profit))}
                                </td>
                                <td className="p-2 text-center">{convertToReadable(Math.round(wealth))}</td>
                                <td className="p-2 text-left">
                                    <div className="text-xs space-y-0.5">
                                        {reqs.map((req, i) => (
                                            <div key={i}>{req} </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-2 text-center">
                                    <button
                                        onClick={() => handleUpgrade(sectorKey)}
                                        disabled={!canUpgrade}
                                        className={`px-2 py-1 rounded text-xs ${canUpgrade ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
                                    >
                                        {upgradeCost}
                                    </button>
                                </td>
                                <td className="p-2 text-center">
                                    <Toggle
                                        pressed={!!autoUpgrade[sectorKey]}
                                        onPressedChange={() => toggleAutoUpgrade(sectorKey)}
                                        size="sm"
                                        variant="outline"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
