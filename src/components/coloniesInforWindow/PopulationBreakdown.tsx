import { IndustryComponent } from "@/game/components/industryComponent";
import { Population, sumPopulation } from "@/game/data/Population";
import { convertToReadable } from "@/lib/utils";
import { colorBySign, } from "./colorBySign";

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

    return (
        <>
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
                        <td className="p-2">Working Population</td>
                        <td className="p-2 text-right">
                            {convertToReadable(populationSum - industry.population.retired.number - industry.population.student.number)}
                        </td>
                    </tr>
                    <tr className="border-b border-muted/50">
                        <td className="p-2">Unemployed</td>
                        <td className="p-2 text-right">{convertToReadable(unemployedSum)}</td>
                    </tr>
                </tbody>
            </table>
            <table className="w-full text-sm mt-4">
                <thead>
                    <tr className="border-b border-muted">
                        <th className="text-left p-2 font-medium">Group</th>
                        <th className="text-right p-2 font-medium">Count</th>
                        <th className="text-right p-2 font-medium">Working</th>
                        <th className="text-right p-2 font-medium">Growth</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries((industry.population)).map(([key, value]) => {
                        const { number, populationChange } = value

                        return <tr key={key} className="border-b border-muted/50 last:border-0">
                            <td className="p-2 capitalize">{key}</td>
                            <td className="p-2 text-right">{convertToReadable(number)}</td>
                            <td className="p-2 text-right">{convertToReadable(industry.workingWorkers[key as keyof Population].number || 0)}</td>
                            <td className="p-2 text-right">{colorBySign(populationChange)}</td>
                        </tr>;
                    })}
                </tbody>
            </table>
        </>
    );
}
