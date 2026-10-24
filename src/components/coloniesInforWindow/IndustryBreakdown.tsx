import { IndustryComponent } from "@/game/components/industryComponent";
import { industrialSectors, type IndustrialSectors } from "@/game/components/Factories";
import { godsCategories, type Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { SectorRow } from "./sectorRow";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useState } from "react";

export function isPopulationReq(name: keyof Population | keyof Goods | "money"): name is keyof Population {
    return name in POPULATION_NAMES;
}

export function IndustryBreakdown({ industry }: { industry: IndustryComponent; }) {
    const [category, setCategory] = useState<string>("rawMaterials")

    return (
        <div className="overflow-x-auto">
            <ToggleGroup onValueChange={setCategory} value={category} type="single" >
                {[...industrialSectors.keys()].map((key) => {
                    return <ToggleGroupItem key={key} value={key}>{key}</ToggleGroupItem>
                })}
            </ToggleGroup>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-muted">
                        <th className="text-left p-2 font-medium">Sector</th>
                        <th className="text-center p-2 font-medium">Tech Mult.</th>
                        <th className="text-center p-2 font-medium">Utilization</th>
                        <th className="text-center p-2 font-medium">Efficiency</th>
                        <th className="text-center p-2 font-medium">Profit</th>
                        <th className="text-center p-2 font-medium">Margin</th>
                        <th className="text-center p-2 font-medium">Bottleneck</th>
                        <th className="text-left p-2 font-medium">Requirements</th>
                        <th className="text-left p-2 font-medium">Stock</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from(industry.activeSectors.intersection(industrialSectors.get(category) ?? new Set())).sort((a, b) => a.localeCompare(b)).map((key) => (
                        <SectorRow
                            key={key}
                            rowKey={key}
                            sectorKey={key as keyof IndustrialSectors}
                            industry={industry}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
