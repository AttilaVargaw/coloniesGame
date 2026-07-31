import { IndustryComponent } from "@/game/components/industryComponent";
import { Population } from "@/game/data/Population";
import { sumValues } from "@/lib/utils";
import { convertToReadable } from "@/lib/utils";

export function PopulationBreakdown({ industry }: { industry: IndustryComponent; }) {
    const fmt = (v: number) => <span color="red">
        {`(${v.toFixed(1)}/day)`}
    </span>;
    const populationSum = sumValues(industry.population);
    const popGrowth = (industry.goods.happiness - 0.5) * industry.goods.happiness / 15000;

    return (
        <>
            <table style={{ width: "100%" }}>
                <tbody>
                    <tr>
                        <td>Population</td>
                        <td>
                            {convertToReadable(populationSum)} <span className="text-neutral-400">{fmt(popGrowth)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td> Working Population</td>
                        <td>
                            {convertToReadable(populationSum - industry.population.retired - industry.population.student)}
                        </td>
                    </tr>
                </tbody>
                <tbody>
                    {Object.entries((industry.population)).map(([key, value]) => {
                        return <tr key={key}>
                            <td>{key}</td><td>{convertToReadable(value)} ({convertToReadable(industry.workingWorkers[key as keyof Population])} is working)</td>
                        </tr>;
                    })}
                </tbody>
            </table>
        </>
    );
}
