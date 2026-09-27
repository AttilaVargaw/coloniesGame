import { IndustrialSectors } from "@/game/components/Factories";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { getSectorOutputLevel, industrySectorBlueprints } from "@/game/systems/factoryBlueprints";
import { sectorUpgradeCosts } from "@/game/systems/sectorUpgradeCosts";
import { convertToReadable } from "@/lib/utils";
import { useMemo } from "react";
import { BottleneckCell } from "./BottleneckCell";
import { Toggle } from "../ui/toggle";
import { RequirementItem } from "./requirementItem";

export function SectorRow({
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
            if(hasData && scaledReq > 0) {
                const ratio = actual / scaledReq;
                if(ratio < 0.99 && ratio < bottleneckRatio) {
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