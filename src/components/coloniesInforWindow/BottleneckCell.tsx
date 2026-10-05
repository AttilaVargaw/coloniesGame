import type { Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { PopulationIcon } from "../icons/PopulationIcon";
import { ResourceIcon } from "../icons/ResourceIcon";
import { isPopulationReq } from "./IndustryBreakdown";

export function BottleneckCell({ bottleneck, bottleneckRatio }: { bottleneck: keyof Population | keyof Goods | null; bottleneckRatio: number; }) {
    if(!bottleneck) {
        return <span className="text-green-400 text-xs">—</span>
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-red-400 text-xs capitalize inline-flex items-center gap-1">
                {isPopulationReq(bottleneck) ? (
                    <PopulationIcon name={bottleneck} />
                ) : (
                    <ResourceIcon name={bottleneck as keyof Goods} />
                )}
                {bottleneck}
            </span>
            <span className="text-red-400/70 text-[10px]">
                {convertToReadable(Math.round(bottleneckRatio * 100))}%
            </span>
        </div>
    );
}
