import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { createEmptyWarehouse } from "../factories/createStarterWarehouse";
import type { SectorBid } from "./SectorBid";
import type { SectorExecutionResult } from "./SectorExecutionResult";
import type { SectorResult } from "../systems/generateIndustrialSector";

const EMPTY_WAREHOUSE = createEmptyWarehouse();

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);

export function applyGoodConstraint(
    currentConstraint: number,
    goodKey: keyof Goods,
    demandPerTick: number,
    goodsMarketRatios: Record<keyof Goods, number>,
    sectorInventory: Goods,
    isNonEssential: boolean
): number {
    // Market constraint from goods availability
    const ratio = goodsMarketRatios[goodKey] ?? 1;
    const marketConstraint = isNonEssential
        ? Math.min(currentConstraint, 0.5 + 0.75 * ratio)
        : Math.min(currentConstraint, ratio);

    // Sector inventory constraint: can't consume more than available
    const available = sectorInventory[goodKey] ?? 0;
    const maxScaleFromInventory = demandPerTick > 0 ? available / demandPerTick : 1;

    // Sector inventory fully covers this tick's demand — colony pool constraint doesn't apply
    if(maxScaleFromInventory >= 1) return currentConstraint;

    const inventoryConstraint = isNonEssential
        ? Math.max(0.5, maxScaleFromInventory)
        : maxScaleFromInventory;
    return Math.min(marketConstraint, inventoryConstraint);
}

export function executeSectors(
    sectorBids: SectorBid[],
    population: Population,
    // inputSectorGoods: Record<keyof IndustrialSectors, Goods>,
    colonyGoods: Goods,
    prices: Record<keyof Goods, number>,
    salaries: Record<keyof Population, number>,
    laborAllocations?: Record<string, Partial<Record<keyof Population, number>>>,
    purchasedBySector?: Record<string, Partial<Record<keyof Goods, number>>>,
): SectorExecutionResult {
    const sumGoodsRequirements = { ...EMPTY_WAREHOUSE };
    const sumGoodsProduction = { ...EMPTY_WAREHOUSE };
    const workingWorkers = createStarterPopulation(0);
    const remainingWorkers: Record<keyof Population, PopulationBreakdown> = createStarterPopulation(0);
    for(const key of Object.keys(population) as (keyof Population)[]) {
        remainingWorkers[key] = { ...population[key] };
    }

    const sectorResults: Record<string, SectorResult> = {};
    const sectorProfits: Record<string, number> = {};
    const sectorRevenue: Record<string, number> = {};
    const sectorLaborCosts: Record<string, number> = {};
    const sectorInputCosts: Record<string, number> = {};
    const sectorUtilization: Record<string, number> = {};

    // const sectorGoods: Record<keyof IndustrialSectors, Goods> = { ...inputSectorGoods };

    const sectorStopReason: Record<string, string> = {};

    for(const bid of sectorBids) {
        const actualScale = bid.actualScale;

        // Compute scale from actual purchases (goods constraint from what was bought, not allocated)
        let purchasedScale = 1;
        let materialShortageRatio = 1;
        const sectorPurchases = purchasedBySector?.[bid.name];
        if(sectorPurchases) {
            for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
                if(demandPerTick <= 0) continue;
                const gKey = goodKey as keyof Goods;
                const idealQty = demandPerTick * actualScale;
                const purchasedQty = sectorPurchases[gKey] ?? 0;
                if(idealQty > 0) {
                    const ratio = purchasedQty / idealQty;
                    purchasedScale = Math.min(purchasedScale, ratio);
                    materialShortageRatio = Math.min(materialShortageRatio, ratio);
                }
            }
        } else {
            // Fallback: use colony goods availability when purchase data is unavailable.
            // materialShortageRatio reflects availability at full demand (for stop reason),
            // while purchasedScale is constrained by availability at actualScale.
            for (const [key, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
                if (demandPerTick <= 0) continue;
                const goodKey = key as keyof Goods;
                const available = colonyGoods[goodKey] ?? 0;

                // Material shortage ratio at full demand (for stop reason)
                const fullRatio = demandPerTick > 0
                    ? Math.min(1, available / demandPerTick)
                    : 1;
                materialShortageRatio = Math.min(materialShortageRatio, fullRatio);

                // purchasedScale constrained by availability at actualScale
                const required = demandPerTick * actualScale;
                const actualRatio = required > 0
                    ? Math.min(1, available / required)
                    : 1;
                purchasedScale = Math.min(purchasedScale, actualRatio);
            }
        }

        // Final scale: actualScale already includes budget + labor constraints;
        // purchasedScale adds the real goods constraint from what was actually purchased
        const finalScale = Math.min(actualScale, purchasedScale);

        // Worker availability based on remaining workers (for stop reason)
        let workerRatio = 1;
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            if(value > 0) {
                const available = remainingWorkers[key as keyof Population].number;
                const r = available / value;
                workerRatio = Math.min(workerRatio, r);
            }
        }

        // Determine stop reason
        let stopReason = "";
        if(finalScale <= 0) {
            if(bid.budgetRatio <= 0) stopReason = "No money";
            else if(workerRatio <= 0) stopReason = "No workers";
            else if(materialShortageRatio <= 0) stopReason = "No materials";
            else stopReason = "Bottlenecked";
        } else if(bid.budgetRatio < 1 && bid.budgetRatio < finalScale) {
            stopReason = "Low budget";
        } else if(workerRatio < 1 && workerRatio < materialShortageRatio && workerRatio < finalScale) {
            stopReason = "Worker shortage";
        } else if(materialShortageRatio < 1 && materialShortageRatio < workerRatio && materialShortageRatio <= finalScale) {
            stopReason = "Material shortage";
        }
        sectorStopReason[bid.name] = stopReason;

        if(finalScale <= 0) {
            sectorResults[bid.name] = {
                name: bid.name,
                consumedGoods: {},
                producedGoods: {},
                workersEmployed: {},
                productionRatio: 0,
                inputLevel: bid.inputLevel,
                outputLevel: bid.outputLevel,
            };
            sectorProfits[bid.name] = 0;
            sectorRevenue[bid.name] = 0;
            sectorLaborCosts[bid.name] = 0;
            sectorInputCosts[bid.name] = 0;
            continue;
        }

        const workersEmployed: Partial<Record<keyof Population, number>> = {};
        const sectorLaborAllocation = laborAllocations?.[bid.name];
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            const demanded = value * finalScale;
            let employed: number;
            if(sectorLaborAllocation) {
                // Use pre-allocated labor (order-independent)
                const alloc = sectorLaborAllocation[key as keyof Population] ?? 0;

                if(!Number.isFinite(alloc) || alloc < 0) {
                    throw new Error(
                        `Invalid labor allocation for ${bid.name}, ${key}: ${alloc}`,
                    );
                }

                // If labor allocations are authoritative, every demanded worker
                // must be allocated. Producing goods without the required labor
                // would violate the model.
                if(alloc + 1e-9 < demanded) {
                    throw new Error(
                        `Labor allocation insufficient for ${bid.name}, ${key}: ` +
                        `allocated ${alloc}, required ${demanded}`,
                    );
                }

                employed = demanded;
            } else {
                // Sequential depletion (original behavior)
                const available = remainingWorkers[key as keyof Population].number;
                employed = Math.min(demanded, Math.max(0, available));
            }
            // Always deduct employed workers from remaining (works for both allocation paths)
            const available = remainingWorkers[key as keyof Population].number;
            remainingWorkers[key as keyof Population] = {
                ...remainingWorkers[key as keyof Population],
                number: available - employed,
            };
            workersEmployed[key as keyof Population] = employed;
            workingWorkers[key as keyof Population] = {
                ...workingWorkers[key as keyof Population],
                number: workingWorkers[key as keyof Population].number + employed,
            };
        }

        // const sectorInventory = { ...(sectorGoods[bid.name as keyof IndustrialSectors] ?? EMPTY_WAREHOUSE) };
        const consumedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            const consumed = value * finalScale;
            consumedGoods[key as keyof Goods] = consumed;
            // sectorInventory[key as keyof Goods] = Math.max(0, (sectorInventory[key as keyof Goods] ?? 0) - consumed);
            sumGoodsRequirements[key as keyof Goods] = (sumGoodsRequirements[key as keyof Goods] ?? 0) + consumed;
        }

        const producedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsProduction)) {
            const produced = value * finalScale;
            producedGoods[key as keyof Goods] = produced;
            // sectorInventory[key as keyof Goods] = (sectorInventory[key as keyof Goods] ?? 0) + produced;
            sumGoodsProduction[key as keyof Goods] = (sumGoodsProduction[key as keyof Goods] ?? 0) + produced;
        }

        // sectorGoods[bid.name as keyof IndustrialSectors] = sectorInventory;

        // Revenue comes from actual sales (allocatePopulationSales), not from production volume.
        // Unsold goods generate no revenue.
        const inputCosts = Object.entries(consumedGoods).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key as keyof Goods];
        }, 0);
        const laborCosts = Object.entries(workersEmployed).reduce((sum, [key, amount]) => {
            return sum + (amount) * salaries[key as keyof Population];
        }, 0);

        sectorResults[bid.name] = {
            name: bid.name,
            consumedGoods,
            producedGoods,
            workersEmployed,
            productionRatio: finalScale,
            inputLevel: bid.inputLevel,
            outputLevel: bid.outputLevel,
        };
        // Profit starts as negative costs; revenue from population sales is added later in industryTick.worker.ts
        sectorProfits[bid.name] = -(inputCosts + laborCosts);
        sectorRevenue[bid.name] = 0;
        sectorLaborCosts[bid.name] = laborCosts;
        sectorInputCosts[bid.name] = inputCosts;
        sectorUtilization[bid.name] = finalScale;
    }

    // Finalize always-working sectors (stayAtHome)
    for(const key of alwaysWorking) {
        const key2 = key as keyof Population;
        workingWorkers[key2] = {
            ...workingWorkers[key2],
            number: population[key2].number
        };
        remainingWorkers[key as keyof Population] = {
            ...remainingWorkers[key2],
            number: 0
        };
    }

    return {
        sectorResults,
        sectorProfits,
        sectorRevenue,
        sectorLaborCosts,
        sectorInputCosts,
        sectorUtilization,
        sectorStopReason,
        populationProfits: {},
        workingWorkers,
        remainingWorkers,
        // sectorGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    };
}
