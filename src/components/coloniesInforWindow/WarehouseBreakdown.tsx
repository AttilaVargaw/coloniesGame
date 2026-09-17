import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { convertToReadable } from "@/lib/utils";

export function WarehouseBreakdown({ industry: { goods, goodsProduction, goodsRequirements } }: { industry: IndustryComponent; }) {
    return (
        <table style={{ width: "100%" }}>
            <thead>
                <tr>
                    <th></th>
                    <th></th>
                    <th>Net</th>
                    <th>Production</th>
                    <th>Requirements</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(goods).map(([key, value]) => {
                    const addition = goodsProduction[key as keyof Goods] || 0;
                    const used = goodsRequirements[key as keyof Goods] || 0;

                    return <tr key={key}>
                        <td>{key}</td>
                        <td>{convertToReadable(value || 0)}</td>
                        <td style={{ textAlign: "center" }}>{convertToReadable(addition - (used || 0))}</td>
                        <td style={{ textAlign: "center" }}>{convertToReadable(addition)}</td>
                        <td style={{ textAlign: "center" }}>{convertToReadable(used)}</td>
                    </tr>
                })}
            </tbody>
        </table>
    );
}
