import { industrySectorBlueprints } from "../systems/sectorBlueprints";
import { Goods } from "../data/Goods";
import { Population, PopulationBreakdown } from "../data/Population";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorBid } from "./SectorBid";
import type { SectorExecutionResult } from "./SectorExecutionResult";
import type { SectorResult } from "../systems/generateIndustrialSector";

const EMPTY_WAREHOUSE = createStarterWarehouse(0);

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);

function applyGoodConstraint(
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
    workerMarketRatios: Record<keyof Population, number>,
    goodsMarketRatios: Record<keyof Goods, number>,
    population: Population,
    inputSectorGoods: Record<keyof IndustrialSectors, Goods>,
    colonyGoods: Goods,
    prices: Record<keyof Goods, number>,
    salaries: Record<keyof Population, number>
): SectorExecutionResult {
    const sumGoodsRequirements = { ...EMPTY_WAREHOUSE };
    const sumGoodsProduction = { ...EMPTY_WAREHOUSE };
    const workingWorkers = createStarterPopulation(0);
    const remainingWorkers: Record<keyof Population, PopulationBreakdown> = { ...createStarterPopulation(0) };
    for(const key of Object.keys(population) as (keyof Population)[]) {
        remainingWorkers[key] = { ...population[key] };
    }

    const sectorResults: Record<string, SectorResult> = {};
    const sectorProfits: Record<string, number> = {};
    const sectorRevenue: Record<string, number> = {};
    const sectorLaborCosts: Record<string, number> = {};
    const sectorInputCosts: Record<string, number> = {};
    const sectorUtilization: Record<string, number> = {};

    const sectorGoods: Record<keyof IndustrialSectors, Goods> = { ...inputSectorGoods };

    const sectorStopReason: Record<string, string> = {};

    for(const bid of sectorBids) {
        let workerRatio = 1;

        // Worker availability
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            if(value > 0) {
                const r = workerMarketRatios[key as keyof Population] ?? 1;
                workerRatio = Math.min(workerRatio, r);
            }
        }

        // Goods availability: colony pool + sector inventory combined (for stop reason)
        let goodsRatio = 1;
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            if(value <= 0) continue;
            const gKey = key as keyof Goods;
            const sectorInv = sectorGoods[bid.name as keyof IndustrialSectors]?.[gKey] ?? 0;
            const colonyAvail = colonyGoods[gKey] ?? 0;
            const totalAvailable = sectorInv + colonyAvail;
            const ratio = value > 0 ? totalAvailable / value : 1;
            goodsRatio = Math.min(goodsRatio, ratio);
        }

        // Market constraint for production scale: each good independently evaluated.
        // Sector inventory overrides colony pool when it fully covers demand.
        let marketConstraint = 1;
        const sectorConfig = industrySectorBlueprints.get(bid.name as keyof IndustrialSectors);
        const nonEssentialGoods = new Set<keyof Goods>((sectorConfig?.nonEssentialGoods || sectorConfig?.optionalGoods || []) as (keyof Goods)[]);
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            if(value <= 0) continue;
            const isNonEssential = nonEssentialGoods.has(key as keyof Goods);
            const ratio = goodsMarketRatios[key as keyof Goods] ?? 1;
            const singleGoodConstraint = isNonEssential
                ? Math.min(1, 0.5 + 0.75 * ratio)
                : Math.min(1, ratio);

            // Sector inventory fully covers this tick's demand — no constraint from this good
            const gKey = key as keyof Goods;
            const sectorInv = sectorGoods[bid.name as keyof IndustrialSectors]?.[gKey] ?? 0;
            const maxScaleFromInventory = value > 0 ? sectorInv / value : 1;
            if(maxScaleFromInventory >= 1) continue;

            const inventoryConstraint = isNonEssential
                ? Math.max(0.5, maxScaleFromInventory)
                : maxScaleFromInventory;

            marketConstraint = Math.min(marketConstraint, singleGoodConstraint, inventoryConstraint);
        }

        const budgetRatio = bid.budgetRatio;
        const actualScale = Math.min(budgetRatio, marketConstraint);

        // Determine stop reason
        let stopReason = "";
        if(actualScale <= 0) {
            if(budgetRatio <= 0) stopReason = "No money";
            else if(workerRatio <= 0) stopReason = "No workers";
            else if(goodsRatio <= 0) stopReason = "No materials";
            else stopReason = "Bottlenecked";
        } else if(budgetRatio < 1 && budgetRatio < marketConstraint) {
            stopReason = "Low budget";
        } else if(workerRatio < 1 && workerRatio < goodsRatio) {
            stopReason = "Worker shortage";
        } else if(goodsRatio < 1 && goodsRatio < workerRatio) {
            stopReason = "Material shortage";
        }
        sectorStopReason[bid.name] = stopReason;

        if(actualScale <= 0) {
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
        for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
            const employed = value * actualScale;
            workersEmployed[key as keyof Population] = employed;
            remainingWorkers[key as keyof Population] = {
                ...remainingWorkers[key as keyof Population],
                number: remainingWorkers[key as keyof Population].number - employed,
            };
            workingWorkers[key as keyof Population] = {
                ...workingWorkers[key as keyof Population],
                number: workingWorkers[key as keyof Population].number + employed,
            };
        }

        const sectorInventory = { ...(sectorGoods[bid.name as keyof IndustrialSectors] ?? EMPTY_WAREHOUSE) };
        const consumedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
            const consumed = value * actualScale;
            consumedGoods[key as keyof Goods] = consumed;
            sectorInventory[key as keyof Goods] = Math.max(0, (sectorInventory[key as keyof Goods] ?? 0) - consumed);
            sumGoodsRequirements[key as keyof Goods] = (sumGoodsRequirements[key as keyof Goods] ?? 0) + consumed;
        }

        const producedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsProduction)) {
            const produced = value * actualScale;
            producedGoods[key as keyof Goods] = produced;
            sectorInventory[key as keyof Goods] = (sectorInventory[key as keyof Goods] ?? 0) + produced;
            sumGoodsProduction[key as keyof Goods] = (sumGoodsProduction[key as keyof Goods] ?? 0) + produced;
        }

        sectorGoods[bid.name as keyof IndustrialSectors] = sectorInventory;

        const revenue = Object.entries(producedGoods).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key as keyof Goods];
        }, 0);
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
            productionRatio: actualScale,
            inputLevel: bid.inputLevel,
            outputLevel: bid.outputLevel,
        };
        sectorProfits[bid.name] = revenue - inputCosts - laborCosts;
        sectorRevenue[bid.name] = revenue;
        sectorLaborCosts[bid.name] = laborCosts;
        sectorInputCosts[bid.name] = inputCosts;
        sectorUtilization[bid.name] = actualScale;
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
        sectorGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    };
}
