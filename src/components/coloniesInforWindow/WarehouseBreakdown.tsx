import { IndustryComponent } from "@/game/components/industryComponent";
import { type IndustrialSectors } from "@/game/components/Factories";
import { Goods, getPrices, godsCategories, basePrices } from "@/game/data/Goods";
import { Population, baseSalaries } from "@/game/data/Population";
import { industrySectorBlueprints } from "@/game/systems/sectorBlueprints";
import { convertToReadable } from "@/lib/utils";
import { colorBySign } from "./colorBySign";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const warehousePriceMemory: Partial<Record<keyof Goods, number>> = {};

function getSectorCostPerUnit(
    sectorKey: keyof IndustrialSectors,
    industry: Pick<IndustryComponent, "techMultipliers" | "sectorResults">,
): number {
    const config = industrySectorBlueprints.get(sectorKey);
    if(!config) return 0;

    const techMult = industry.techMultipliers[sectorKey] ?? 1;

    const goodsCost = config.goodsRequirements
        ? Object.entries(config.goodsRequirements).reduce((sum: number, [good, req]) => {
            return sum + (req as number) * (basePrices[good as keyof Goods] ?? 0);
        }, 0) * techMult
        : 0;

    const laborCost = config.workerRequirement
        ? Object.entries(config.workerRequirement).reduce((sum: number, [worker, req]) => {
            return sum + (req as number) * (baseSalaries[worker as keyof Population] ?? 0);
        }, 0) * techMult
        : 0;

    const sectorResult = industry.sectorResults?.[sectorKey];
    const producedGoods = sectorResult?.producedGoods ?? {} as Record<keyof Goods, number>;
    const totalProduced = Object.entries(producedGoods).reduce((sum: number, [, v]) => sum + (v ?? 0), 0);
    return totalProduced > 0 ? (goodsCost + laborCost) / totalProduced : 0;
}

function getGoodCostPerUnit(
    goodKey: keyof Goods,
    industry: Pick<IndustryComponent, "techMultipliers" | "sectorResults">,
): number {
    for(const [sectorKey, sectorResult] of Object.entries(industry.sectorResults ?? {})) {
        const producedGoods = (sectorResult as { producedGoods?: Record<keyof Goods, number> }).producedGoods ?? {} as Record<keyof Goods, number>;
        if((producedGoods[goodKey] ?? 0) > 0) {
            return getSectorCostPerUnit(sectorKey as keyof IndustrialSectors, industry);
        }
    }
    return 0;
}

export function WarehouseBreakdown({ industry, showPhysical }: { industry: IndustryComponent; showPhysical?: boolean }) {
    const { goods, goodsProduction, goodsRequirements } = industry;
    const prices = getPrices(goods, warehousePriceMemory);

    return (
        <Tabs defaultValue="rawMaterials">
            <TabsList  className="f-width">
                {[...godsCategories.keys()].map((key) => {
                    return <TabsTrigger key={key} value={key}>{key}</TabsTrigger>
                })}
            </TabsList>

            {[...godsCategories.keys()].map((category) => {
                return <TabsContent key={category} value={category}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-muted">
                                <th className="text-left p-2 font-medium">{showPhysical ? "Good" : "Service"}</th>
                                <th className="text-right p-2 font-medium">Price</th>
                                <th className="text-right p-2 font-medium">Cost/Unit</th>
                                <th className="text-right p-2 font-medium">Stock</th>
                                <th className="text-center p-2 font-medium">Net</th>
                                <th className="text-center p-2 font-medium">Production</th>
                                <th className="text-center p-2 font-medium">Requirements</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Object.entries(goods) as [keyof Goods, number][])
                                .filter(([key]) => godsCategories.get(category)?.has(key))
                                .sort(([keyA], [keyB]) => RESOURCE_NAMES[keyA].localeCompare(RESOURCE_NAMES[keyB]))
                                .map(([key, value]) => {
                                    const addition = goodsProduction[key] || 0;
                                    const used = goodsRequirements[key] || 0;

                                    return <tr key={key} className="border-b border-muted/50 last:border-0">
                                        <td className="p-2" style={{ display: "flex", gap: "1em" }}>
                                            <ResourceIcon name={key} />
                                            {RESOURCE_NAMES[key] || key}
                                        </td>
                                        <td className="p-2 text-right">{convertToReadable(prices[key] || 0)}</td>
                                        <td className="p-2 text-right">{convertToReadable(Math.round(getGoodCostPerUnit(key, industry)))}</td>
                                        <td className="p-2 text-right">{convertToReadable(value || 0)}</td>
                                        <td className="p-2 text-center">{colorBySign(addition - used)}</td>
                                        <td className="p-2 text-center">{convertToReadable(addition)}</td>
                                        <td className="p-2 text-center">{convertToReadable(used)}</td>
                                    </tr>;
                                })}
                        </tbody>
                    </table>
                </TabsContent>
            })}
        </Tabs>
    );
}
