import { IndustrialSectors } from "@/game/components/Factories";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods, CAN_BE_NEGATIVE } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { industrySectorBlueprints } from "@/game/systems/sectorBlueprints";
import { convertToReadable } from "@/lib/utils";
import { ReactNode, useMemo } from "react";
import { BottleneckCell } from "./BottleneckCell";
import { RequirementItem } from "./requirementItem";
import { SectorIcon } from "../icons/SectorIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FaCircleExclamation } from "react-icons/fa6";
import { InventoryColumn } from "./InventoryColumn";

export function SectorRow({
    sectorKey,
    industry,
}: {
    sectorKey: keyof IndustrialSectors;
    industry: IndustryComponent;
}) {
const profit = industry.sectorProfits[sectorKey] ?? 0
    const revenue = industry.sectorRevenue[sectorKey] ?? 0
    const laborCosts = industry.sectorLaborCosts?.[sectorKey] ?? 0
    const inputCosts = industry.sectorInputCosts?.[sectorKey] ?? 0
    const utilization = industry.sectorUtilization[sectorKey] ?? 0
    const stopReason = industry.sectorStopReason?.[sectorKey] ?? ""
    const techMultiplier = industry.techMultipliers[sectorKey] ?? 1

    const config = industrySectorBlueprints.get(sectorKey);
    const sectorResult = industry.sectorResults?.get(sectorKey);
    const productionRatio = sectorResult?.productionRatio ?? 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const hasData = !!sectorResult;
    const isStopped = productionRatio === 0;

    const methodName = industry.selectedMethod[sectorKey] ?? null;
    const method = methodName ? config?.productionMethods?.get(methodName) : undefined;
    const materialMethodMult = method?.materialMultiplier ?? 1;
    const workerMethodMult = method?.workerMultiplier ?? 1;
    const inputLevel = sectorResult?.inputLevel ?? 1;

    // Capital goods level: stock / required per unit, bottleneck across all capital goods
    let sectorLevel = 1;
    const capitalGoods = config?.capitalGoods ?? {};
    if(Object.keys(capitalGoods).length > 0) {
        const stock = industry.capitalStock[sectorKey] ?? {};
        const ratios = [];
        for(const [goodKey, requiredPerUnit] of Object.entries(capitalGoods)) {
            const gKey = goodKey as keyof Goods;
            const available = stock[gKey] ?? 0;
            const req = requiredPerUnit ?? 0;
            ratios.push(req > 0 ? available / req : Infinity);
        }
        sectorLevel = Math.min(...ratios);
    }

    const reqs = useMemo(() => {
        const items: ReactNode[] = [];
        let bottleneck: keyof Population | keyof Goods | null = null;
        let bottleneckRatio = Infinity;

        const productionRatio = sectorResult?.productionRatio ?? 1;

        const requirements: { name: keyof Population | keyof Goods; fullCapacityReq: number; currentCapacityReq: number; satisfied: number; isNegativeCapable?: boolean }[] = [];

        if(config?.goodsRequirements) {
            for(const [good, req] of Object.entries(config.goodsRequirements) as [keyof Goods, number][]) {
                const materialMult = industry.materialRequirementMultipliers[good] ?? 1;
                const fullCapacityReq = req * materialMult * materialMethodMult * inputLevel * sectorLevel;
                requirements.push({
                    name: good,
                    fullCapacityReq,
                    currentCapacityReq: fullCapacityReq * productionRatio,
                    satisfied: isStopped ? 0 : (sectorResult?.consumedGoods?.[good] ?? 0),
                    isNegativeCapable: CAN_BE_NEGATIVE.has(good),
                });
            }
        }

        if(config?.workerRequirement) {
            for(const [worker, req] of Object.entries(config.workerRequirement) as [keyof Population, number][]) {
                const workerEffMult = industry.workerEfficiencyMultipliers[worker] ?? 1;
                const fullCapacityReq = (req / Math.max(workerEffMult, 0.01) / Math.max(workerMethodMult, 0.01)) * inputLevel * sectorLevel;
                requirements.push({
                    name: worker,
                    fullCapacityReq,
                    currentCapacityReq: fullCapacityReq * productionRatio,
                    satisfied: isStopped ? 0 : (sectorResult?.workersEmployed?.[worker] ?? 0),
                });
            }
        }

        for(const { name, fullCapacityReq, currentCapacityReq, satisfied, isNegativeCapable } of requirements) {
            if(hasData && currentCapacityReq > 0 && !isNegativeCapable) {
                const reqRatio = satisfied / currentCapacityReq;
                if(reqRatio < 0.99 && reqRatio < bottleneckRatio) {
                    bottleneckRatio = reqRatio;
                    bottleneck = name;
                }
            }
            items.push(<RequirementItem key={name} name={name} fullCapacityReq={fullCapacityReq} currentCapacityReq={currentCapacityReq} satisfied={satisfied} />);
        }

        items.push(<RequirementItem currentCapacityReq={industry.sectorLaborCosts[sectorKey] + industry.sectorInputCosts[sectorKey]} name="money" />);

        return { items, bottleneck, bottleneckRatio }
    }, [config, materialMethodMult, inputLevel, workerMethodMult, sectorLevel, industry.materialRequirementMultipliers, industry.workerEfficiencyMultipliers, sectorResult, hasData, isStopped]);

    return (
        <tr className="border-b border-muted/50 last:border-0">
            <td className="p-2 capitalize">
                <span style={{ display: "flex", gap: "1em" }}>
                    <SectorIcon name={sectorKey} /> {sectorKey} {stopReason && stopReason !== "Producing" && (
                        <Tooltip>
                            <TooltipTrigger asChild >
                                <span className="inline-flex items-center">
                                    <FaCircleExclamation className={isStopped ? "text-red-400" : "text-orange-400"} />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="pt-2 text-center text-xs" title={stopReason}>
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
            <td className="pt-2 text-center">
                <div className="text-xs">
                    {(productionRatio * 100).toFixed(0)}%
                    {sectorLevel < 0.99 && (
                        <div className="text-orange-400">{Math.round(sectorLevel * 100)}% capital</div>
                    )}
                </div>
            </td>
            <td className="pt-2 text-center">
                <div className={`text-xs ${sectorLevel >= 0.99 ? 'text-green-400' : 'text-red-400'}`}>
                    {(sectorLevel).toFixed(0)}
                </div>
            </td>
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
                <div className="text-xs space-y-0.5">
                    {industry.selectedMethod[sectorKey] ?? "Default"}
                </div>
            </td>
            <td className="pt-2 text-center">
                {reqs.items.map((req, i) => (
                    <div className="text-xs space-y-0.5" key={i}>{req}</div>
                ))}
            </td>
            <td className="pt-2 text-left">
                <div className="text-xs space-y-0.5">
                    <InventoryColumn type="capitalGoods" config={config} sectorKey={sectorKey} industry={industry} />
                    <RequirementItem currentCapacityReq={industry.money[sectorKey]} name="money" />
                </div>
            </td>
            <td className="pt-2 text-left">
                <div className="text-xs space-y-0.5">
                    {Object.entries(sectorResult?.producedGoods ?? {}).map(([good, amount]) => (
                        <div key={good} style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
                            <RequirementItem currentCapacityReq={amount} name={good as keyof Goods} />
                        </div>
                    ))}
                    <RequirementItem currentCapacityReq={revenue} name="money" />
                </div>
            </td>
        </tr>
    )
}
