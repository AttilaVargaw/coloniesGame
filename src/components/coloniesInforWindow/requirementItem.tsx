import { Goods } from "@/game/data/Goods";
import { Population } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { PopulationIcon, POPULATION_NAMES } from "../icons/PopulationIcon";
import { ResourceIcon, RESOURCE_NAMES } from "../icons/ResourceIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isPopulationReq } from "./IndustryBreakdown";
import { CircleDollarSign } from "lucide-react";
import { useMemo } from "react";


export function RequirementItem({ name, scaledReq, actual, hasData }: { name: keyof Population | keyof Goods | "money"; scaledReq: number; actual: number; hasData: boolean }) {
    const isFilled = !hasData || actual >= scaledReq * 0.99;
    const colorClass = !hasData ? 'text-muted-foreground' : (isFilled ? 'text-green-400' : 'text-red-400');
    const icon = useMemo(() => {
        if(name === "money") {
            return <CircleDollarSign className="w-4 h-4" strokeWidth={1.5} />
        } else {
            return isPopulationReq(name) ? <PopulationIcon name={name} /> : <ResourceIcon name={name} />
        }
    }, [name])

    return (
        <span className={`inline-flex items-center gap-1 ${colorClass}`}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center"> {icon} </span>
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