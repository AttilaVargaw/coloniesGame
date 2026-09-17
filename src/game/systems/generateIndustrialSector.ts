import { IndustrialSectors } from "../components/Factories";
import { Goods, getLowestGoodsRatio } from "../data/Goods";
import { Population, getLowestPopulationRatio } from "../data/Population";

export type IndustryReducer = ReturnType<typeof generateIndustrialSector>
export type IndustryReducerReturn = ReturnType<IndustryReducer>

export type ReducerInput = {
    remainingGoods: Goods,
    remainingWorkers: Population,
    workerRatio: number,
    sumGoodsRequirements: Partial<Goods>,
    sumGoodsProduction: Partial<Goods>,
    workingWorkers: Population,
}

export const generateIndustrialSector = ({ name, workerRequirement, goodsRequirements, goodsProduction }: {
    name: keyof Partial<IndustrialSectors>;
    workerRequirement: Partial<Record<keyof Population, number>>;
    goodsRequirements: Partial<Record<keyof Goods, number>>;
    goodsProduction: Partial<Goods>;
}) => {
    return ({ workerRatio, remainingWorkers, remainingGoods, sumGoodsProduction, sumGoodsRequirements, workingWorkers
    }: ReducerInput,
        sectorLevels: IndustrialSectors) => {
        const level = sectorLevels[name as keyof IndustrialSectors];
        const lowestRatio = Math.min(
            getLowestPopulationRatio(workerRequirement, remainingWorkers, level, workerRatio),
            getLowestGoodsRatio(goodsRequirements, remainingGoods, level, workerRatio)
        );

        const productionRatio = lowestRatio;
        const workerRequirementEntries = Object.entries(workerRequirement) as [keyof Population, number][];
        const goodsRequirementsEntries = Object.entries(goodsRequirements) as [keyof Goods, number][];
        const goodsProductionEntries = Object.entries(goodsProduction) as [keyof Goods, number][];

        const ret = {
            workingWorkers: {
                ...workerRequirementEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: { ...workingWorkers[key], number: workingWorkers[key].number + value * level * productionRatio } }), workingWorkers)
            },
            remainingWorkers: {
                ...workerRequirementEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: { ...remainingWorkers[key], number: remainingWorkers[key].number - value * level * productionRatio } }), remainingWorkers)
            },
            remainingGoods: {
                ...goodsRequirementsEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key] - value * level * productionRatio }), remainingGoods),
                ...goodsProductionEntries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: remainingGoods[key] + value * level * productionRatio }), remainingGoods),
            },
            sumGoodsRequirements: {
                ...goodsRequirementsEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: (acc[key] ?? 0) + value * level * productionRatio }), sumGoodsRequirements)
            },
            sumGoodsProduction: {
                ...goodsProductionEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: (acc[key] ?? 0) + value * level * productionRatio }), sumGoodsProduction)
            }
        };

        return ret;
    };
};
