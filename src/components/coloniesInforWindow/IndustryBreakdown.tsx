import { IndustryComponent } from "@/game/components/industryComponent";
import { Entity } from "@/engine/entities/entity";
import { convertToReadable } from "@/lib/utils";
import { useGameEngine } from "@/hooks/useGameContext";
import { UpgradeSectorCommand } from "@/game/commands/UpgradeSectorCommand";
import { getSectorOutputLevel, industrySectorBlueprints } from "@/game/systems/factoryBlueprints";
import { sectorUpgradeCosts } from "@/game/systems/sectorUpgradeCosts";
import { useCallback, useMemo, useState } from "react";
import type { IndustrialSectors } from "@/game/components/Factories";
import type { Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { Toggle } from "@/components/ui/toggle";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { PopulationIcon, POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";
import { BottleneckCell } from "./BottleneckCell";

export function isPopulationReq(name: keyof Population | keyof Goods): name is keyof Population {
    return name in POPULATION_NAMES;
}

function RequirementItem({ name, scaledReq, actual, hasData }: { name: keyof Population | keyof Goods; scaledReq: number; actual: number; hasData: boolean }) {
    const isFilled = !hasData || actual >= scaledReq * 0.99;
    const colorClass = !hasData ? 'text-muted-foreground' : (isFilled ? 'text-green-400' : 'text-red-400');

    return (
        <span className={`inline-flex items-center gap-1 ${colorClass}`}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center">
                        {isPopulationReq(name) ? (
                            <PopulationIcon name={name} />
                        ) : (
                            <ResourceIcon name={name as keyof Goods} />
                        )}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <span>{isPopulationReq(name) ? POPULATION_NAMES[name] : RESOURCE_NAMES[name] || name}</span>
                </TooltipContent>
            </Tooltip>
            {convertToReadable(Math.round(scaledReq))}
            {hasData && (
                <span className="text-muted-foreground">
                    ({convertToReadable(Math.round(actual))})
                </span>
            )}
        </span>
    );
}

function SectorRow({
    rowKey,
    sectorKey,
    value,
    industry,
    onUpgrade,
    autoUpgrade,
    onToggleAutoUpgrade,
}: {
    rowKey: string;
    sectorKey: keyof IndustrialSectors;
    value: number;
    industry: IndustryComponent;
    onUpgrade: (sectorKey: keyof IndustrialSectors) => void;
    autoUpgrade: Partial<Record<keyof IndustrialSectors, boolean>>;
    onToggleAutoUpgrade: (sectorKey: keyof IndustrialSectors) => void;
}) {
    const profit = industry.sectorProfits[sectorKey] ?? 0;
    const wealth = industry.sectorWealth[sectorKey] ?? 0;
    const upgradeCost = Math.round(sectorUpgradeCosts[sectorKey] * value);
    const canUpgrade = wealth >= upgradeCost;
    const outputLevel = getSectorOutputLevel(sectorKey, value);
    const efficiency = value > 0 ? ((outputLevel / value) * 100) : 100;
    const utilization = industry.sectorUtilization[sectorKey] ?? 0;

    const config = industrySectorBlueprints.get(sectorKey);
    const inputLevel = value;
    const sectorResult = industry.sectorResults?.[sectorKey];
    const hasData = !!sectorResult;
    const isStopped = sectorResult?.productionRatio === 0;

    const reqs = useMemo(() => {
        const items: React.ReactNode[] = [];
        let bottleneck: keyof Population | keyof Goods | null = null;
        let bottleneckRatio = Infinity;

        const addReq = (name: keyof Population | keyof Goods, scaledReq: number, actual: number) => {
            if (hasData && scaledReq > 0) {
                const ratio = actual / scaledReq;
                if (ratio < 0.99 && ratio < bottleneckRatio) {
                    bottleneckRatio = ratio;
                    bottleneck = name;
                }
            }

            items.push(
                <RequirementItem
                    key={name}
                    name={name}
                    scaledReq={scaledReq}
                    actual={actual}
                    hasData={hasData}
                />
            );
        };

        config?.goodsRequirements &&
            Object.entries(config.goodsRequirements).forEach(([good, req]) => {
                const scaledReq = (req as number) * inputLevel;
                const consumed = industry.goods[good as keyof Goods] ?? 0;
                addReq(good as keyof Goods, scaledReq, consumed);
            });

        config?.workerRequirement &&
            Object.entries(config.workerRequirement).forEach(([worker, req]) => {
                const scaledReq = (req as number) * inputLevel;
                const employed = isStopped ? (industry.population[worker as keyof Population].number ?? 0) : (sectorResult?.workersEmployed?.[worker as keyof Population] ?? 0);
                addReq(worker as keyof Population, scaledReq, employed);
            });

        return { items, bottleneck, bottleneckRatio };
    }, [config, inputLevel, industry.goods, industry.population, sectorResult, hasData, isStopped]);

    return (
        <tr key={rowKey} className="border-b border-muted/50 last:border-0">
            <td className="p-2 capitalize">{sectorKey}</td>
            <td className="p-2 text-center">{convertToReadable(value)}</td>
            <td className="p-2 text-center">{(utilization * 100).toFixed(0)}%</td>
            <td className="p-2 text-center">{efficiency.toFixed(0)}%</td>
            <td className={`p-2 text-center ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {convertToReadable(Math.round(profit))}
            </td>
            <td className="p-2 text-center">{convertToReadable(Math.round(wealth))}</td>
            <td className="p-2 text-center">
                <BottleneckCell bottleneck={reqs.bottleneck} bottleneckRatio={reqs.bottleneckRatio} />
            </td>
            <td className="p-2 text-left">
                <div className="text-xs space-y-0.5">
                    {reqs.items.map((req, i) => (
                        <div key={i}>{req} </div>
                    ))}
                </div>
            </td>
            <td className="p-2 text-center">
                <button
                    onClick={() => onUpgrade(sectorKey)}
                    disabled={!canUpgrade}
                    className={`px-2 py-1 rounded text-xs ${canUpgrade ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
                >
                    {upgradeCost}
                </button>
            </td>
            <td className="p-2 text-center">
                <Toggle
                    pressed={!!autoUpgrade[sectorKey]}
                    onPressedChange={() => onToggleAutoUpgrade(sectorKey)}
                    size="sm"
                    variant="outline"
                />
            </td>
        </tr>
    );
}

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
                        <th className="text-center p-2 font-medium">Bottleneck</th>
                        <th className="text-left p-2 font-medium">Requirements</th>
                        <th className="text-center p-2 font-medium">Upgrade</th>
                        <th className="text-center p-2 font-medium">Auto</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries((industry.sectors as IndustrialSectors)).map(([key, value]) => (
                        <SectorRow
                            key={key}
                            rowKey={key}
                            sectorKey={key as keyof IndustrialSectors}
                            value={value}
                            industry={industry}
                            onUpgrade={handleUpgrade}
                            autoUpgrade={autoUpgrade}
                            onToggleAutoUpgrade={toggleAutoUpgrade}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
