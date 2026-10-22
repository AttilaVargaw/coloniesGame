import { IndustryComponent } from "@/game/components/industryComponent";
import { Population, baseSalaries } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { PopulationIcon, POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";
import { Goods } from "@/game/data/Goods";
import { RequirementItem } from "./requirementItem";

export function PopulationBreakdown({ industry: { population, populationProfits, populationRequirements, workingWorkers, goods } }: { industry: IndustryComponent; }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm mt-4">
                <thead>
                    <tr className="border-b border-muted">
                        <th className="text-left p-2 font-medium">Group</th>
                        <th className="text-right p-2 font-medium">Count</th>
                        <th className="text-right p-2 font-medium">Working</th>
                        <th className="text-right p-2 font-medium">Growth</th>
                        <th className="text-right p-2 font-medium">Income</th>
                        <th className="text-right p-2 font-medium">Expenses</th>
                        <th className="text-right p-2 font-medium">Net</th>
                        <th className="text-right p-2 font-medium">QoL</th>
                        <th className="text-left p-2 font-medium">Requirements</th>
                    </tr>
                </thead>
                <tbody>
                    {(Object.entries((population)) as [keyof Population, Population[keyof Population]][]).map(([key, { number, populationChange, qol }]) => {
                        const income = (baseSalaries[key] || 0) * number;
                        const net = populationProfits[key] ?? 0;
                        const expenses = income - net;
                        const requirements = populationRequirements?.[key] || {};
                        const reqEntries = Object.entries(requirements) as [keyof Goods, number][];

                        return <tr key={key} className="border-b border-muted/50 last:border-0">
                            <td className="p-2">
                                <span style={{ display: "flex", gap: "1em" }}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex items-center">
                                                <PopulationIcon name={key} />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <span>{POPULATION_NAMES[key] || key}</span>
                                        </TooltipContent>
                                    </Tooltip>
                                    {POPULATION_NAMES[key] || key}
                                </span>
                            </td>
                            <td className="p-2 text-right">{convertToReadable(number)}</td>
                            <td className="p-2 text-right">{convertToReadable(workingWorkers[key].number || 0)}</td>
                            <td className="p-2 text-right">{convertToReadable(populationChange)}</td>
                            <td className="p-2 text-right">{convertToReadable(Math.round(income))}</td>
                            <td className="p-2 text-right">{convertToReadable(Math.round(expenses))}</td>
                            <td className="p-2 text-right">{convertToReadable(net)}</td>
                            <td className="p-2 text-right">{qol.toFixed(1)}</td>
                            <td className="p-2 text-left">
                                {reqEntries.length === 0 ? (
                                    <span className="text-muted-foreground text-xs">—</span>
                                ) : (
                                    <div className="text-xs space-y-0.5" style={{ display: "flex", flexFlow: "wrap", gap: "1em" }}>
                                        {reqEntries.map(([good, req]) => {
                                            const available = goods[good] ?? 0;
                                            return (
                                                <RequirementItem key={good} hasData actual={available} name={good} scaledReq={req} />
                                            );
                                        })}
                                    </div>
                                )}
                            </td>
                        </tr>
                    })}
                </tbody>
            </table>
        </div>
    );
}
