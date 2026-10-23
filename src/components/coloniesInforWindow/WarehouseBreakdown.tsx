import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods, physicalGoods, services, getPrices } from "@/game/data/Goods";
import { convertToReadable } from "@/lib/utils";
import { colorBySign } from "./colorBySign";
import { ResourceIcon, RESOURCE_NAMES } from "@/components/icons/ResourceIcon";

const warehousePriceMemory: Partial<Record<keyof Goods, number>> = {};

export function WarehouseBreakdown({ industry: { goods, goodsProduction, goodsRequirements }, showPhysical }: { industry: IndustryComponent; showPhysical?: boolean }) {
    const prices = getPrices(goods, warehousePriceMemory);

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-muted">
                    <th className="text-left p-2 font-medium">{showPhysical ? "Good" : "Service"}</th>
                    <th className="text-right p-2 font-medium">Price</th>
                    <th className="text-right p-2 font-medium">Stock</th>
                    <th className="text-center p-2 font-medium">Net</th>
                    <th className="text-center p-2 font-medium">Production</th>
                    <th className="text-center p-2 font-medium">Requirements</th>
                </tr>
            </thead>
            <tbody>
                {(Object.entries(goods) as [keyof Goods, number][])
                    .filter(([key]) =>
                        showPhysical ? physicalGoods.has(key) : services.has(key))
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
                            <td className="p-2 text-right">{convertToReadable(value || 0)}</td>
                            <td className="p-2 text-center">{colorBySign(addition - used)}</td>
                            <td className="p-2 text-center">{convertToReadable(addition)}</td>
                            <td className="p-2 text-center">{convertToReadable(used)}</td>
                        </tr>;
                    })}
            </tbody>
        </table>
    );
}
