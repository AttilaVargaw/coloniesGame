import { industrySectorBlueprints } from "../systems/factoryBlueprints";
import { baseSalaries, getGoodRequirementsAndQoL, getRequirementsForQol, Population, PopulationBreakdown } from "../data/Population";
import { getPrices, Goods, NON_CUMULATING_GOODS } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { populationGrowth } from "../data/populationHelpers";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorResult } from "../systems/generateIndustrialSector";
import { IndustryTickInput } from "./IndustryTickInput";
import { IndustryTickPatch } from "./IndustryTickPatch";
import { IndustryTickResult } from "./IndustryTickResult";
import { SectorBid } from "./SectorBid";
import { SectorExecutionResult } from "./SectorExecutionResult";
import { shallowDiff } from "./shallowDiff";
import { populationDiff } from "./populationDiff";
import { sectorResultChanged } from "./sectorResultChanged";
import { populationUpdateDiff } from "./populationUpdateDiff";

const lastResults = new Map<string, IndustryTickResult>();

const qolSmoothing = 0.03;
const wealthSmoothing = 0.5;
const expectedQolSmoothing = 0.03;
const wasteDecayRate = 0.05;
const wastePerPerson = 0.05;
const maxDailyChangeSmoothing = 0.001;

const alwaysWorking: ReadonlySet<keyof Population> = new Set(["stayAtHome"]);
const colonyPriceMemory = new Map<string, Partial<Record<keyof Goods, number>>>();
const colonyWageMemory = new Map<string, Partial<Record<keyof Population, number>>>();
const EMPTY_WAREHOUSE = createStarterWarehouse(0);

const wageDamping = 0.3;
const wageMinMultiplier = 0.5;
const wageMaxMultiplier = 2.0;

const extraRequirements = {
    student: {
        education: 1
    },
    retired: {
        healthcare: 2
    }
} as Readonly<Record<keyof Population, Partial<Goods>>>

function buildSectorResultsPatch(old: Record<string, SectorResult> | undefined, newResults: Record<string, SectorResult>): { changed: Record<string, SectorResult>; removed: string[] } | null {
    const changed: Record<string, SectorResult> = {};
    const removed: string[] = [];
    let hasChanged = false;

    for(const key in newResults) {
        const oldSector = old?.[key];
        const newSector = newResults[key];
        if(!oldSector || sectorResultChanged(oldSector, newSector)) {
            changed[key] = newSector;
            hasChanged = true;
        }
    }

    if(old) {
        for(const key in old) {
            if(!(key in newResults)) {
                removed.push(key);
                hasChanged = true;
            }
        }
    }

    return hasChanged ? { changed, removed } : null;
}

function buildPatch(last: IndustryTickResult | undefined, result: IndustryTickResult): IndustryTickPatch | null {
    const patch: IndustryTickPatch = { entityId: result.entityId };
    let hasChanged = false;

    const goodsDiff = shallowDiff(last?.goods, result.goods);
    if(goodsDiff) { patch.goods = goodsDiff; hasChanged = true; }

    const goodsReqDiff = shallowDiff(last?.goodsRequirements, result.goodsRequirements);
    if(goodsReqDiff) { patch.goodsRequirements = goodsReqDiff; hasChanged = true; }

    const goodsProdDiff = shallowDiff(last?.goodsProduction, result.goodsProduction);
    if(goodsProdDiff) { patch.goodsProduction = goodsProdDiff; hasChanged = true; }

    const workingWorkersDiff = populationDiff(last?.workingWorkers, result.workingWorkers);
    if(workingWorkersDiff) { patch.workingWorkers = workingWorkersDiff; hasChanged = true; }

    const freeWorkersDiff = populationDiff(last?.freeWorkers, result.freeWorkers);
    if(freeWorkersDiff) { patch.freeWorkers = freeWorkersDiff; hasChanged = true; }

    if(last?.populationUpdates !== result.populationUpdates) {
        const updatedPop: IndustryTickPatch["populationUpdates"] = {};
        let popChanged = false;
        for(const key in result.populationUpdates) {
            const oldUpdate = last?.populationUpdates[key as keyof Population];
            const newUpdate = result.populationUpdates[key as keyof Population];
            if(!oldUpdate || populationUpdateDiff(oldUpdate, newUpdate)) {
                updatedPop[key as keyof Population] = newUpdate;
                popChanged = true;
            }
        }
        if(popChanged) {
            patch.populationUpdates = updatedPop;
            hasChanged = true;
        }
    }

    const sectorProfitsDiff = shallowDiff(last?.sectorProfits, result.sectorProfits);
    if(sectorProfitsDiff) { patch.sectorProfits = sectorProfitsDiff; hasChanged = true; }

    const popProfitsDiff = shallowDiff(last?.populationProfits, result.populationProfits);
    if(popProfitsDiff) { patch.populationProfits = popProfitsDiff; hasChanged = true; }

    const sectorUtilDiff = shallowDiff(last?.sectorUtilization, result.sectorUtilization);
    if(sectorUtilDiff) { patch.sectorUtilization = sectorUtilDiff; hasChanged = true; }

    const capitalStockDiff = shallowDiff(last?.capitalStock, result.capitalStock);
    if(capitalStockDiff) { patch.capitalStock = capitalStockDiff; hasChanged = true; }

    const sectorGoodsDiff = shallowDiff(last?.sectorGoods, result.sectorGoods);
    if(sectorGoodsDiff) { patch.sectorGoods = sectorGoodsDiff; hasChanged = true; }

    const sectorResultsPatch = buildSectorResultsPatch(last?.sectorResults, result.sectorResults);
    if(sectorResultsPatch) { patch.sectorResults = sectorResultsPatch; hasChanged = true; }

    return hasChanged ? patch : null;
}

function buildSectorBid(
    name: keyof IndustrialSectors,
    prices: Record<keyof Goods, number>,
    techMultiplier: number,
    laborAssigned: number,
    capitalStock: Partial<Goods>,
    salaries: Record<keyof Population, number>,
): SectorBid | null {
    const config = industrySectorBlueprints.get(name);
    if(!config) return null;

    const capitalGoods = config.capitalGoods || {};

    // Capital adequacy: capital stock relative to reference consumption.
    // 0 stock = 0 production, reference stock = 1.0x production,
    // excess capital increases max production with diminishing returns.
    let capitalAdequacy = Infinity;
    let hasCapitalGoods = false;
    for(const goodKey of Object.keys(capitalGoods) as (keyof Goods)[]) {
        hasCapitalGoods = true;
        const stock = capitalStock[goodKey] ?? 0;
        const rate = capitalGoods[goodKey] as number;
        const referenceConsumption = rate * 100;
        if(referenceConsumption <= 0) continue;

        const ratio = stock / referenceConsumption;
        // Below target: linear scaling. Above target: diminishing log2 returns.
        const adequacy = ratio >= 1 ? 1 + Math.sqrt(ratio) : ratio;
        capitalAdequacy = Math.min(capitalAdequacy, adequacy);
    }
    if(!hasCapitalGoods) capitalAdequacy = 1;

    const outputLevel = techMultiplier * capitalAdequacy;
    const inputLevel = capitalAdequacy;

    const workerRequirement = config.workerRequirement || {};
    const goodsRequirements = config.goodsRequirements || {};
    const goodsProduction = config.goodsProduction || {};

    const inputCost = Object.entries(goodsRequirements).reduce((sum, [key, value]) => {
        return sum + value * prices[key as keyof Goods];
    }, 0);

    const laborCost = Object.entries(workerRequirement).reduce((sum, [key, value]) => {
        return sum + value * salaries[key as keyof Population];
    }, 0);

    const costPerUnit = inputCost + laborCost;
    const budgetRatio = costPerUnit > 0 ? Math.min(1, Math.max(0, 1)) : 1;

    // Apply laborAssigned as a hard cap on worker demand
    const idealWorkerDemand = Object.fromEntries(
        Object.entries(workerRequirement).map(([k, v]) => [k, v * inputLevel])
    ) as Partial<Record<keyof Population, number>>;

    // If laborAssigned is set, scale worker demand down proportionally
    let totalWorkerDemand = 0;
    for(const v of Object.values(idealWorkerDemand)) {
        totalWorkerDemand += v;
    }
    let laborScale = 1;
    if(laborAssigned > 0 && totalWorkerDemand > 0) {
        laborScale = Math.min(1, laborAssigned / totalWorkerDemand);
    }

    const scaledWorkerDemand = Object.fromEntries(
        Object.entries(idealWorkerDemand).map(([k, v]) => [k, v * laborScale])
    ) as Partial<Record<keyof Population, number>>;

    return {
        name: name as string,
        level: 1,
        budgetRatio,
        inputCost: inputCost * inputLevel,
        laborCost: laborCost * inputLevel,
        idealWorkerDemand: scaledWorkerDemand,
        idealGoodsDemand: Object.fromEntries(
            Object.entries(goodsRequirements).map(([k, v]) => [k, v * inputLevel])
        ) as Partial<Record<keyof Goods, number>>,
        idealGoodsProduction: Object.fromEntries(
            Object.entries(goodsProduction).map(([k, v]) => [k, v * outputLevel])
        ) as Partial<Record<keyof Goods, number>>,
        outputLevel,
        inputLevel,
    };
}

function calculateMarketRatios(
    sectorBids: SectorBid[],
    population: Population,
    goods: Goods
): { workerMarketRatios: Record<keyof Population, number>; goodsMarketRatios: Record<keyof Goods, number> } {
    const totalIdealWorkerDemand = {} as Record<keyof Population, number>;
    const totalIdealGoodsDemand = {} as Record<keyof Goods, number>;

    for(const bid of sectorBids) {
        for(const [key, value] of Object.entries(bid.idealWorkerDemand) as [keyof Population, number][]) {
            totalIdealWorkerDemand[key] = (totalIdealWorkerDemand[key] ?? 0) + value;
        }
        for(const [key, value] of Object.entries(bid.idealGoodsDemand) as [keyof Goods, number][]) {
            totalIdealGoodsDemand[key] = (totalIdealGoodsDemand[key] ?? 0) + value;
        }
    }

    const workerMarketRatios = {} as Record<keyof Population, number>;
    for(const [key, totalDemand] of Object.entries(totalIdealWorkerDemand) as [keyof Population, number][]) {
        const available = population[key].number;
        workerMarketRatios[key] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
    }

    const goodsMarketRatios = {} as Record<keyof Goods, number>;
    for(const [key, totalDemand] of Object.entries(totalIdealGoodsDemand) as [keyof Goods, number][]) {
        const available = Math.max(0, goods[key]);
        goodsMarketRatios[key] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
    }

    return { workerMarketRatios, goodsMarketRatios };
}

function executeSectors(
    sectorBids: SectorBid[],
    workerMarketRatios: Record<keyof Population, number>,
    goodsMarketRatios: Record<keyof Goods, number>,
    population: Population,
    inputSectorGoods: Record<keyof IndustrialSectors, Goods>,
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
    const sectorUtilization: Record<string, number> = {};

    const sectorGoods: Record<keyof IndustrialSectors, Goods> = { ...inputSectorGoods };

    for(const bid of sectorBids) {
        let marketConstraint = 1;
        for(const [key, value] of Object.entries(bid.idealWorkerDemand) as [keyof Population, number][]) {
            if(value > 0) {
                marketConstraint = Math.min(marketConstraint, workerMarketRatios[key] ?? 1);
            }
        }
        const sectorConfig = industrySectorBlueprints.get(bid.name as keyof IndustrialSectors);
        const nonEssentialGoods = new Set<keyof Goods>((sectorConfig?.nonEssentialGoods || sectorConfig?.optionalGoods || []) as (keyof Goods)[]);
        for(const [key, value] of Object.entries(bid.idealGoodsDemand) as [keyof Goods, number][]) {
            if(value > 0) {
                const ratio = goodsMarketRatios[key] ?? 1;
                if(nonEssentialGoods.has(key)) {
                    marketConstraint = Math.min(marketConstraint, 0.25 + 0.75 * ratio);
                } else {
                    marketConstraint = Math.min(marketConstraint, ratio);
                }

                // Sector inventory constraint: can't consume more than available
                const available = (sectorGoods[bid.name as keyof IndustrialSectors]?.[key] ?? 0);
                const maxScaleFromInventory = value > 0 ? available / value : 1;
                const inventoryConstraint = nonEssentialGoods.has(key)
                    ? Math.max(0.25, maxScaleFromInventory)
                    : maxScaleFromInventory;
                marketConstraint = Math.min(marketConstraint, inventoryConstraint);
            }
        }

        const budgetRatio = bid.inputCost + bid.laborCost > 0 ? Math.min(1, Math.max(0, 1)) : 1;
        const actualScale = Math.min(budgetRatio, marketConstraint);

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
            continue;
        }

        const workersEmployed: Partial<Record<keyof Population, number>> = {};
        for(const [key, value] of Object.entries(bid.idealWorkerDemand) as [keyof Population, number][]) {
            const employed = value * actualScale;
            workersEmployed[key] = employed;
            remainingWorkers[key] = {
                ...remainingWorkers[key],
                number: remainingWorkers[key].number - employed,
            };
            workingWorkers[key] = {
                ...workingWorkers[key],
                number: workingWorkers[key].number + employed,
            };
        }

        const sectorInventory = { ...(sectorGoods[bid.name as keyof IndustrialSectors] ?? EMPTY_WAREHOUSE) };
        const consumedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsDemand) as [keyof Goods, number][]) {
            const consumed = value * actualScale;
            consumedGoods[key] = consumed;
            sectorInventory[key] = Math.max(0, (sectorInventory[key] ?? 0) - consumed);
            sumGoodsRequirements[key] = (sumGoodsRequirements[key] ?? 0) + consumed;
        }

        const producedGoods: Partial<Goods> = {};
        for(const [key, value] of Object.entries(bid.idealGoodsProduction) as [keyof Goods, number][]) {
            const produced = value * actualScale;
            producedGoods[key] = produced;
            sectorInventory[key] = (sectorInventory[key] ?? 0) + produced;
            sumGoodsProduction[key] = (sumGoodsProduction[key] ?? 0) + produced;
        }

        sectorGoods[bid.name as keyof IndustrialSectors] = sectorInventory;

        const revenue = (Object.entries(producedGoods) as [keyof Goods, number][]).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key];
        }, 0);
        const inputCosts = (Object.entries(consumedGoods) as [keyof Goods, number][]).reduce((sum, [key, amount]) => {
            return sum + (amount) * prices[key];
        }, 0);
        const laborCosts = (Object.entries(workersEmployed) as [keyof Population, number][]).reduce((sum, [key, amount]) => {
            return sum + (amount) * salaries[key];
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
        sectorUtilization[bid.name] = actualScale;
    }

    return {
        sectorResults,
        sectorProfits,
        sectorUtilization,
        workingWorkers,
        remainingWorkers,
        sectorGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    };
}

function finalizeGoods(
    currentGoods: Goods,
    sumGoodsProduction: Goods,
    sumGoodsRequirements: Goods,
    populationConsumption: Partial<Goods>,
    population: Population
): Goods {
    const finalGoods = { ...currentGoods } as Goods;

    for(const key of Object.keys(sumGoodsProduction) as (keyof Goods)[]) {
        finalGoods[key] = (finalGoods[key] ?? 0) + (sumGoodsProduction[key] ?? 0);
    }

    for(const key of Object.keys(sumGoodsRequirements) as (keyof Goods)[]) {
        finalGoods[key] = Math.max(0, (finalGoods[key] ?? 0) - (sumGoodsRequirements[key] ?? 0));
    }

    for(const key of Object.keys(populationConsumption) as (keyof Goods)[]) {
        finalGoods[key] = Math.max(0, (finalGoods[key] ?? 0) - (populationConsumption[key] ?? 0));
    }

    const totalPopulation = Object.values(population).reduce((sum, pop) => sum + pop.number, 0);
    const populationWaste = totalPopulation * wastePerPerson;

    finalGoods.waste = Math.max(0, (finalGoods.waste || 0) + populationWaste - wasteDecayRate * (currentGoods.waste || 0));

    for(const key of Object.keys(finalGoods) as (keyof Goods)[]) {
        if(NON_CUMULATING_GOODS.has(key)) {
            finalGoods[key] = Math.max(0, finalGoods[key] ?? 0);
        }
    }

    return finalGoods;
}

function processIndustry(
    industry: IndustryTickInput,
    priceMemory: Map<string, Partial<Record<keyof Goods, number>>>,
    results: Map<string, IndustryTickResult>
): IndustryTickPatch | null {
    const { entityId, activeSectors, goods, population, techMultipliers, laborAssigned, capitalStock, money: startingMoney, sectorGoods, settlementType, allowedSectors } = industry;

    const memory = priceMemory.get(entityId) || {};
    const prices = getPrices(goods, memory);
    priceMemory.set(entityId, memory);

    const wageMemory = colonyWageMemory.get(entityId) || {};
    const adjustedSalaries: Record<keyof Population, number> = {} as Record<keyof Population, number>;
    for(const key of Object.keys(baseSalaries) as (keyof Population)[]) {
        adjustedSalaries[key] = wageMemory[key] ?? baseSalaries[key];
    }

    const allowedSectorsSet = new Set(allowedSectors ?? Array.from(activeSectors));

    const populationConsumption = {} as Partial<Goods>;
    const populationUpdates: IndustryTickResult["populationUpdates"] = {} as IndustryTickResult["populationUpdates"];
    const populationProfits: Record<string, number> = {};

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
            for(const [good, amount] of Object.entries(extra) as [keyof Goods, number][]) {
                requirements[good] = (requirements[good] ?? 0) + amount * pop.number;
            }
        }

        for(const it in requirements) {
            populationConsumption[it as keyof Goods] =
                (requirements[it as keyof Goods] ?? 0) +
                (populationConsumption[it as keyof Goods] ?? 0);
        }

        const income = adjustedSalaries[key] * pop.number;
        const expenses = (Object.entries(requirements) as [keyof Goods, number][]).reduce((sum, [good, amount]) => {
            if(!amount) return sum;
            return sum + amount * prices[good];
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
            requirements,
        };

        populationProfits[key] = income - expenses;
    }

    const sectorBids: SectorBid[] = [];
    for(const name of activeSectors) {
        if((settlementType === "outpost" || settlementType === "hydrocarbonRefinery") && !allowedSectorsSet.has(name)) {
            continue;
        }

        const techMultiplier = techMultipliers[name] ?? 1;
        const laborAssignedVal = laborAssigned[name] ?? 0;
        const capitalStockVal = capitalStock[name] ?? {};

        const bid = buildSectorBid(name, prices, techMultiplier, laborAssignedVal, capitalStockVal, adjustedSalaries);
        if(bid) {
            sectorBids.push(bid);
        }
    }

    const { workerMarketRatios, goodsMarketRatios } = calculateMarketRatios(sectorBids, population, goods);

    // Update wage memory based on current worker market ratios
    // Scarce workers (ratio < 1) → wages rise; abundant workers (ratio > 1) → wages fall
    for(const [workerType, ratio] of Object.entries(workerMarketRatios) as ([keyof Population, number][])) {
        const currentWage = wageMemory[workerType] ?? baseSalaries[workerType];
        let wageMultiplier = 1.0;
        if(ratio > 0) {
            wageMultiplier = 1.0 / ratio;
        } else {
            wageMultiplier = wageMaxMultiplier;
        }
        wageMultiplier = Math.max(wageMinMultiplier, Math.min(wageMaxMultiplier, wageMultiplier));
        const targetWage = baseSalaries[workerType] * wageMultiplier;
        const dampedWage = currentWage + (targetWage - currentWage) * wageDamping;
        wageMemory[workerType] = dampedWage;
    }
    colonyWageMemory.set(entityId, wageMemory);

    const newMoney: Record<string, number> = { ...startingMoney };

    // Sectors buy input goods from colony pool using their own money
    // Buy a 5-tick buffer so sectors hold visible inventory
    const BUY_BUFFER_TICKS = 5;
    const colonyGoodsAfterPurchase = { ...goods };
    const updatedSectorGoodsBeforeExec: Record<keyof IndustrialSectors, Goods> = { ...sectorGoods };
    for(const bid of sectorBids) {
        const sectorName = bid.name as keyof IndustrialSectors;
        const config = industrySectorBlueprints.get(sectorName);
        if(!config?.goodsRequirements) continue;

        const sectorInv = { ...(updatedSectorGoodsBeforeExec[sectorName] ?? EMPTY_WAREHOUSE) };
        let sectorMoney = newMoney[sectorName] ?? 0;

        for(const [goodKey, demandPerTick] of Object.entries(bid.idealGoodsDemand) as [keyof Goods, number][]) {
            if(demandPerTick <= 0) continue;

            const demand = demandPerTick * BUY_BUFFER_TICKS;
            const available = colonyGoodsAfterPurchase[goodKey] ?? 0;
            const price = prices[goodKey] ?? 0;
            if(available <= 0 || price <= 0) continue;

            const canAfford = Math.floor(sectorMoney / price);
            const toBuy = Math.min(demand, available, canAfford);
            if(toBuy <= 0) continue;

            sectorMoney -= toBuy * price;
            colonyGoodsAfterPurchase[goodKey] = Math.max(0, available - toBuy);
            sectorInv[goodKey] = (sectorInv[goodKey] ?? 0) + toBuy;
        }

        newMoney[sectorName] = sectorMoney;
        updatedSectorGoodsBeforeExec[sectorName] = sectorInv;
    }

    const {
        sectorResults,
        sectorProfits,
        sectorUtilization,
        workingWorkers,
        remainingWorkers,
        sectorGoods: updatedSectorGoods,
        sumGoodsRequirements,
        sumGoodsProduction,
    } = executeSectors(
        sectorBids,
        workerMarketRatios,
        goodsMarketRatios,
        population,
        updatedSectorGoodsBeforeExec,
        prices,
        adjustedSalaries
    );

    for(const key of alwaysWorking) {
        const key2 = key;

        workingWorkers[key2] = {
            ...workingWorkers[key2],
            number: population[key2].number
        };
        remainingWorkers[key] = {
            ...remainingWorkers[key2],
            number: 0
        };
    }

    // Sector profits (revenue - input costs - labor costs) go into per-sector money pools
    for(const [sectorName, profit] of Object.entries(sectorProfits)) {
        newMoney[sectorName] = (newMoney[sectorName] ?? 0) + profit;
    }

    // Move goods between sectors and colony pool:
    // Sectors SELL produced output to colony, BUY consumed inputs from colony
    const colonyGoodsDelta: Partial<Goods> = { ...EMPTY_WAREHOUSE };

    // Deduct goods sectors bought from colony pool for inputs
    for(const goodKey of Object.keys(goods) as (keyof Goods)[]) {
        const bought = (goods[goodKey] ?? 0) - (colonyGoodsAfterPurchase[goodKey] ?? 0);
        if(bought > 0) {
            colonyGoodsDelta[goodKey] = (colonyGoodsDelta[goodKey] ?? 0) - bought;
        }
    }

    for(const name of activeSectors) {
        const sectorResult = sectorResults[name];
        if(!sectorResult || sectorResult.productionRatio <= 0) continue;

        // Sector sells part of produced output to colony, keeps rest as buffer
        const KEEP_BUFFER_RATIO = 0.5;
        for(const [goodKey, amount] of Object.entries(sectorResult.producedGoods) as [keyof Goods, number][]) {
            if(amount > 0) {
                const keep = Math.floor(amount * KEEP_BUFFER_RATIO);
                const sell = amount - keep;
                if(sell > 0) {
                    colonyGoodsDelta[goodKey] = (colonyGoodsDelta[goodKey] ?? 0) + sell;
                }
                // Keep buffer in sector inventory
                const sectorInv = { ...(updatedSectorGoods[name] ?? EMPTY_WAREHOUSE) };
                sectorInv[goodKey] = (sectorInv[goodKey] ?? 0) + keep;
                updatedSectorGoods[name] = sectorInv;
            }
        }

        // Sector buys consumed inputs from colony pool (already deducted in buy step via colonyGoodsAfterPurchase)
        // No additional deduction needed here
    }

    // Capital replenishment: sectors buy replacement capital goods from colony pool
    const capitalReplenishmentDelta: Partial<Goods> = { ...EMPTY_WAREHOUSE };
    const newCapitalStock: Record<string, Partial<Goods>> = {};
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
            for(const [goodKey, rate] of Object.entries(config.capitalGoods) as [keyof Goods, number][]) {
                const consumed = rate * actualScale;
                wear[goodKey] = consumed;
                currentStock[goodKey] = Math.max(0, (currentStock[goodKey] ?? 0) - consumed);
            }

            // Decay: natural deterioration of capital stock
            const decay = config.capitalEfficiencyDecay ?? 0;
            const decayAmounts: Partial<Goods> = {};
            if(decay > 0) {
                for(const goodKey of Object.keys(currentStock) as (keyof Goods)[]) {
                    const stock = currentStock[goodKey] ?? 0;
                    const amount = stock * decay;
                    decayAmounts[goodKey] = amount;
                    currentStock[goodKey] = Math.max(0, stock - amount);
                }
            }

            // Replenish wear + decay from colony pool, paid with sector's own money
            const totalLoss: Partial<Goods> = { ...wear };
            for(const [key, amount] of Object.entries(decayAmounts) as [keyof Goods, number][]) {
                totalLoss[key] = (totalLoss[key] ?? 0) + amount;
            }
            for(const [goodKey, amount] of Object.entries(totalLoss) as [keyof Goods, number][]) {
                if(amount <= 0) continue;
                const cost = amount * (prices[goodKey] ?? 0);
                if(newMoney[name] >= cost) {
                    newMoney[name] -= cost;
                    capitalReplenishmentDelta[goodKey] = (capitalReplenishmentDelta[goodKey] ?? 0) - amount;
                    currentStock[goodKey] = (currentStock[goodKey] ?? 0) + amount;
                }
            }

            // Invest: buy additional capital stock to raise capital adequacy toward 1.0
            // Target stock per capital good = rate * 100 (reference production scale)
            for(const [goodKey, rate] of Object.entries(config.capitalGoods) as [keyof Goods, number][]) {
                const targetStock = rate * 100;
                const current = currentStock[goodKey] ?? 0;
                if(current >= targetStock) continue;

                const needed = targetStock - current;
                const cost = needed * (prices[goodKey] ?? 0);
                if(cost <= 0) continue;

                const canAfford = Math.floor(newMoney[name] / cost);
                if(canAfford <= 0) continue;

                const toBuy = Math.min(needed, canAfford);
                const buyCost = toBuy * (prices[goodKey] ?? 0);
                newMoney[name] -= buyCost;
                capitalReplenishmentDelta[goodKey] = (capitalReplenishmentDelta[goodKey] ?? 0) - toBuy;
                currentStock[goodKey] = current + toBuy;
            }
        }

        newCapitalStock[name] = currentStock;
    }

    // Merge capital replenishment into colony goods delta (deduct purchases from colony)
    for(const [goodKey, amount] of Object.entries(capitalReplenishmentDelta) as [keyof Goods, number][]) {
        colonyGoodsDelta[goodKey] = (colonyGoodsDelta[goodKey] ?? 0) + amount;
    }

    // Apply colony goods changes: split delta into production (sell to colony) and requirements (buy from colony)
    const colonyGoodsProduction = { ...EMPTY_WAREHOUSE };
    const colonyGoodsRequirements = { ...EMPTY_WAREHOUSE };
    for(const [key, value] of Object.entries(colonyGoodsDelta) as [keyof Goods, number][]) {
        if(value > 0) {
            colonyGoodsProduction[key] = value;
        } else if(value < 0) {
            colonyGoodsRequirements[key] = Math.abs(value);
        }
    }
    const colonyGoodsChanges = finalizeGoods(goods, colonyGoodsProduction, colonyGoodsRequirements, populationConsumption, population);

    const result: IndustryTickResult = {
        entityId,
        goodsRequirements: { ...sumGoodsRequirements, ...populationConsumption },
        goodsProduction: sumGoodsProduction,
        workingWorkers: workingWorkers,
        freeWorkers: remainingWorkers,
        populationUpdates,
        goods: colonyGoodsChanges,
        sectorProfits,
        populationProfits,
        sectorUtilization,
        sectorResults,
        capitalStock: newCapitalStock,
        money: newMoney,
        sectorGoods: updatedSectorGoods,
        settlementType,
        allowedSectors,
    };

    const last = results.get(entityId);
    const patch = buildPatch(last, result);
    if(patch) {
        return patch;
    }

    results.set(entityId, result);
    return null;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[] }>) => {
    if(event.data.type !== "tick") {
        return
    }

    const activeEntityIds = new Set<string>()
    for(const industry of event.data.industries) {
        activeEntityIds.add(industry.entityId)
    }

    for(const entityId of colonyPriceMemory.keys()) {
        if(!activeEntityIds.has(entityId)) {
            colonyPriceMemory.delete(entityId)
        }
    }

    for(const entityId of lastResults.keys()) {
        if(!activeEntityIds.has(entityId)) {
            lastResults.delete(entityId)
        }
    }

    const patches: IndustryTickPatch[] = [];

    for(const industry of event.data.industries) {
        const patch = processIndustry(industry, colonyPriceMemory, lastResults);
        if(patch) {
            patches.push(patch);
        }
    }

    self.postMessage({ type: "result", patches });
};
