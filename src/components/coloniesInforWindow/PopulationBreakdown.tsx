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

    return (
        <>
            <table style={{ width: "100%" }}>
                <tbody>
                    <tr>
                        <td>Population</td>
                        <td>
                            {convertToReadable(populationSum)}
                        </td>
                        <td>
                            {colorBySign(popGrowth)}
                        </td>
                    </tr>
                    <tr>
                        <td> Working Population</td>
                        <td>
                            {convertToReadable(populationSum - industry.population.retired.number - industry.population.student.number)}
                        </td>
                    </tr>
                </tbody>
                <tbody>
                    {Object.entries((industry.population)).map(([key, value]) => {
                        const { number, populationChange } = value

                        console.log(colorBySign(populationChange))

                        return <tr key={key}>
                            <td>{key}</td>
                            <td>{convertToReadable(number)} ({convertToReadable(industry.workingWorkers[key as keyof Population].number || 0)} is working)</td>
                            <td>{colorBySign(populationChange)}</td>
                        </tr>;
                    })}
                </tbody>
            </table>
        </>
    );
}
