import { IndustrialSectors } from "@/game/components/Factories";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { industrySectorBlueprints } from "@/game/systems/sectorBlueprints";
import { convertToReadable } from "@/lib/utils";
import { useMemo } from "react";
import { BottleneckCell } from "./BottleneckCell";
import { RequirementItem } from "./requirementItem";
import { SectorIcon } from "../icons/SectorIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FaCircleExclamation } from "react-icons/fa6";

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
    const revenue = industry.sectorRevenue[sectorKey] ?? 0;
    const laborCosts = industry.sectorLaborCosts?.[sectorKey] ?? 0;
    const inputCosts = industry.sectorInputCosts?.[sectorKey] ?? 0;
    const utilization = industry.sectorUtilization[sectorKey] ?? 0;
    const stopReason = industry.sectorStopReason?.[sectorKey] ?? "";
    const techMultiplier = industry.techMultipliers[sectorKey] ?? 1;

    const config = industrySectorBlueprints.get(sectorKey);
    const sectorResult = industry.sectorResults?.[sectorKey];
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
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
                const consumed = industry.sectorGoods[sectorKey]?.[good] ?? 0;
                addReq(good, scaledReq, consumed);
            });
        }

        if(config?.workerRequirement) {
            const capitalAdequacy = sectorResult?.inputLevel ?? 1;
            (Object.entries(config.workerRequirement) as [keyof Population, number][]).forEach(([worker, req]) => {
                const scaledReq = (req as number) * techMultiplier * capitalAdequacy;
                const employed = isStopped ? (industry.population[worker].number ?? 0) : (sectorResult?.workersEmployed?.[worker] ?? 0);
                addReq(worker, scaledReq, employed);
            });
        }

        return { items, bottleneck, bottleneckRatio };
    }, [config, techMultiplier, sectorKey, industry.sectorGoods, industry.population, sectorResult, hasData, isStopped]);

    return (
        <tr key={rowKey} className="border-b border-muted/50 last:border-0">
            <td className="p-2 capitalize">
                <span style={{ display: "flex", gap: "1em" }}>
                    <SectorIcon name={sectorKey} /> {sectorKey} {isStopped && stopReason && (
                        <Tooltip>
                            <TooltipTrigger asChild >
                                <span className="inline-flex items-center">
                                    <FaCircleExclamation className="text-red-400" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="pt-2 text-center text-xs text-red-400" title={stopReason}>
                                    {stopReason}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {reqs.bottleneck && <Tooltip>
                        <TooltipTrigger asChild >
                            <span className="inline-flex items-center">
                                <FaCircleExclamation className="text-orange-400" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <BottleneckCell bottleneck={reqs.bottleneck} bottleneckRatio={reqs.bottleneckRatio} />
                        </TooltipContent>
                    </Tooltip>}
                </span>
            </td>
            <td className="pt-2 text-center">{techMultiplier.toFixed(2)}</td>
            <td className="pt-2 text-center">{(utilization * 100).toFixed(0)}%</td>
            {/* <td className=" text-center">100%</td> */}
            <td className={`pt-2 text-center`}>
                <div className="flex flex-col">
                    <span className="text-green-400">
                        {convertToReadable(Math.round(revenue))}
                    </span>
                    <span className="text-red-400">
                        {convertToReadable(Math.round(laborCosts))} + {convertToReadable(Math.round(inputCosts))}
                    </span>
                    <span className={`${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {convertToReadable(Math.round(profit))}
                    </span>
                </div>
            </td>
            <td className={`pt-2 text-center ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {hasData ? `${margin.toFixed(0)}%` : '—'}
            </td>
            <td className="pt-2 text-center text-xs">
                {industry.selectedMethod[sectorKey] ?? "Default"}
            </td>
            <td className="pt-2 text-left">
                <div className="text-xs space-y-0.5">
                    {reqs.items.map((req, i) => (
                        <div key={i}>{req} </div>
                    ))}
                </div>
            </td>
            <td className="pt-2 text-left">
                <div className="text-xs space-y-0.5">
                    {
                        (() => {
                            const stock = industry.capitalStock[sectorKey] ?? {};
                            const sectorInv = industry.sectorGoods[sectorKey] ?? {};
                            const money = industry.money[sectorKey];

                            const relevantGoods =
                                new Set([
                                    ...Object.keys(config?.capitalGoods ?? {}),
                                    ...Object.keys(config?.goodsRequirements ?? {}),
                                    ...Object.keys(config?.goodsProduction ?? {}),
                                ]) as Set<keyof Goods>

                            return [...relevantGoods.values()].map((good) => {
                                const isCapitalGood = config?.capitalGoods?.[good] !== undefined;
                                const cap = stock[good] ?? 0;
                                const amount = sectorInv[good] ?? 0;

                                // Show capital stock as primary value for capital goods,
                                // sector inventory for raw materials/products
                                const primaryAmount = isCapitalGood ? cap : amount;
                                const secondaryAmount = isCapitalGood ? amount : cap;

                                return (
                                    <div key={good} style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
                                        <RequirementItem actual={primaryAmount} hasData name={good} scaledReq={primaryAmount} />
                                        {secondaryAmount > 0 && (
                                            <span className="text-xs text-muted-foreground">({convertToReadable(Math.round(secondaryAmount * 100) / 100)} {isCapitalGood ? "inv" : "cap"})</span>
                                        )}
                                    </div>
                                );
                            }).concat(
                                <div key="money" style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
                                    <RequirementItem actual={money} name="money" scaledReq={money} />
                                </div>
                            )
                        })()
                    }
                </div>
            </td>
        </tr>
    );
}
