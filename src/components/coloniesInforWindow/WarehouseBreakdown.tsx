import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { convertToReadable } from "@/lib/utils";
import { colorBySign } from "./colorBySign";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";

export function WarehouseBreakdown({ industry: { goods, goodsProduction, goodsRequirements } }: { industry: IndustryComponent; }) {
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-muted">
                    <th className="text-left p-2 font-medium">Good</th>
                    <th className="text-right p-2 font-medium">Stock</th>
                    <th className="text-center p-2 font-medium">Net</th>
                    <th className="text-center p-2 font-medium">Production</th>
                    <th className="text-center p-2 font-medium">Requirements</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(goods).map(([key, value]) => {
                    const addition = goodsProduction[key as keyof Goods] || 0;
                    const used = goodsRequirements[key as keyof Goods] || 0;

                    return <tr key={key} className="border-b border-muted/50 last:border-0">
                        <td className="p-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex items-center">
                                        <ResourceIcon name={key} />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <span>{RESOURCE_NAMES[key] || key}</span>
                                </TooltipContent>
                            </Tooltip>
                        </td>
                        <td className="p-2 text-right">{convertToReadable(value || 0)}</td>
                        <td className="p-2 text-center">{colorBySign(addition - (used || 0))}</td>
                        <td className="p-2 text-center">{convertToReadable(addition)}</td>
                        <td className="p-2 text-center">{convertToReadable(used)}</td>
                    </tr>;
                })}
            </tbody>
        </table>
    );
}
