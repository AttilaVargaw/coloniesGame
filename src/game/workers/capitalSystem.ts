import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { Goods } from "../data/Goods";
import type { IndustrialSectors } from "../components/Factories";
import { BTStatus } from "../systems/sectorBehaviorTree/bt";
import {
    CanAffordReplenishment,
    CanAffordInvestment,
    BelowTargetStock,
} from "./capitalBehaviorTree/capitalConditions";
import {
    ApplyWear,
    ApplyDecay,
    ReplenishLosses,
    InvestCapital,
} from "./capitalBehaviorTree/capitalActions";
import { defaultCapitalBlackboard } from "./capitalBehaviorTree/capitalBT";

interface CapitalSystemResult {
    newCapitalStock: Record<string, Partial<Goods>>;
    replenishmentDelta: Partial<Goods>;
    moneySpent: Record<string, number>;
    remainingGoods: Partial<Record<keyof Goods, number>>;
}

function requireActionSuccess(
    result: BTStatus,
    action: string,
    sector: string,
): void {
    if(result !== "SUCCESS") {
        throw new Error(`${action} failed for sector ${sector} with status ${result}`);
    }
}

function addCapitalDelta(
    target: Partial<Goods>,
    key: keyof Goods,
    amount: number,
    sector: string,
): void {
    if(!Number.isFinite(amount) || amount > 0) {
        throw new Error(`Invalid capital delta: ${sector}/${key}`);
    }

    if(amount === 0) return;

    const next = (target[key] ?? 0) + amount;

    if(!Number.isFinite(next)) {
        throw new Error(`Capital delta overflow: ${key}`);
    }

    target[key] = next;
}

function requireNonNegativeFinite(value: number, label: string): number {
    if(!Number.isFinite(value) || value < -1e-6) {
        throw new Error(`Invalid ${label}: ${value}`);
    }
    return Math.max(0, value);
}

export function processCapital(
    activeSectors: Iterable<keyof IndustrialSectors>,
    capitalStock: Record<keyof IndustrialSectors, Partial<Goods>>,
    sectorResults: Record<string, { productionRatio: number }>,
    prices: Record<keyof Goods, number>,
    money: Record<string, number>,
    availableGoods: Partial<Record<keyof Goods, number>>
): CapitalSystemResult {
    const newCapitalStock: Record<string, Partial<Goods>> = {};
    const replenishmentDelta: Partial<Goods> = {};
    const moneySpent: Record<string, number> = {};
    const remainingGoods: Partial<Record<keyof Goods, number>> = { ...availableGoods };

    // Validate all availableGoods entries once
    for(const [goodKey, qty] of Object.entries(remainingGoods)) {
        requireNonNegativeFinite(
            qty,
            `available stock for ${goodKey}`,
        );
    }

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
        const sectorMoney = Math.max(0, money[name] ?? 0);

        // Validate sector inputs before running capital actions
        if(!Number.isFinite(productionRatio) || productionRatio < 0) {
            throw new Error(`Invalid production ratio for ${name}`);
        }

        if(!Number.isFinite(decay) || decay < 0 || decay > 1) {
            throw new Error(`Invalid capital decay for ${name}`);
        }

        // Validate capital goods rates
        for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
            requireNonNegativeFinite(
                rate,
                `capital goods rate for ${goodKey}`,
            );
        }

        const bb = defaultCapitalBlackboard(name);
        bb.currentStock = currentStock;
        bb.capitalGoods = config.capitalGoods as Partial<Record<keyof Goods, number>>;
        bb.productionRatio = productionRatio;
        bb.decay = decay;
        bb.prices = prices as Partial<Record<keyof Goods, number>>;
        bb.money = sectorMoney;
        bb.availableGoods = remainingGoods;

        // Apply wear (always)
        requireActionSuccess(
            new ApplyWear().tick(bb),
            "ApplyWear",
            name,
        );

        // Apply decay (always — zero decay is a no-op in the action)
        requireActionSuccess(
            new ApplyDecay().tick(bb),
            "ApplyDecay",
            name,
        );

        const hasLosses =
            Object.values(bb.wearAmounts).some((a) => (a ?? 0) > 0) ||
            Object.values(bb.decayAmounts).some((a) => (a ?? 0) > 0);

        if(hasLosses && new CanAffordReplenishment().tick(bb) === "SUCCESS") {
            requireActionSuccess(
                new ReplenishLosses().tick(bb),
                "ReplenishLosses",
                name,
            );
        }

        for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
            if(
                new BelowTargetStock(goodKey, rate).tick(bb) === "SUCCESS" &&
                new CanAffordInvestment(goodKey, rate).tick(bb) === "SUCCESS"
            ) {
                requireActionSuccess(
                    new InvestCapital(goodKey, rate).tick(bb),
                    "InvestCapital",
                    name,
                );
            }
        }

        newCapitalStock[name] = bb.currentStock;
        moneySpent[name] = bb.moneySpent;

        // Aggregate capital deltas with overflow validation
        for(const [goodKey, amount] of Object.entries(bb.replenishAmounts)) {
            const key = goodKey as keyof Goods;
            addCapitalDelta(replenishmentDelta, key, amount ?? 0, name);
        }
        for(const [goodKey, amount] of Object.entries(bb.investAmounts)) {
            const key = goodKey as keyof Goods;
            addCapitalDelta(replenishmentDelta, key, amount ?? 0, name);
        }
    }

    return { newCapitalStock, replenishmentDelta, moneySpent, remainingGoods };
}
