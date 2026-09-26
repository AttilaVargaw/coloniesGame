import { IndustryComponent } from "@/game/components/industryComponent";
import { Population, sumPopulation, baseSalaries } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { colorBySign, } from "./colorBySign";
import { InfoComponent } from "@/engine/components/infoComponent";

function Sum(...args: number[]) {
    let sum = 0

    for(const it of args) {
        sum += it
    }

    return sum
}

export function ColonySummary({ industry, info }: { industry: IndustryComponent; info?: InfoComponent }) {
    const populationSum = sumPopulation(industry.population);
    const popGrowth = Sum(...Object.values(industry.population).map(e => e.populationChange))
    const unemployedSum = sumPopulation(industry.freeWorkers) - industry.freeWorkers.retired.number - industry.freeWorkers.student.number;

    const employedSum = populationSum - unemployedSum - industry.population.retired.number - industry.population.student.number;

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
                        {info && <tr className="border-b border-muted/50">
                            <td className="p-2">Patron God: { }</td>
                            <td className="p-2 text-right">{colorBySign(totalNet)}</td>
                        </tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
