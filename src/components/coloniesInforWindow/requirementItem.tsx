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

export function RequirementItem({ name, fullCapacityReq, currentCapacityReq, satisfied }: { name: keyof Population | keyof Goods | "money"; fullCapacityReq?: number; currentCapacityReq: number; satisfied?: number; }) {
    const icon = useMemo(() => {
        if(name === "money") {
            return <TbHexagonNumber4 className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
        } else {
            return isPopulationReq(name) ? <PopulationIcon name={name} /> : <ResourceIcon name={name} />
        }
    }, [name])

    let color = "text-green-400"

    if(satisfied && satisfied <= currentCapacityReq * 0.99) {
        color = "text-red-400"
    }

    const inside = useMemo(() => {
        const ret = []

        if(fullCapacityReq !== undefined) {
            ret.push(<span key="full">{convertToReadable(Math.round(fullCapacityReq))}</span>)
        }
        if(currentCapacityReq !== undefined) {
            ret.push(ret.length > 0 && "/", <span key="current">{convertToReadable(Math.round(currentCapacityReq))}</span >)
        }
        if(satisfied !== undefined) {
            ret.push(ret.length > 0 && "/", <span key="satisfied">({convertToReadable(Math.round(satisfied))})</span>)
        }

        return ret
    }, [name, icon, fullCapacityReq, currentCapacityReq, satisfied])

    return (
        <span style={{ flex: 1 }} className={cn('inline-flex', 'items-center', 'gap-1', color)}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center"> {icon} </span>
                </TooltipTrigger>
                <TooltipContent>
                    <span>{isPopulationReq(name) ? POPULATION_NAMES[name] : RESOURCE_NAMES[name] || name}</span>
                </TooltipContent>
            </Tooltip>
            {inside}
        </span >
    );
}
