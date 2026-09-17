import { industryReducers } from "../systems/factoryBlueprints";
import { baseSalaries, getGoodRequirementsAndQoL, Population, PopulationBreakdown } from "../data/Population";
import { getPrices, Goods } from "../data/Goods";
import { createStarterWarehouse } from "../factories/createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { populationGrowth } from "../data/populationHelpers";
import type { IndustrialSectors } from "../components/Factories";
import type { IndustryReducerReturn, SectorResult } from "../systems/generateIndustrialSector";

export interface IndustryTickInput {
    entityId: string;
    sectors: IndustrialSectors;
    goods: Goods;
    population: Population;
}

export interface IndustryTickResult {
    entityId: string;
    goodsRequirements: Partial<Goods>;
    goodsProduction: Partial<Goods>;
    workingWorkers: Population;
    freeWorkers: Population;
    populationUpdates: Record<string, {
        qol: number;
        populationChange: number;
        wealth: number;
        requirements: Record<string, number>;
    }>;
    goodsChange: Goods;
    sectorProfits: Record<string, number>;
    populationProfits: Record<string, number>;
}

self.onmessage = (event: MessageEvent<{ type: string; industries: IndustryTickInput[] }>) => {
    if (event.data.type !== "tick") return;

    const results: IndustryTickResult[] = [];

    for (const input of event.data.industries) {
        const { entityId, sectors, goods, population } = input;

        const populationConsumption = {} as Partial<Goods>;
        for (const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
            const { requirements } = getGoodRequirementsAndQoL(
                baseSalaries[key],
                getPrices(),
                pop
            );

            for (const it in requirements) {
                populationConsumption[it as keyof Goods] =
                    (requirements[it as keyof Goods] ?? 0) +
                    (populationConsumption[it as keyof Goods] ?? 0);
            }
        }

        const initial: IndustryReducerReturn = {
            remainingWorkers: population,
            remainingGoods: goods,
            sumGoodsRequirements: createStarterWarehouse(0),
            sumGoodsProduction: createStarterWarehouse(0),
            workingWorkers: createStarterPopulation(0),
            sectorResult: {
                name: "",
                consumedGoods: {},
                producedGoods: {},
                workersEmployed: {},
                productionRatio: 1,
                inputLevel: 0,
                outputLevel: 0,
            },
        };

        const sectorResults: Record<string, SectorResult> = {};
        const reducerResult = industryReducers.reduce(
            (_acc, [name, reducer]) => {
                const result = reducer(
                    {
                        ..._acc,
                        workerRatio: 1,
                    },
                    sectors
                );
                if (result.sectorResult) {
                    sectorResults[name] = result.sectorResult;
                }
                return result;
            },
            initial
        ) as IndustryReducerReturn;

        const { sumGoodsProduction, sumGoodsRequirements, workingWorkers, remainingWorkers } = reducerResult;

        const goodsRequirements = { ...sumGoodsRequirements };
        for (const key in populationConsumption) {
            goodsRequirements[key as keyof Goods] =
                (goodsRequirements[key as keyof Goods] ?? 0) + (populationConsumption[key as keyof Goods] ?? 0);
        }
        const goodsProduction = { ...sumGoodsProduction };
        const populationUpdates: IndustryTickResult["populationUpdates"] = {};
        const populationProfits: Record<string, number> = {};

        for (const [key, pop] of Object.entries(population) as [keyof Population, PopulationBreakdown][]) {
            const { requirements, qol } = getGoodRequirementsAndQoL(
                baseSalaries[key],
                getPrices(),
                pop
            );

            populationUpdates[key] = {
                qol,
                populationChange: populationGrowth(qol) * pop.number,
                wealth: pop.wealth + baseSalaries[key] * pop.number,
                requirements: requirements as Record<string, number>,
            };

            const income = baseSalaries[key] * pop.number;
            const expenses = Object.entries(requirements).reduce((sum, [good, amount]) => {
                if (!amount) return sum;
                return sum + amount * getPrices()[good as keyof Goods];
            }, 0);
            populationProfits[key] = income - expenses;
        }

        const sectorProfits: Record<string, number> = {};
        for (const result of Object.values(sectorResults)) {
            const revenue = Object.entries(result.producedGoods).reduce((sum, [key, amount]) => {
                if (!amount) return sum;
                return sum + amount * getPrices()[key as keyof Goods];
            }, 0);
            const inputCosts = Object.entries(result.consumedGoods).reduce((sum, [key, amount]) => {
                if (!amount) return sum;
                return sum + amount * getPrices()[key as keyof Goods];
            }, 0);
            const laborCosts = Object.entries(result.workersEmployed).reduce((sum, [key, amount]) => {
                if (!amount) return sum;
                return sum + amount * baseSalaries[key as keyof Population];
            }, 0);
            sectorProfits[result.name] = revenue - inputCosts - laborCosts;
        }

        const goodsChange = Object.entries({ ...goodsProduction, ...goodsRequirements }).reduce(
            (acc, [key]) => {
                acc[key as keyof Goods] = (goodsProduction[key as keyof Goods] ?? 0) - (goodsRequirements[key as keyof Goods] ?? 0);
                return acc;
            },
            createStarterWarehouse(0)
        );

        results.push({
            entityId,
            goodsRequirements,
            goodsProduction,
            workingWorkers,
            freeWorkers: remainingWorkers,
            populationUpdates,
            goodsChange,
            sectorProfits,
            populationProfits,
        });
    }

    self.postMessage({ type: "result", results });
};
