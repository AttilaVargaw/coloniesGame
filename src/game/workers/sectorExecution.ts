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

    // Sector inventory constraint: hard cap — can't consume more than available
    const available = sectorInventory[goodKey] ?? 0;
    const maxScaleFromInventory = demandPerTick > 0 ? available / demandPerTick : 1;
    const inventoryConstraint = maxScaleFromInventory;

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

    // Validate actualScale before material scaling
    if(
        !Number.isFinite(actualScale) ||
        actualScale < 0 ||
        actualScale > 1
    ) {
        throw new Error(`Invalid actualScale for ${bid.name}: ${actualScale}`);
    }

    // Compute material ratio: what fraction of the sector's input demand can
    // actually be met at this scale. finalScale = actualScale * materialRatio.
    let materialRatio = 1;
    const sectorPurchases = purchasedBySector?.[bid.name];

    for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand)) {
        if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
            throw new Error(`Invalid input demand for ${bid.name}/${goodKey}`);
        }
        if(demandPerTick === 0) continue;

        const key = goodKey as keyof Goods;
        const scaleForMaterial = actualScale > 0 ? actualScale : 1;
        const required = demandPerTick * scaleForMaterial;

        if(!Number.isFinite(required)) {
            throw new Error(`Input requirement overflow for ${bid.name}/${goodKey}`);
        }

        let available: number;
        if(sectorPurchases) {
            available = sectorPurchases[key] ?? 0;
        } else {
            available = colonyGoods[goodKey as keyof Goods] ?? 0;
        }

        if(!Number.isFinite(available) || available < 0) {
            throw new Error(`Invalid available input for ${bid.name}/${goodKey}`);
        }

        const ratio = required > 0
            ? Math.min(1, available / required)
            : 1;

        materialRatio = Math.min(materialRatio, ratio);
    }

    // Worker availability: use centralized labor allocation when provided,
    // otherwise fall back to remaining workers for the stop-reason diagnostic.
    let workerRatio = 1;
    const sectorLaborAllocation = laborAllocations?.[bid.name];
    for(const [key, demandPerTick] of Object.entries(bid.idealWorkerDemand)) {
        if(!Number.isFinite(demandPerTick) || demandPerTick < 0) {
            throw new Error(`Invalid worker demand for ${bid.name}/${key}`);
        }
        if(demandPerTick === 0 || actualScale === 0) continue;

        const popType = key as keyof Population;
        const required = demandPerTick * actualScale;

        if(!Number.isFinite(required)) {
            throw new Error(`Worker requirement overflow for ${bid.name}/${popType}`);
        }

        let available: number;
        if(sectorLaborAllocation) {
            available = sectorLaborAllocation[popType] ?? 0;
        } else {
            available = remainingWorkers[popType].number;
        }

        if(!Number.isFinite(available) || available < 0) {
            throw new Error(`Invalid available labor for ${bid.name}/${popType}`);
        }

        workerRatio = Math.min(workerRatio, Math.min(1, available / required));
    }

    // Apply both material and labor constraints to actualScale.
    const constrainedScale = actualScale * Math.min(materialRatio, workerRatio);
    const finalScale = Math.max(0, Math.min(actualScale, constrainedScale));

    // Determine stop reason based on the most restrictive resource constraint.
    let stopReason = "";
    if(finalScale <= 0) {
        if(bid.budgetRatio <= 0) stopReason = "No money";
        else if(workerRatio <= 0) stopReason = "No workers";
        else if(materialRatio <= 0) stopReason = "No materials";
        else stopReason = "Bottlenecked";
    } else if(materialRatio < 1 && materialRatio < workerRatio) {
        stopReason = "Material shortage";
    } else if(workerRatio < 1 && workerRatio <= materialRatio) {
        stopReason = "Worker shortage";
    } else if(bid.budgetRatio < 1 && bid.budgetRatio <= finalScale) {
        stopReason = "Low budget";
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
            sectorUtilization[bid.name] = 0;
            continue;
        }

        const workersEmployed: Partial<Record<keyof Population, number>> = {};
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
            if(employed > available + 1e-9) {
                throw new Error(
                    `Worker allocation exceeds available population for ${bid.name}/${key}`,
                );
            }
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
