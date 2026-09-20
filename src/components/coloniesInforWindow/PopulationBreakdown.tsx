import { IndustryComponent } from "@/game/components/industryComponent";
import { Population, sumPopulation, baseSalaries } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { colorBySign, } from "./colorBySign";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { PopulationIcon, POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { TooltipTrigger, TooltipContent, Tooltip } from "@/components/ui/tooltip";
import { Goods } from "@/game/data/Goods";

function Sum(...args: number[]) {
    let sum = 0

    for(const it of args) {
        sum += it
    }

    return sum
}

export function PopulationBreakdown({ industry }: { industry: IndustryComponent; }) {
    const populationSum = sumPopulation(industry.population);
    const popGrowth = Sum(...Object.values(industry.population).map(e => e.populationChange))
    const unemployedSum = sumPopulation(industry.freeWorkers) - industry.freeWorkers.retired.number - industry.freeWorkers.student.number;


    const employedSum = populationSum - unemployedSum - industry.population.retired.number - industry.population.student.number;
    console.log({ unemployedSum, employedSum })

    const totalIncome = Object.entries(industry.population).reduce((sum, [key, value]) => {
        return sum + (baseSalaries[key as keyof Population] || 0) * value.number;
    }, 0);

    const totalNet = Object.values(industry.populationProfits).reduce((sum, val) => sum + val, 0);
    const totalExpenses = totalIncome - totalNet;

    const workingAgePopulation = populationSum - industry.population.retired.number - industry.population.student.number

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-muted">
                            <th className="text-left p-2 font-medium">Metric</th>
                            <th className="text-right p-2 font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Population</td>
                            <td className="p-2 text-right">
                                {convertToReadable(populationSum)}
                            </td>
                            <td className="p-2 text-right">
                                {colorBySign(popGrowth)}
                            </td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Working Age Population</td>
                            <td className="p-2 text-right">
                                {convertToReadable(workingAgePopulation)}
                            </td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Unemployed</td>
                            <td className="p-2 text-right">{convertToReadable(unemployedSum)}</td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Employed</td>
                            <td className="p-2 text-right">{convertToReadable(employedSum)} ({(employedSum / workingAgePopulation * 100).toFixed(2)}%)</td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Total Income</td>
                            <td className="p-2 text-right">{convertToReadable(Math.round(totalIncome))}</td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Total Expenses</td>
                            <td className="p-2 text-right">{convertToReadable(Math.round(totalExpenses))}</td>
                        </tr>
                        <tr className="border-b border-muted/50">
                            <td className="p-2">Total Net</td>
                            <td className="p-2 text-right">{colorBySign(totalNet)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
                        {Object.entries((industry.population)).map(([key, value]) => {
                            const { number, populationChange } = value
                            const income = (baseSalaries[key as keyof Population] || 0) * number;
                            const net = industry.populationProfits[key as keyof Population] ?? 0;
                            const expenses = income - net;
                            const requirements = industry.populationRequirements?.[key as keyof Population] || {};
                            const reqEntries = Object.entries(requirements) as [keyof Goods, number][];

                            return <tr key={key} className="border-b border-muted/50 last:border-0">
                                <td className="p-2">
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
                                </td>
                                <td className="p-2 text-right">{convertToReadable(number)}</td>
                                <td className="p-2 text-right">{convertToReadable(industry.workingWorkers[key as keyof Population].number || 0)}</td>
                                <td className="p-2 text-right">{colorBySign(populationChange)}</td>
                                <td className="p-2 text-right">{convertToReadable(Math.round(income))}</td>
                                <td className="p-2 text-right">{convertToReadable(Math.round(expenses))}</td>
                                <td className="p-2 text-right">{colorBySign(net)}</td>
                                <td className="p-2 text-right">{value.qol.toFixed(1)}</td>
                                <td className="p-2 text-left">
                                    {reqEntries.length === 0 ? (
                                        <span className="text-muted-foreground text-xs">—</span>
                                    ) : (
                                        <div className="text-xs space-y-0.5">
                                            {reqEntries.map(([good, req]) => {
                                                const available = industry.goods[good as keyof typeof industry.goods] ?? 0;
                                                const isFilled = available >= req;
                                                const colorClass = isFilled ? 'text-green-400' : 'text-red-400';
                                                return (
                                                    <div key={good} className={`items-center gap-1 ${colorClass}`}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="inline-flex items-center">
                                                                    <ResourceIcon name={good} />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <span>{RESOURCE_NAMES[good] || good}</span>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        {convertToReadable(Math.round(req))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
