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
        if (outputLevelModifier) return outputLevelModifier(level);
        if (efficiencyBonus > 0) return level * (1 + efficiencyBonus * (level - 1));
        return level;
    };

    const reducer = ({ workerRatio, remainingWorkers, remainingGoods, sumGoodsProduction, sumGoodsRequirements, workingWorkers
    }: ReducerInput,
        _sectorLevels: IndustrialSectors) => {
        const level = _sectorLevels[name as keyof IndustrialSectors];
        const inputLevel = levelModifier ? levelModifier(level) : level;
        const outputLevel = getOutputLevel(level);
        const lowestRatio = Math.min(
            getLowestPopulationRatio(workerRequirement, remainingWorkers, inputLevel, workerRatio),
            getLowestGoodsRatio(goodsRequirements, remainingGoods, inputLevel, workerRatio)
        );

        const productionRatio = lowestRatio;
        const workerRequirementEntries = Object.entries(workerRequirement) as [keyof Population, number][];
        const goodsRequirementsEntries = Object.entries(goodsRequirements) as [keyof Goods, number][];
        const goodsProductionEntries = Object.entries(goodsProduction) as [keyof Goods, number][];

        const ret = {
            workingWorkers: {
                ...workerRequirementEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: { ...workingWorkers[key], number: workingWorkers[key].number + value * inputLevel * productionRatio } }), workingWorkers)
            },
            remainingWorkers: {
                ...workerRequirementEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: { ...remainingWorkers[key], number: remainingWorkers[key].number - value * inputLevel * productionRatio } }), remainingWorkers)
            },
            remainingGoods: {
                ...goodsRequirementsEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key] - value * inputLevel * productionRatio }), remainingGoods),
                ...goodsProductionEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key] + value * outputLevel * productionRatio }), remainingGoods),
            },
            sumGoodsRequirements: {
                ...goodsRequirementsEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: (acc[key] ?? 0) + value * inputLevel * productionRatio }), sumGoodsRequirements)
            },
            sumGoodsProduction: {
                ...goodsProductionEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: (acc[key] ?? 0) + value * outputLevel * productionRatio }), sumGoodsProduction)
            },
            sectorResult: {
                name: name as string,
                consumedGoods: goodsRequirementsEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: value * inputLevel * productionRatio }), {}),
                producedGoods: goodsProductionEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: value * outputLevel * productionRatio }), {}),
                workersEmployed: workerRequirementEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: value * inputLevel * productionRatio }), {}),
                productionRatio,
                inputLevel,
                outputLevel,
            } as SectorResult
        };

        return ret;
    };

    (reducer as IndustryReducer & { config: { name: keyof IndustrialSectors; efficiencyBonus: number; outputLevelModifier?: (level: number) => number; levelModifier?: (level: number) => number } }).config = { name, efficiencyBonus, outputLevelModifier, levelModifier };
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
