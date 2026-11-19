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
    // Physical audit: per-sector capital goods purchases (good -> quantity)
    purchasesBySector: Record<string, Partial<Record<keyof Goods, number>>>;
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
    const purchasesBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};

    // Validate all availableGoods entries once, normalizing tiny negatives.
    for(const [goodKey, qty] of Object.entries(remainingGoods)) {
        const validated = requireNonNegativeFinite(
            qty ?? 0,
            `available stock for ${goodKey}`,
        );
        remainingGoods[goodKey as keyof Goods] = validated;
    }

    // Snapshot opening available goods for independent inventory reconciliation.
    const openingAvailableGoods = { ...remainingGoods };

    // Reject duplicate sectors
    const sectorNames = [...activeSectors];
    if(new Set(sectorNames).size !== sectorNames.length) {
        throw new Error("Duplicate sector in activeSectors");
    }

    for(const name of sectorNames) {
        moneySpent[name] = 0;
        purchasesBySector[name] = {};

        const config = industrySectorBlueprints.get(name);
        const currentStock = { ...(capitalStock[name] ?? {}) } as Partial<Goods>;

        if(!config?.capitalGoods) {
            newCapitalStock[name] = currentStock;
            continue;
        }

        const sectorResult = sectorResults[name];
        if(!sectorResult) {
            throw new Error(`Missing sector result for active sector ${name}`);
        }
        const productionRatio = sectorResult.productionRatio;
        const decay = config.capitalEfficiencyDecay ?? 0;
        const rawMoney = money[name] ?? 0;
        if(!Number.isFinite(rawMoney) || rawMoney < -1e-6) {
            throw new Error(`Invalid sector cash balance for ${name}: ${rawMoney}`);
        }
        const sectorMoney = Math.max(0, rawMoney);

        // Validate sector inputs before running capital actions
        if(
            !Number.isFinite(productionRatio) ||
            productionRatio < 0 ||
            productionRatio > 1 + 1e-9
        ) {
            throw new Error(`Invalid production ratio for ${name}: ${productionRatio}`);
        }

        if(!Number.isFinite(decay) || decay < 0 || decay > 1) {
            throw new Error(`Invalid capital decay for ${name}: ${decay}`);
        }

        // Validate and normalize capital stock
        for(const [goodKey, qty] of Object.entries(currentStock)) {
            currentStock[goodKey as keyof Goods] = requireNonNegativeFinite(
                qty ?? 0,
                `capital stock for ${name}/${goodKey}`,
            );
        }
        for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
            requireNonNegativeFinite(
                rate,
                `capital goods rate for ${name}/${goodKey}`,
            );

            const key = goodKey as keyof Goods;
            const price = prices[key];

            if(price === undefined) {
                throw new Error(
                    `Missing price for configured capital good ${name}/${goodKey}`,
                );
            }

            requireNonNegativeFinite(
                price,
                `capital good price for ${name}/${goodKey}`,
            );
        }

        // Normalize production ratio: allow tiny floating-point overage, clamp to 1.
        const validatedProductionRatio = productionRatio > 1 ? 1 : productionRatio;

        const bb = defaultCapitalBlackboard(name);
        bb.currentStock = currentStock;
        bb.capitalGoods = config.capitalGoods as Partial<Record<keyof Goods, number>>;
        bb.productionRatio = validatedProductionRatio;
        bb.decay = decay;
        bb.prices = prices as Partial<Record<keyof Goods, number>>;
        bb.openingMoney = sectorMoney;
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

        // Track physical capital purchases by sector
        for(const [goodKey, amount] of Object.entries(bb.replenishAmounts)) {
            const key = goodKey as keyof Goods;
            const qty = -(amount ?? 0);
            if (qty > 0) {
                purchasesBySector[name][key] = (purchasesBySector[name][key] ?? 0) + qty;
            }
        }
        for(const [goodKey, amount] of Object.entries(bb.investAmounts)) {
            const key = goodKey as keyof Goods;
            const qty = -(amount ?? 0);
            if (qty > 0) {
                purchasesBySector[name][key] = (purchasesBySector[name][key] ?? 0) + qty;
            }
        }

        // Reconcile cash: opening - spent must equal closing
        const closingMoney = requireNonNegativeFinite(
            bb.money,
            `closing capital cash for ${name}`,
        );
        const reportedSpent = requireNonNegativeFinite(
            bb.moneySpent,
            `capital money spent for ${name}`,
        );
        const reconciledMoney = bb.openingMoney - reportedSpent;

        // Allow small floating-point discrepancy (relative to money scale)
        const tolerance = Math.max(1e-6, bb.openingMoney * 1e-9);
        if(Math.abs(closingMoney - reconciledMoney) > tolerance) {
            throw new Error(
                `Capital cash does not reconcile for ${name}: ` +
                `opening=${bb.openingMoney}, spent=${reportedSpent}, ` +
                `closing=${closingMoney}, expected=${reconciledMoney}, tolerance=${tolerance}`,
            );
        }

        // Independent cash-cost check: reportedSpent must match actual capital goods purchased at prices.
        let expectedCapitalCost = 0;
        for(const [goodKey, amount] of Object.entries(bb.replenishAmounts)) {
            const key = goodKey as keyof Goods;
            expectedCapitalCost += -(amount ?? 0) * prices[key];
        }
        for(const [goodKey, amount] of Object.entries(bb.investAmounts)) {
            const key = goodKey as keyof Goods;
            expectedCapitalCost += -(amount ?? 0) * prices[key];
        }
        const costTolerance = Math.max(1e-6, expectedCapitalCost * 1e-9);
        if(Math.abs(reportedSpent - expectedCapitalCost) > costTolerance) {
            throw new Error(
                `Capital purchase cost mismatch for ${name}: ` +
                `reported=${reportedSpent}, expected=${expectedCapitalCost}`,
            );
        }

        // Validate final capital stock
        for(const [goodKey, qty] of Object.entries(bb.currentStock)) {
            requireNonNegativeFinite(
                qty ?? 0,
                `closing capital stock ${name}/${goodKey}`,
            );
        }

        moneySpent[name] = reportedSpent;

        // Validate moneySpent doesn't exceed available money for this sector.
        const availableMoney = Math.max(0, money[name] ?? 0);
        if(bb.moneySpent > availableMoney + 1e-6) {
            throw new Error(
                `Sector ${name} spent ${bb.moneySpent} but only ${availableMoney} available`,
            );
        }

        // Aggregate capital deltas with overflow validation
        // Let addCapitalDelta enforce the invariant (no positive deltas).
        for(const [goodKey, amount] of Object.entries(bb.replenishAmounts)) {
            const key = goodKey as keyof Goods;
            addCapitalDelta(replenishmentDelta, key, amount ?? 0, name);
        }
        for(const [goodKey, amount] of Object.entries(bb.investAmounts)) {
            const key = goodKey as keyof Goods;
            addCapitalDelta(replenishmentDelta, key, amount ?? 0, name);
        }
    }

    // Independent inventory reconciliation: opening - closing must equal recorded purchases.
    // Use union of all relevant keys so a good purchased that was absent from opening inventory is still checked.
    const inventoryKeys = new Set<keyof Goods>([
        ...Object.keys(openingAvailableGoods) as (keyof Goods)[],
        ...Object.keys(remainingGoods) as (keyof Goods)[],
        ...Object.keys(replenishmentDelta) as (keyof Goods)[],
    ]);

    for(const goodKey of inventoryKeys) {
        const opening = openingAvailableGoods[goodKey] ?? 0;
        const closing = remainingGoods[goodKey] ?? 0;
        const consumed = opening - closing;

        if(!Number.isFinite(consumed) || consumed < -1e-6) {
            throw new Error(`Invalid capital inventory change for ${goodKey}`);
        }

        const recorded = -(replenishmentDelta[goodKey] ?? 0);

        const tolerance = Math.max(1e-6, opening * 1e-9);
        if(Math.abs(consumed - recorded) > tolerance) {
            throw new Error(
                `Capital inventory does not reconcile for ${goodKey}: ` +
                `opening=${opening}, closing=${closing}, ` +
                `consumed=${consumed}, recorded=${recorded}`,
            );
        }
    }

    // Validate remainingGoods are non-negative after all sectors processed.
    for(const [goodKey, qty] of Object.entries(remainingGoods)) {
        if(!Number.isFinite(qty) || qty < -1e-6) {
            throw new Error(`Invalid remaining goods for ${goodKey}: ${qty}`);
        }
    }

    return { newCapitalStock, replenishmentDelta, moneySpent, remainingGoods, purchasesBySector };
}
