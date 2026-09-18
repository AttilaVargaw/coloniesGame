import { industryReducers, getSectorOutputLevel, sectorUpgradeCosts } from "../systems/factoryBlueprints";
import { baseSalaries, getGoodRequirementsAndQoL, Population, PopulationBreakdown } from "../data/Population";
import { getPrices, Goods } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { populationGrowth } from "../data/populationHelpers";
import type { IndustrialSectors } from "../components/Factories";
import type { SectorResult } from "../systems/generateIndustrialSector";

export interface IndustryTickInput {
    entityId: string;
    sectors: IndustrialSectors;
    goods: Goods;
    population: Population;
    sectorWealth: Record<keyof IndustrialSectors, number>;
}

export interface IndustryTickResult {
    entityId: string;
    goodsRequirements: Partial<Goods>;
    goodsProduction: Partial<Goods>;
    workingWorkers: Population;
    freeWorkers: Population;
    populationUpdates: Record<string, {
        qol: number;
        expectedQol: number;
        populationChange: number;
        wealth: number;
        requirements: Record<string, number>;
    }>;
    goodsChange: Goods;
    sectorProfits: Record<string, number>;
    sectorMaintenance: Record<string, number>;
    populationProfits: Record<string, number>;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[] }>) => {
    if(event.data.type !== "tick") return;

    const results: IndustryTickResult[] = [];

    for(const input of event.data.industries) {
        const { entityId, sectors, goods, population, sectorWealth } = input;
        const prices = getPrices(goods);

        const populationConsumption = {} as Partial<Goods>;
        const populationUpdates: IndustryTickResult["populationUpdates"] = {};
        const populationProfits: Record<string, number> = {};

        for(const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
            const { requirements, qol: targetQol } = getGoodRequirementsAndQoL(
                baseSalaries[key],
                prices,
                pop
            );

            for(const it in requirements) {
                populationConsumption[it as keyof Goods] =
                    (requirements[it as keyof Goods] ?? 0) +
                    (populationConsumption[it as keyof Goods] ?? 0);
            }

            const income = baseSalaries[key] * pop.number;
            const expenses = Object.entries(requirements).reduce((sum, [good, amount]) => {
                if(!amount) return sum;
                return sum + amount * prices[good as keyof Goods];
            }, 0);

            const qolSmoothing = 0.1;
            const smoothedQol = Math.max(0, Math.min(80, pop.qol + (targetQol - pop.qol) * qolSmoothing));

            const wealthSmoothing = 0.5;
            const targetWealth = pop.wealth + income - expenses;
            const smoothedWealth = pop.wealth + (targetWealth - pop.wealth) * wealthSmoothing;

            const expectedQolSmoothing = 0.1;
            const expectedQol = (pop.expectedQol ?? smoothedQol) + (smoothedQol - (pop.expectedQol ?? smoothedQol)) * expectedQolSmoothing;

            const rawPopulationChange = populationGrowth(expectedQol) * pop.number / 7;
            const maxDailyChange = pop.number * 0.001;
            const clampedPopulationChange = Math.max(-maxDailyChange, Math.min(maxDailyChange, rawPopulationChange));

            populationUpdates[key] = {
                qol: smoothedQol,
                expectedQol,
                populationChange: clampedPopulationChange,
                wealth: Math.max(0, smoothedWealth),
                requirements: requirements as Record<string, number>,
            };

            populationProfits[key] = income - expenses;
        }

        const sectorBids: Array<{
            name: string;
            level: number;
            budgetRatio: number;
            inputCost: number;
            laborCost: number;
            idealWorkerDemand: Partial<Record<keyof Population, number>>;
            idealGoodsDemand: Partial<Record<keyof Goods, number>>;
            idealGoodsProduction: Partial<Record<keyof Goods, number>>;
            outputLevel: number;
            inputLevel: number;
        }> = [];

        for(const [name, level] of Object.entries(sectors) as [keyof IndustrialSectors, number][]) {
            const blueprintEntry = industryReducers.find(([n]) => n === name);
            if(!blueprintEntry) continue;

            const [, reducer] = blueprintEntry;
            const config = (reducer as any).config;
            if(!config) continue;

            const outputLevel = getSectorOutputLevel(name, level);
            const inputLevel = config.levelModifier ? config.levelModifier(level) : level;

            const workerRequirement = config.workerRequirement || {};
            const goodsRequirements = config.goodsRequirements || {};
            const goodsProduction = config.goodsProduction || {};

            const maintenanceCost = Math.round((sectorUpgradeCosts[name as keyof IndustrialSectors] || 10) * level * 0.1);
            const wealth = (sectorWealth[name] ?? 0) - maintenanceCost;
            const clampedWealth = Math.max(0, wealth);

            const inputCost = Object.entries(goodsRequirements).reduce((sum, [key, value]) => {
                return sum + (value as number) * prices[key as keyof Goods];
            }, 0);

            const laborCost = Object.entries(workerRequirement).reduce((sum, [key, value]) => {
                return sum + (value as number) * baseSalaries[key as keyof Population];
            }, 0);

            const costPerUnit = inputCost + laborCost;
            const budgetRatio = costPerUnit > 0 ? Math.min(1, Math.max(0, clampedWealth / costPerUnit)) : 1;

            sectorBids.push({
                name,
                level,
                budgetRatio,
                inputCost,
                laborCost,
                idealWorkerDemand: Object.fromEntries(
                    Object.entries(workerRequirement).map(([k, v]) => [k, (v as number) * inputLevel])
                ) as Partial<Record<keyof Population, number>>,
                idealGoodsDemand: Object.fromEntries(
                    Object.entries(goodsRequirements).map(([k, v]) => [k, (v as number) * inputLevel])
                ) as Partial<Record<keyof Goods, number>>,
                idealGoodsProduction: Object.fromEntries(
                    Object.entries(goodsProduction).map(([k, v]) => [k, (v as number) * outputLevel])
                ) as Partial<Record<keyof Goods, number>>,
                outputLevel,
                inputLevel,
            });
        }

        const totalIdealWorkerDemand: Record<keyof Population, number> = {} as any;
        const totalIdealGoodsDemand: Record<keyof Goods, number> = {} as any;

        for(const bid of sectorBids) {
            for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
                totalIdealWorkerDemand[key as keyof Population] = (totalIdealWorkerDemand[key as keyof Population] ?? 0) + value;
            }
            for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
                totalIdealGoodsDemand[key as keyof Goods] = (totalIdealGoodsDemand[key as keyof Goods] ?? 0) + value;
            }
        }

        const workerMarketRatios: Record<keyof Population, number> = {} as any;
        for(const [key, totalDemand] of Object.entries(totalIdealWorkerDemand)) {
            const available = population[key as keyof Population].number;
            workerMarketRatios[key as keyof Population] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
        }

        const goodsMarketRatios: Record<keyof Goods, number> = {} as any;
        for(const [key, totalDemand] of Object.entries(totalIdealGoodsDemand)) {
            const available = Math.max(0, goods[key as keyof Goods]);
            goodsMarketRatios[key as keyof Goods] = totalDemand > 0 ? Math.min(1, available / totalDemand) : 1;
        }

        const sumGoodsRequirements = createStarterWarehouse(0);
        const sumGoodsProduction = createStarterWarehouse(0);
        const workingWorkers = createStarterPopulation(0);
        const remainingWorkers: Population = structuredClone(population);
        const remainingGoods: Goods = structuredClone(goods);

        const sectorResults: Record<string, SectorResult> = {};
        const sectorProfits: Record<string, number> = {};
        const sectorMaintenance: Record<string, number> = {};

        for(const bid of sectorBids) {
            const maintenanceCost = Math.round((sectorUpgradeCosts[bid.name as keyof IndustrialSectors] || 10) * bid.level * 0.1);
            sectorMaintenance[bid.name] = maintenanceCost;

            let marketConstraint = 1;
            for(const [key, value] of Object.entries(bid.idealWorkerDemand)) {
                if(value > 0) {
                    marketConstraint = Math.min(marketConstraint, workerMarketRatios[key as keyof Population] ?? 1);
                }
            }
            for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
                if(value > 0) {
                    marketConstraint = Math.min(marketConstraint, goodsMarketRatios[key as keyof Goods] ?? 1);
                }
            }

            const wealth = (sectorWealth[bid.name as keyof IndustrialSectors] ?? 0) - maintenanceCost;
            const clampedWealth = Math.max(0, wealth);
            const budgetRatio = bid.inputCost + bid.laborCost > 0 ? Math.min(1, Math.max(0, clampedWealth / (bid.inputCost + bid.laborCost))) : 1;
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

            const consumedGoods: Partial<Goods> = {};
            for(const [key, value] of Object.entries(bid.idealGoodsDemand)) {
                const consumed = value * actualScale;
                consumedGoods[key as keyof Goods] = consumed;
                remainingGoods[key as keyof Goods] -= consumed;
                sumGoodsRequirements[key as keyof Goods] = (sumGoodsRequirements[key as keyof Goods] ?? 0) + consumed;
            }

            const producedGoods: Partial<Goods> = {};
            for(const [key, value] of Object.entries(bid.idealGoodsProduction)) {
                const produced = value * actualScale;
                producedGoods[key as keyof Goods] = produced;
                remainingGoods[key as keyof Goods] += produced;
                sumGoodsProduction[key as keyof Goods] = (sumGoodsProduction[key as keyof Goods] ?? 0) + produced;
            }

            const revenue = Object.entries(producedGoods).reduce((sum, [key, amount]) => {
                return sum + (amount ?? 0) * prices[key as keyof Goods];
            }, 0);
            const inputCosts = Object.entries(consumedGoods).reduce((sum, [key, amount]) => {
                return sum + (amount ?? 0) * prices[key as keyof Goods];
            }, 0);
            const laborCosts = Object.entries(workersEmployed).reduce((sum, [key, amount]) => {
                return sum + (amount ?? 0) * baseSalaries[key as keyof Population];
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
        }

        const goodsRequirements = { ...sumGoodsRequirements };
        for(const key in populationConsumption) {
            goodsRequirements[key as keyof Goods] = (goodsRequirements[key as keyof Goods] ?? 0) + (populationConsumption[key as keyof Goods] ?? 0);
        }
        const goodsProduction = { ...sumGoodsProduction };
        const goodsChange = Object.entries({ ...goodsProduction, ...goodsRequirements }).reduce(
            (acc, [key]) => {
                acc[key as keyof Goods] = (goodsProduction[key as keyof Goods] ?? 0) - (goodsRequirements[key as keyof Goods] ?? 0);
                return acc;
            },
            createStarterWarehouse(0)
        );

        const wasteDecayRate = 0.05;
        goodsChange.waste = Math.max(0, goodsChange.waste - wasteDecayRate * (goods.waste || 0));

        results.push({
            entityId,
            goodsRequirements,
            goodsProduction,
            workingWorkers,
            freeWorkers: remainingWorkers,
            populationUpdates,
            goodsChange,
            sectorProfits,
            sectorMaintenance,
            populationProfits,
        });
    }

    self.postMessage({ type: "result", results });
};
