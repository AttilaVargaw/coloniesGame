import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { getGoodRequirementsAndQoL, getRequirementsForQol } from "../data/Population";
import { populationGrowth } from "../data/populationHelpers";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryTickResult } from "./IndustryTickResult";
import type { SectorBid } from "./SectorBid";

const qolSmoothing = 0.03;
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
    desiredConsumptionByPop: Record<keyof Population, Partial<Goods>>;
    requirementsByPop: Record<keyof Population, Record<keyof Goods, number>>;
    populationUpdates: IndustryTickResult["populationUpdates"];
} {
    const populationConsumption: Partial<Goods> = {};
    const desiredConsumptionByPop: Record<keyof Population, Partial<Goods>> = {} as Record<keyof Population, Partial<Goods>>;
    const requirementsByPop: Record<keyof Population, Record<keyof Goods, number>> = {} as Record<keyof Population, Record<keyof Goods, number>>;
    const populationUpdates = {} as IndustryTickResult["populationUpdates"];

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
            const good = it as keyof Goods;
            const amount = requirements[good] ?? 0;
            populationConsumption[good] = (populationConsumption[good] ?? 0) + amount;
            desiredConsumptionByPop[key] = { ...(desiredConsumptionByPop[key] ?? {}), [good]: amount };
        }

        requirementsByPop[key] = requirements;

        const expectedQol = (pop.expectedQol ?? smoothedQol) + (smoothedQol - (pop.expectedQol ?? smoothedQol)) * expectedQolSmoothing;

        const rawPopulationChange = populationGrowth(expectedQol) * pop.number / 365 * pop.birthRate;
        const maxDailyChange = pop.number * maxDailyChangeSmoothing;
        const clampedPopulationChange = Math.max(-maxDailyChange, Math.min(maxDailyChange, Number.isFinite(rawPopulationChange) ? rawPopulationChange : 0));
        const clampedPopulationNumber = Math.max(0, pop.number + clampedPopulationChange);

        populationUpdates[key] = {
            qol: smoothedQol,
            expectedQol,
            populationChange: clampedPopulationChange,
            wealth: pop.wealth, // Not yet settled; will be updated after wage settlement
            number: clampedPopulationNumber,
            requirements: requirements as Record<string, number>,
        };
    }

    return { populationConsumption, desiredConsumptionByPop, requirementsByPop, populationUpdates };
}

export function buySectorInputs(
    sectorBids: SectorBid[],
    goods: Goods,
    newMoney: Record<string, number>,
    prices: Record<keyof Goods, number>,
    goodsAllocations: Record<string, Partial<Record<keyof Goods, number>>>,
): { colonyGoodsAfterPurchase: Goods; newMoney: Record<string, number>; purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> } {
    const colonyGoodsAfterPurchase = { ...goods };
    const updatedMoney = { ...newMoney };
    const purchasedBySector: Record<string, Partial<Record<keyof Goods, number>>> = {};

    const validGoods = new Set(Object.keys(goods));
    const seenSectors = new Set<string>();

    // Validate starting inventory.
    for(const [good, amount] of Object.entries(goods)) {
        if(!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Invalid starting inventory for ${good}: ${amount}`);
        }
    }

    for(const bid of sectorBids) {
        const sectorName = bid.name;

        if(!sectorName || seenSectors.has(sectorName)) {
            throw new Error(`Invalid or duplicate sector: ${sectorName}`);
        }
        seenSectors.add(sectorName);

        const allocation = goodsAllocations[sectorName] ?? {};

        let sectorMoney = updatedMoney[sectorName] ?? 0;

        if(!Number.isFinite(sectorMoney) || sectorMoney < 0) {
            throw new Error(`Invalid cash balance for ${sectorName}`);
        }

        if(!Number.isFinite(bid.actualScale) || bid.actualScale < 0) {
            throw new Error(`Invalid actualScale for ${sectorName}`);
        }

        purchasedBySector[sectorName] = {};

        for(const [goodName, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
            if(!validGoods.has(goodName)) {
                throw new Error(`Unknown input good: ${goodName}`);
            }

            if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
                throw new Error(`Invalid demand for ${sectorName}/${goodName}`);
            }

            const key = goodName as keyof Goods;
            const allocated = allocation[key] ?? 0;
            const available = colonyGoodsAfterPurchase[key] ?? 0;
            const price = prices[key];

            if(!Number.isFinite(allocated) || allocated < 0) {
                throw new Error(`Invalid allocation for ${sectorName}/${goodName}`);
            }

            if(!Number.isFinite(available) || available < 0) {
                throw new Error(`Invalid inventory for ${goodName}`);
            }

            if(!Number.isFinite(price) || price < 0) {
                throw new Error(`Invalid price for ${goodName}`);
            }

            const idealDemand = demandPerTick * bid.actualScale;

            if(!Number.isFinite(idealDemand)) {
                throw new Error(`Demand overflow for ${sectorName}/${goodName}`);
            }

            const demand = Math.min(idealDemand, allocated);

            if(demand <= 0 || available <= 0) continue;

            const affordableQuantity = price === 0
                ? available
                : sectorMoney / price;

            let toBuy = Math.min(
                demand,
                available,
                affordableQuantity,
            );

            if(!Number.isFinite(toBuy) || toBuy < 0) {
                throw new Error(`Invalid purchase quantity for ${sectorName}/${goodName}`);
            }

            if(toBuy <= 0) continue;

            let cost = toBuy * price;

            if(!Number.isFinite(cost)) {
                throw new Error(`Purchase cost overflow for ${sectorName}/${goodName}`);
            }

            // Correct only floating-point overshoot; throw on material overspending.
            if(cost > sectorMoney) {
                const excess = cost - sectorMoney;
                const tolerance = 1e-9 * Math.max(1, sectorMoney);

                if(excess > tolerance) {
                    throw new Error(`${sectorName} cannot afford ${goodName}`);
                }

                toBuy = price === 0 ? toBuy : sectorMoney / price;
                cost = toBuy * price;
            }

            sectorMoney = Math.max(0, sectorMoney - cost);

            colonyGoodsAfterPurchase[key] = Math.max(
                0,
                available - toBuy,
            );

            purchasedBySector[sectorName][key] = toBuy;
        }

        updatedMoney[sectorName] = sectorMoney;
    }

    return {
        colonyGoodsAfterPurchase,
        newMoney: updatedMoney,
        purchasedBySector,
    };
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
): Partial<Goods> {
    const colonyGoodsDelta: Partial<Goods> = createEmptyWarehouse();

    for(const goodKey of Object.keys(goods)) {
        const key = goodKey as keyof Goods;
        const before = goods[key] ?? 0;
        const after = colonyGoodsAfterPurchase[key] ?? 0;

        if(
            !Number.isFinite(before) || before < 0 ||
            !Number.isFinite(after) || after < 0
        ) {
            throw new Error(`Invalid inventory while computing delta: ${goodKey}`);
        }

        colonyGoodsDelta[key] = after - before;
    }

    for(const name of activeSectors) {
        const sectorResult = sectorResults[name];
        if(!sectorResult || sectorResult.productionRatio <= 0) continue;

        for(const [goodKey, amount] of Object.entries(sectorResult.producedGoods)) {
            const key = goodKey as keyof Goods;
            const qty = amount ?? 0;

            if(!Number.isFinite(qty) || qty < 0) {
                throw new Error(`Invalid production quantity for ${name}/${goodKey}`);
            }

            if(qty > 0) {
                colonyGoodsDelta[key] = (colonyGoodsDelta[key] ?? 0) + qty;
            }
        }
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
