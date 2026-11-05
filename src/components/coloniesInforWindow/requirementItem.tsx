import { Goods } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { PopulationIcon, POPULATION_NAMES } from "../icons/PopulationIcon";
import { ResourceIcon, RESOURCE_NAMES } from "../icons/ResourceIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isPopulationReq } from "./IndustryBreakdown";
import { TbHexagonNumber4 } from "react-icons/tb";
import { useMemo } from "react";
import { cn } from "cn";

export function RequirementItem({ name, fullCapacityReq, currentCapacityReq, satisfied, hasData, isNegativeCapable }: { name: keyof Population | keyof Goods | "money"; fullCapacityReq: number; currentCapacityReq: number; satisfied: number; hasData?: boolean; isNegativeCapable?: boolean; ratio?: number }) {
    const isFilled = !hasData || satisfied >= currentCapacityReq * 0.99;
    const colorClass = !hasData ? 'text-muted-foreground' : (isFilled ? 'text-green-400' : 'text-red-400');
    const icon = useMemo(() => {
        if(name === "money") {
            return <TbHexagonNumber4 className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
        } else {
            return isPopulationReq(name) ? <PopulationIcon name={name} /> : <ResourceIcon name={name} />
        }
    }, [name])

    return (
        <span style={{ flex: 1 }} className={cn('inline-flex', 'items-center', 'gap-1', colorClass)}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center"> {icon} </span>
                </TooltipTrigger>
                <TooltipContent>
                    <span>{isPopulationReq(name) ? POPULATION_NAMES[name] : RESOURCE_NAMES[name] || name}</span>
                </TooltipContent>
            </Tooltip>
            {isNegativeCapable && hasData && fullCapacityReq < 0 ? (
                <span className="text-orange-400">{convertToReadable(Math.round(fullCapacityReq))}</span>
            ) : (
                <>
                    {convertToReadable(Math.round(fullCapacityReq))}
                    {hasData && (
                        <>
                            <span className="text-muted-foreground"> / {convertToReadable(Math.round(currentCapacityReq))}</span>
                            <span className="text-muted-foreground"> ({convertToReadable(Math.round(satisfied))})</span>
                        </>
                    )}
                </>
            )}
        </span>
    );
}
