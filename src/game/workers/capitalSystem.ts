import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { Goods } from "../data/Goods";
import type { IndustrialSectors } from "../components/Factories";
import { Sequence } from "../systems/sectorBehaviorTree/bt";
import {
    HasCapitalGoods,
    HasProduction,
    HasDecay,
    HasWearToReplenish,
    CanAffordReplenishment,
    BelowTargetStock,
    CanAffordInvestment,
} from "./capitalBehaviorTree/capitalConditions";
import {
    ApplyWear,
    ApplyDecay,
    ReplenishLosses,
    InvestCapital,
} from "./capitalBehaviorTree/capitalActions";
import { defaultCapitalBlackboard } from "./capitalBehaviorTree/capitalBT";

export interface CapitalSystemResult {
    newCapitalStock: Record<string, Partial<Goods>>;
    replenishmentDelta: Partial<Goods>;
    moneySpent: Record<string, number>;
}

export function processCapital(
    activeSectors: Iterable<keyof IndustrialSectors>,
    capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>,
    sectorResults: Record<string, { productionRatio: number }>,
    prices: Record<keyof Goods, number>,
    money: Record<string, number>
): CapitalSystemResult {
    const newCapitalStock: Record<string, Partial<Goods>> = {};
    const replenishmentDelta: Partial<Goods> = {};
    const moneySpent: Record<string, number> = {};

    for(const name of activeSectors) {
        const config = industrySectorBlueprints.get(name);
        const currentStock = { ...(capitalStock[name] ?? {}) } as Partial<Goods>;

        if(!config?.capitalGoods) {
            newCapitalStock[name] = currentStock;
            continue;
        }

        const sectorResult = sectorResults[name];
        const productionRatio = sectorResult?.productionRatio ?? 0;
        const decay = config.capitalEfficiencyDecay ?? 0;
        const sectorMoney = money[name] ?? 0;

        const bb = defaultCapitalBlackboard(name);
        bb.currentStock = currentStock;
        bb.capitalGoods = config.capitalGoods as Record<string, number>;
        bb.productionRatio = productionRatio;
        bb.decay = decay;
        bb.prices = prices;
        bb.money = sectorMoney;

        // Build tree: wear → decay → replenish → invest per capital good
        const children = [
            new HasCapitalGoods(),
            new Sequence([
                new HasProduction(),
                new ApplyWear(),
            ]),
            new Sequence([
                new HasDecay(),
                new ApplyDecay(),
            ]),
            new Sequence([
                new HasWearToReplenish(),
                new CanAffordReplenishment(),
                new ReplenishLosses(),
            ]),
        ];

        // Add investment branch per capital good
        for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
            children.push(new Sequence([
                new BelowTargetStock(goodKey, rate as number),
                new CanAffordInvestment(goodKey, rate as number),
                new InvestCapital(goodKey, rate as number),
            ]));
        }

        const tree = new Sequence(children);
        tree.tick(bb);

        // Extract results
        newCapitalStock[name] = bb.currentStock;
        moneySpent[name] = bb.moneySpent;

        // Build replenishment delta (negative = goods removed from pool)
        for(const [goodKey, amount] of Object.entries(bb.replenishAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            if(amt < 0) {
                replenishmentDelta[key] =
                    (replenishmentDelta[key] ?? 0) + amt;
            }
        }
        for(const [goodKey, amount] of Object.entries(bb.investAmounts)) {
            const key: keyof Goods = goodKey as keyof Goods;
            const amt = amount ?? 0;
            if(amt < 0) {
                replenishmentDelta[key] =
                    (replenishmentDelta[key] ?? 0) + amt;
            }
        }
    }

    return { newCapitalStock, replenishmentDelta, moneySpent };
}
