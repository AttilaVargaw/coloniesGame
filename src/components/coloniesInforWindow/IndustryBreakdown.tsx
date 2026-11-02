import { IndustryComponent } from "@/game/components/industryComponent";
import { industrialSubsectors, } from "@/game/components/Factories";
import { type Goods } from "@/game/data/Goods";
import type { Population } from "@/game/data/Population";
import { POPULATION_NAMES } from "@/components/icons/PopulationIcon";
import { SectorRow } from "./sectorRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export function isPopulationReq(name: keyof Population | keyof Goods | "money"): name is keyof Population {
    return name in POPULATION_NAMES;
}

export function IndustryBreakdown({ industry }: { industry: IndustryComponent; }) {
    return (
        <Tabs className="overflow-x-auto">
            {/* <div className="border-b border-gray-700 p-2 mb-2 flex items-center justify-between gap-4">
                <div>
                    <div className="font-medium">Colony Treasury</div>
                    <div className="font-mono text-yellow-400">{Math.round(industry.colonyTreasury)}</div>
                </div>
                <div className="text-xs text-gray-400">
                    Allocate funds via Government → Industry Policy
                </div>
            </div> */}
            <TabsList defaultValue="energy">
                {[...industrialSubsectors.keys()].map((key) => {
                    return <TabsTrigger key={key} value={key}>{key}</TabsTrigger>
                })}
            </TabsList>
            {[...industrialSubsectors.keys()].map((key) => (
                <TabsContent key={key} value={key} style={{ overflowY: "auto", }} >
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
                                <th className="text-center p-2 font-medium">Method</th>
                                <th className="text-center p-2 font-medium">Invested</th>
                                <th className="text-left p-2 font-medium">Requirements</th>
                                <th className="text-left p-2 font-medium">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...industrialSubsectors.get(key)!.keys()].map((key2) =>
                                <SectorRow
                                    key={key2}
                                    rowKey={key2}
                                    sectorKey={key2}
                                    industry={industry}
                                />)}
                        </tbody>
                    </table>
                </TabsContent>
            ))}
        </Tabs>
    );
}
