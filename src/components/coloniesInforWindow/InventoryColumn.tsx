import { IndustrialSectors } from "@/game/components/Factories";
import { IndustryComponent } from "@/game/components/industryComponent";
import { Goods } from "@/game/data/Goods";
import { industrySectorBlueprints } from "@/game/systems/sectorBlueprints";
import { RequirementItem } from "./requirementItem";

export function InventoryColumn({ config, industry, sectorKey }: { config: ReturnType<typeof industrySectorBlueprints.get>; sectorKey: keyof IndustrialSectors; industry: IndustryComponent; }) {
    const stock = industry.capitalStock[sectorKey] ?? {};
    // const sectorInv = industry.sectorGoods[sectorKey] ?? {};
    const money = industry.money[sectorKey];

    const relevantGoods = new Set([
        ...Object.keys(config?.capitalGoods ?? {}),
        //...Object.keys(config?.goodsRequirements ?? {}),
        ...Object.keys(config?.goodsProduction ?? {}),
    ]) as Set<keyof Goods>;

    return [...relevantGoods.values()].map((good) => {
        // const isCapitalGood = config?.capitalGoods?.[good] !== undefined;
        const cap = stock[good] ?? 0;
        // const amount = sectorInv[good] ?? 0;
        const primaryAmount = cap; //isCapitalGood // ? cap : amount;

        return (
            <div key={good} style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
                <RequirementItem currentCapacityReq={primaryAmount} name={good} />
            </div>
        );
    }).concat(
        <div key="money" style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
            <RequirementItem currentCapacityReq={money} name="money" />
        </div>
    );
}
