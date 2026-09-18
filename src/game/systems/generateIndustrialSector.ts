import { IndustrialSectors } from "../components/Factories";
import { Goods, getLowestGoodsRatio } from "../data/Goods";
import { Population, getLowestPopulationRatio } from "../data/Population";

export type SectorResult = {
    name: string
    consumedGoods: Partial<Goods>
    producedGoods: Partial<Goods>
    workersEmployed: Partial<Record<keyof Population, number>>
    productionRatio: number
    inputLevel: number
    outputLevel: number
}

export type ReducerInput = {
    remainingGoods: Goods,
    remainingWorkers: Population,
    workerRatio: number,
    sumGoodsRequirements: Partial<Goods>,
    sumGoodsProduction: Partial<Goods>,
    workingWorkers: Population,
    sectorResult?: SectorResult
}

export const generateIndustrialSector = ({ name, workerRequirement, goodsRequirements, goodsProduction, levelModifier, outputLevelModifier, efficiencyBonus = 0 }: {
    name: keyof Partial<IndustrialSectors>;
    workerRequirement: Partial<Record<keyof Population, number>>;
    goodsRequirements: Partial<Record<keyof Goods, number>>;
    goodsProduction: Partial<Goods>;
    levelModifier?: (level: number) => number;
    outputLevelModifier?: (level: number) => number;
    efficiencyBonus?: number;
}) => {
    const getOutputLevel = (level: number) => {
        if(outputLevelModifier) return outputLevelModifier(level);
        if(efficiencyBonus > 0) return level * (1 + efficiencyBonus * (level - 1));
        return level;
    };

    const reducer = ({ workerRatio, remainingWorkers, remainingGoods, sumGoodsProduction, sumGoodsRequirements, workingWorkers }: ReducerInput,
        _sectorLevels: IndustrialSectors) => {
        const level = _sectorLevels[name as keyof IndustrialSectors];
        const inputLevel = levelModifier ? levelModifier(level) : level;
        const outputLevel = getOutputLevel(level);
        const lowestRatio = Math.min(
            getLowestPopulationRatio(workerRequirement, remainingWorkers, inputLevel, workerRatio),
            getLowestGoodsRatio(goodsRequirements, remainingGoods, inputLevel, workerRatio)
        );
        const productionRatio = lowestRatio;

        const workerEntries = Object.entries(workerRequirement) as [keyof Population, number][];
        const goodsReqEntries = Object.entries(goodsRequirements) as [keyof Goods, number][];
        const goodsProdEntries = Object.entries(goodsProduction) as [keyof Goods, number][];

        const workingWorkersResult = { ...workingWorkers };
        const remainingWorkersResult = { ...remainingWorkers };
        const remainingGoodsResult = { ...remainingGoods };
        const sumGoodsRequirementsResult = { ...sumGoodsRequirements };
        const sumGoodsProductionResult = { ...sumGoodsProduction };
        const consumedGoods: Partial<Goods> = {};
        const producedGoods: Partial<Goods> = {};
        const workersEmployed: Partial<Record<keyof Population, number>> = {};

        for (const [key, value] of workerEntries) {
            const scaled = value * inputLevel * productionRatio;
            workingWorkersResult[key] = { ...workingWorkersResult[key], number: workingWorkers[key].number + scaled };
            remainingWorkersResult[key] = { ...remainingWorkersResult[key], number: remainingWorkers[key].number - scaled };
            workersEmployed[key] = scaled;
        }

        for (const [key, value] of goodsReqEntries) {
            const scaled = value * inputLevel * productionRatio;
            remainingGoodsResult[key] -= scaled;
            sumGoodsRequirementsResult[key] = (sumGoodsRequirementsResult[key] ?? 0) + scaled;
            consumedGoods[key] = scaled;
        }

        for (const [key, value] of goodsProdEntries) {
            const scaled = value * outputLevel * productionRatio;
            remainingGoodsResult[key] += scaled;
            sumGoodsProductionResult[key] = (sumGoodsProductionResult[key] ?? 0) + scaled;
            producedGoods[key] = scaled;
        }

        return {
            workingWorkers: workingWorkersResult,
            remainingWorkers: remainingWorkersResult,
            remainingGoods: remainingGoodsResult,
            sumGoodsRequirements: sumGoodsRequirementsResult,
            sumGoodsProduction: sumGoodsProductionResult,
            sectorResult: {
                name: name as string,
                consumedGoods,
                producedGoods,
                workersEmployed,
                productionRatio,
                inputLevel,
                outputLevel,
            } as SectorResult
        };
    };

    (reducer as IndustryReducer & {
        config: {
            name: keyof IndustrialSectors;
            efficiencyBonus: number;
            outputLevelModifier?: (level: number) => number;
            levelModifier?: (level: number) => number;
            workerRequirement: Partial<Record<keyof Population, number>>;
            goodsRequirements: Partial<Record<keyof Goods, number>>;
            goodsProduction: Partial<Goods>
        }
    }).config =
        { name, efficiencyBonus, outputLevelModifier, levelModifier, workerRequirement, goodsRequirements, goodsProduction };
    return reducer as IndustryReducer;
};

export type IndustryReducer = (input: ReducerInput, sectorLevels: IndustrialSectors) => {
    workingWorkers: Population;
    remainingWorkers: Population;
    remainingGoods: Goods;
    sumGoodsRequirements: Partial<Goods>;
    sumGoodsProduction: Partial<Goods>;
    sectorResult: SectorResult;
};

export type IndustryReducerReturn = ReturnType<IndustryReducer>;
