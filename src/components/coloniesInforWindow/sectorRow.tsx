import { IndustrialSectors } from "@/game/components/Factories";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { industrySectorBlueprints } from "@/game/systems/factoryBlueprints";
import { convertToReadable } from "@/lib/utils";
import { useMemo } from "react";
import { BottleneckCell } from "./BottleneckCell";
import { RequirementItem } from "./requirementItem";
import { SectorIcon } from "../icons/SectorIcon";

export function SectorRow({
    rowKey,
    sectorKey,
    industry,
}: {
    rowKey: string;
    sectorKey: keyof IndustrialSectors;
    industry: IndustryComponent;
}) {
    const profit = industry.sectorProfits[sectorKey] ?? 0;
    const utilization = industry.sectorUtilization[sectorKey] ?? 0;
    const techMultiplier = industry.techMultipliers[sectorKey] ?? 1;

    const config = industrySectorBlueprints.get(sectorKey);
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

        if(config?.goodsRequirements) {
            (Object.entries(config.goodsRequirements) as [keyof Goods, number][]).forEach(([good, req]) => {
                const scaledReq = req * techMultiplier;
                const consumed = industry.goods[good] ?? 0;
                addReq(good, scaledReq, consumed);
            });
        }

        if(config?.workerRequirement) {
            (Object.entries(config.workerRequirement) as [keyof Population, number][]).forEach(([worker, req]) => {
                const scaledReq = (req as number) * techMultiplier;
                const employed = isStopped ? (industry.population[worker].number ?? 0) : (sectorResult?.workersEmployed?.[worker] ?? 0);
                addReq(worker, scaledReq, employed);
            });
        }

        return { items, bottleneck, bottleneckRatio };
    }, [config, techMultiplier, industry.goods, industry.population, sectorResult, hasData, isStopped]);

    return (
        <tr key={rowKey} className="border-b border-muted/50 last:border-0">
            <td className="p-2 capitalize">
                <span style={{ display: "flex", gap: "1em" }}>
                    <SectorIcon name={sectorKey} /> {sectorKey}
                </span>
            </td>
            <td className="p-2 text-center">{techMultiplier.toFixed(2)}</td>
            <td className="p-2 text-center">{(utilization * 100).toFixed(0)}%</td>
            <td className="p-2 text-center">100%</td>
            <td className={`p-2 text-center ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {convertToReadable(Math.round(profit))}
            </td>
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
            <td className="p-2 text-left">
                <div className="text-xs space-y-0.5">
                    {
                        (() => {
                            const stock = industry.capitalStock[sectorKey] ?? {};
                            const entries = Object.entries(stock) as [keyof Goods, number][];

                            return entries.map(([good, amount]) =>
                                <div key={good}>
                                    <RequirementItem actual={amount} hasData name={good} scaledReq={amount} />
                                </div>)
                        })()
                    }
                </div>
            </td>
        </tr>
    );
}
