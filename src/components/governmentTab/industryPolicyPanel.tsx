import { industrySectorBlueprints } from "@/game/systems/sectorBlueprints";
import { IndustryComponent } from "@/game/components/industryComponent";
import { type IndustrialSectors, industrialSubsectors } from "@/game/components/Factories";
import { Entity } from "@/engine/entities/entity";
import { SelectProductionMethodCommand, AllocateBudgetCommand } from "@/game/commands/IndustryPolicyCommand";
import { useGameEngine } from "@/hooks/useGameContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SubmitEventHandler } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { SectorIcon } from "../icons/SectorIcon";

export function IndustryPolicyPanel({ colony, industry }: { colony: Entity; industry: IndustryComponent }) {
    const engine = useGameEngine();

    const selectMethod = (sector: keyof IndustrialSectors, methodId: string | null) => {
        if(!engine) return;
        engine.addCommand(new SelectProductionMethodCommand(colony.id, sector, methodId));
    };

    const allocateBudget: SubmitEventHandler = (event) => {
        event.preventDefault();

        const { target } = event

        const amount = parseFloat(target.amount.value);
        if(!amount || amount <= 0) return;

        const sectorId = target.id.replace(/^allocate-/, "") as keyof IndustrialSectors;

        if(!engine) return;
        engine.addCommand(new AllocateBudgetCommand(colony.id, sectorId, amount));
    };

    const methodsFor = (sector: keyof IndustrialSectors) => {
        const config = industrySectorBlueprints.get(sector);
        if(!config?.productionMethods) return [];
        return [...config.productionMethods.entries()] as [string, { desc?: string; efficiencyMultiplier?: number; workerMultiplier?: number; materialMultiplier?: number; capitalMultiplier?: number }][];
    };

    return (
        <div className="space-y-3 p-2 text-sm">
            <h2 className="text-lg font-bold mb-2">Industry Policy</h2>
            <Tabs className="overflow-x-auto">
                <TabsList defaultValue="energy">
                    {[...industrialSubsectors.keys()].map((key) => {
                        return <TabsTrigger key={key} value={key}>{key}</TabsTrigger>
                    })}
                </TabsList>

                {[...industrialSubsectors.keys()].map((key) => {

                    return <TabsContent key={key} value={key} style={{ overflowY: "auto", }} >
                        <div className="divide-y divide-gray-700/30">
                            {[...industrialSubsectors.get(key)!].map((sector) => {
                                const currentMethod = industry.selectedMethod[sector] ?? null;
                                const methods = methodsFor(sector);

                                return <div key={sector} >
                                    <div className="border rounded-lg p-3 bg-gray-800/50 mt-2 flex flex-col gap-4">
                                        <span className="font-medium flex gap-2"><SectorIcon name={sector} /> {sector}</span>
                                        <span className="text-xs text-gray-500">{Math.round(industry.sectorInvestment[sector] ?? 0)} invested</span>
                                        <div className="font-medium mb-2">Production Method</div>
                                        <Select value={currentMethod ?? "default"} onValueChange={(value) => selectMethod(sector as keyof IndustrialSectors, value || null)}>
                                            <SelectTrigger className="w-48">
                                                <SelectValue>{currentMethod}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {methods.map(([methodId]) => (
                                                        <SelectItem key={methodId} value={methodId}>{methodId}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2 mt-2">
                                            <form onSubmit={allocateBudget} id={`allocate-${sector}`}>
                                                <Input type="number" name="amount" placeholder="Amount" className="w-24" />
                                                <Button>
                                                    Allocate
                                                </Button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            }
                            )}
                        </div>
                    </TabsContent>
                })}
            </Tabs>
        </div>
    );
}
