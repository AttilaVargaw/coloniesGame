import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { getGoodRequirementsAndQoL, getRequirementsForQol } from "../data/Population";
import { populationGrowth } from "../data/populationHelpers";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickResult } from "./IndustryTickResult";
import type { SectorBid } from "./SectorBid";

const qolSmoothing = 0.03;
const wealthSmoothing = 0.5;
const expectedQolSmoothing = 0.03;
const maxDailyChangeSmoothing = 0.001;

const extraRequirements = {
    student: { education: 1 },
    retired: { healthcare: 2 }
} as Readonly<Record<keyof Population, Partial<Goods>>>;

export function computePopulationConsumption(
    population: Population,
    adjustedSalaries: Record<keyof Population, number>,
    prices: Record<keyof Goods, number>,
): {
    populationConsumption: Partial<Goods>;
    populationUpdates: IndustryTickResult["populationUpdates"];
    populationProfits: Record<keyof Population, number>;
} {
    const populationConsumption: Partial<Goods> = {};
    const populationUpdates = {} as IndustryTickResult["populationUpdates"];
    const populationProfits: Record<keyof Population, number> = {} as Record<keyof Population, number>;

    for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
        const { qol: targetQol } = getGoodRequirementsAndQoL(
            adjustedSalaries[key],
            prices,
            pop
        );

        const smoothedQol = Math.max(0, Math.min(80, pop.qol + (targetQol - pop.qol) * qolSmoothing));
        const requirements = getRequirementsForQol(smoothedQol, pop.number);

        const extra = extraRequirements[key];
        if(extra) {
            for(const [good, amount] of Object.entries(extra)) {
                requirements[good as keyof Goods] = (requirements[good as keyof Goods] ?? 0) + amount * pop.number;
            }
        }

        for(const it in requirements) {
            populationConsumption[it as keyof Goods] =
                (requirements[it as keyof Goods] ?? 0) +
                (populationConsumption[it as keyof Goods] ?? 0);
        }

        const income = adjustedSalaries[key] * pop.number;
        const expenses = Object.entries(requirements).reduce((sum, [good, amount]) => {
            if(!amount) return sum;
            return sum + amount * prices[good as keyof Goods];
        }, 0);

        const targetWealth = pop.wealth + income - expenses;
        const smoothedWealth = Number.isFinite(targetWealth) ? pop.wealth + (targetWealth - pop.wealth) * wealthSmoothing : pop.wealth;

        const expectedQol = (pop.expectedQol ?? smoothedQol) + (smoothedQol - (pop.expectedQol ?? smoothedQol)) * expectedQolSmoothing;

        const rawPopulationChange = populationGrowth(expectedQol) * pop.number / 365 * pop.birthRate;
        const maxDailyChange = pop.number * maxDailyChangeSmoothing;
        const clampedPopulationChange = Math.max(-maxDailyChange, Math.min(maxDailyChange, Number.isFinite(rawPopulationChange) ? rawPopulationChange : 0));
        const clampedPopulationNumber = Math.max(0, pop.number + clampedPopulationChange);

        populationUpdates[key] = {
            qol: smoothedQol,
            expectedQol,
            populationChange: clampedPopulationChange,
            wealth: Math.max(0, smoothedWealth),
            number: clampedPopulationNumber,
            requirements: requirements as Record<string, number>,
        };

        populationProfits[key] = income - expenses;
    }

    return { populationConsumption, populationUpdates, populationProfits };
}

export function buySectorInputs(
    sectorBids: SectorBid[],
    goods: Goods,
    // updatedSectorGoodsBeforeExec: Record<keyof IndustrialSectors, Goods>,
    newMoney: Record<string, number>,
    prices: Record<keyof Goods, number>,
): { colonyGoodsAfterPurchase: Goods; newMoney: Record<string, number> } {
    const colonyGoodsAfterPurchase = { ...goods };
    for(const bid of sectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        // const sectorInv = { ...(updatedSectorGoodsBeforeExec[sectorName] ?? createStarterWarehouse(0)) };
        let sectorMoney = newMoney[sectorName] ?? 0;

        for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
            if(demandPerTick <= 0) continue;

            // const demand = demandPerTick * bid.actualScale;
            // const existingInv = sectorInv[goodKey as keyof Goods] ?? 0;
            // if(existingInv >= demand) continue; // already have enough in inventory

            // const netDemand = demand - existingInv;
            const available = colonyGoodsAfterPurchase[goodKey as keyof Goods] ?? 0;
            const price = prices[goodKey as keyof Goods] ?? 0;
            if(available <= 0 || price <= 0) continue;

            // const canAfford = Math.floor(sectorMoney / price);
            // const toBuy = Math.min(netDemand, available, canAfford);
            // if(toBuy <= 0) continue;

            // sectorMoney -= toBuy * price;
            // colonyGoodsAfterPurchase[goodKey as keyof Goods] = Math.max(0, available - toBuy);
            // sectorInv[goodKey as keyof Goods] = existingInv + toBuy;
        }

        newMoney[sectorName] = sectorMoney;
        // updatedSectorGoodsBeforeExec[sectorName] = sectorInv;
    }
    return { colonyGoodsAfterPurchase, newMoney };
}

export function distributePopulationSpending(
    sectorBids: SectorBid[],
    sectorResults: Record<string, { producedGoods: Record<string, number> }>,
    populationConsumption: Partial<Goods>,
    prices: Record<keyof Goods, number>,
    newMoney: Record<string, number>,
): Record<string, number> {
    const totalProductionPerGood: Partial<Record<keyof Goods, number>> = {};
    for(const bid of sectorBids) {
        const result = sectorResults[bid.name];
        if(!result) continue;
        for(const [goodKey, amount] of Object.entries(result.producedGoods)) {
            if(amount > 0) {
                totalProductionPerGood[goodKey as keyof Goods] =
                    (totalProductionPerGood[goodKey as keyof Goods] ?? 0) + amount;
            }
        }
    }

    const populationSpending: Partial<Record<keyof Goods, number>> = {};
    for(const [goodKey, amount] of Object.entries(populationConsumption)) {
        if(amount > 0) {
            populationSpending[goodKey as keyof Goods] = amount * (prices[goodKey as keyof Goods] ?? 0);
        }
    }

    for(const bid of sectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const result = sectorResults[sectorName];
        if(!result) continue;
        let sectorPopulationRevenue = 0;
        for(const [goodKey, amount] of Object.entries(result.producedGoods)) {
            if(amount <= 0) continue;
            const totalProd = totalProductionPerGood[goodKey as keyof Goods] ?? 0;
            if(totalProd <= 0) continue;
            const spending = populationSpending[goodKey as keyof Goods] ?? 0;
            if(spending <= 0) continue;
            sectorPopulationRevenue += spending * (amount / totalProd);
        }
        if(sectorPopulationRevenue > 0) {
            newMoney[sectorName] = (newMoney[sectorName] ?? 0) + sectorPopulationRevenue;
        }
    }
    return newMoney;
}

export function computeColonyGoodsDelta(
    goods: Goods,
    colonyGoodsAfterPurchase: Goods,
    activeSectors: Iterable<keyof IndustrialSectors>,
    sectorResults: Record<string, { productionRatio: number; producedGoods: Record<string, number> }>,
    replenishmentDelta: Record<string, number>,
    prices: Record<keyof Goods, number>,
    // updatedSectorGoods: Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
): Partial<Goods> {
    const colonyGoodsDelta: Partial<Goods> = { ...createStarterWarehouse(0) };

    for(const goodKey of Object.keys(goods)) {
        const bought = (goods[goodKey as keyof Goods] ?? 0) - (colonyGoodsAfterPurchase[goodKey as keyof Goods] ?? 0);
        if(bought > 0) {
            colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) - bought;
        }
    }

    for(const name of activeSectors) {
        const sectorResult = sectorResults[name];
        if(!sectorResult || sectorResult.productionRatio <= 0) continue;

        for(const [goodKey, amount] of Object.entries(sectorResult.producedGoods)) {
            if(amount > 0) {
                const price = prices[goodKey as keyof Goods] ?? 0;
                if(price > 0) {
                    colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) + amount;
                    // Remove from sector inventory since goods were sold to colony pool
                    // const sectorInv = { ...(updatedSectorGoods[name] ?? createStarterWarehouse(0)) };
                    // sectorInv[goodKey as keyof Goods] = Math.max(0, (sectorInv[goodKey as keyof Goods] ?? 0) - amount);
                    // updatedSectorGoods[name] = sectorInv;
                } else {
                    // const sectorInv = { ...(updatedSectorGoods[name] ?? createStarterWarehouse(0)) };
                    // sectorInv[goodKey as keyof Goods] = (sectorInv[goodKey as keyof Goods] ?? 0) + amount;
                    // updatedSectorGoods[name] = sectorInv;
                }
            }
        }
    }

    // Merge capital replenishment into colony goods delta
    for(const [goodKey, amount] of Object.entries(replenishmentDelta)) {
        colonyGoodsDelta[goodKey as keyof Goods] = (colonyGoodsDelta[goodKey as keyof Goods] ?? 0) + amount;
    }

    return colonyGoodsDelta;
}

export function applyGoodsModifier(
    goods: Record<keyof Goods, number>,
    deltas: Record<string, number>,
    modifier: (current: number, delta: number) => number,
): void {
    for(const key in deltas) {
        const goodKey = key as keyof Goods;
        goods[goodKey] = modifier(goods[goodKey] ?? 0, deltas[goodKey] ?? 0);
    }
}

export function pruneMemory<T>(
    memory: Map<string, T>,
    activeEntityIds: Set<string>,
): void {
    for(const entityId of memory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            memory.delete(entityId);
        }
    }
}

export function computeMarketRatios<TKey extends string | number | symbol>(
    demands: Record<TKey, number>,
    available: Record<TKey, number>,
): Record<TKey, number> {
    const ratios = {} as Record<TKey, number>;
    for(const key of Object.keys(demands)) {
        const totalDemand = demands[key as TKey];
        const avail = available[key as TKey] ?? 0;
        ratios[key as TKey] = totalDemand > 0 ? Math.min(1, avail / totalDemand) : 1;
    }
    return ratios;
}

export function trySetPatchField<T>(
    patch: any,
    field: string,
    lastVal: T | undefined,
    newVal: T,
    diffFn: (a: T | undefined, b: T) => any
): boolean {
    const diff = diffFn(lastVal, newVal);
    if(diff) {
        patch[field] = diff;
        return true;
    }
    return false;
}
