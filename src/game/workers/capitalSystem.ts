import { industrySectorBlueprints } from "../systems/factoryBlueprints";
import { Goods } from "../data/Goods";
import type { IndustrialSectors } from "../components/Factories";

export interface CapitalSystemResult {
    newCapitalStock: Record<string, Partial<Goods>>;
    replenishmentDelta: Partial<Goods>;
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

    for(const name of activeSectors) {
        const config = industrySectorBlueprints.get(name);
        const currentStock = { ...(capitalStock[name] ?? {}) } as Partial<Goods>;

        if(!config?.capitalGoods) {
            newCapitalStock[name] = currentStock;
            continue;
        }

        const sectorResult = sectorResults[name];
        if(sectorResult) {
            const actualScale = sectorResult.productionRatio;

            // Wear & tear: consume capital goods proportional to actual production
            const wear: Partial<Goods> = {};
            for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
                const consumed = (rate as number) * actualScale;
                wear[goodKey as keyof Goods] = consumed;
                currentStock[goodKey as keyof Goods] = Math.max(0, (currentStock[goodKey as keyof Goods] ?? 0) - consumed);
            }

            // Decay: natural deterioration of capital stock
            const decay = config.capitalEfficiencyDecay ?? 0;
            const decayAmounts: Partial<Goods> = {};
            if(decay > 0) {
                for(const goodKey of Object.keys(currentStock)) {
                    const stock = currentStock[goodKey as keyof Goods] ?? 0;
                    const amount = stock * decay;
                    decayAmounts[goodKey as keyof Goods] = amount;
                    currentStock[goodKey as keyof Goods] = Math.max(0, stock - amount);
                }
            }

            // Replenish wear + decay from colony pool, paid with sector's own money
            const totalLoss: Partial<Goods> = { ...wear };
            for(const [key, amount] of Object.entries(decayAmounts)) {
                totalLoss[key as keyof Goods] = (totalLoss[key as keyof Goods] ?? 0) + amount;
            }
            for(const [goodKey, amount] of Object.entries(totalLoss)) {
                if(amount <= 0) continue;
                const cost = amount * (prices[goodKey as keyof Goods] ?? 0);
                if(money[name] >= cost) {
                    money[name] -= cost;
                    replenishmentDelta[goodKey as keyof Goods] = (replenishmentDelta[goodKey as keyof Goods] ?? 0) - amount;
                    currentStock[goodKey as keyof Goods] = (currentStock[goodKey as keyof Goods] ?? 0) + amount;
                }
            }

            // Invest: buy additional capital stock to raise capital adequacy toward 1.0
            // Target stock per capital good = rate * 100 (reference production scale)
            for(const [goodKey, rate] of Object.entries(config.capitalGoods)) {
                const targetStock = (rate as number) * 100;
                const current = currentStock[goodKey as keyof Goods] ?? 0;
                if(current >= targetStock) continue;

                const needed = targetStock - current;
                const cost = needed * (prices[goodKey as keyof Goods] ?? 0);
                if(cost <= 0) continue;

                const canAfford = Math.floor(money[name] / cost);
                if(canAfford <= 0) continue;

                const toBuy = Math.min(needed, canAfford);
                const buyCost = toBuy * (prices[goodKey as keyof Goods] ?? 0);
                money[name] -= buyCost;
                replenishmentDelta[goodKey as keyof Goods] = (replenishmentDelta[goodKey as keyof Goods] ?? 0) - toBuy;
                currentStock[goodKey as keyof Goods] = current + toBuy;
            }
        }

        newCapitalStock[name] = currentStock;
    }

    return { newCapitalStock, replenishmentDelta };
}
