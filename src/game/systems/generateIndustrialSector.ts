import { IndustrialSectors } from "../components/Factories";
import { Goods, } from "../data/Goods";
import { Population, } from "../data/Population";

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

export type IndustryReducer = (input: ReducerInput, sectorLevels: IndustrialSectors) => {
    workingWorkers: Population;
    remainingWorkers: Population;
    remainingGoods: Goods;
    sumGoodsRequirements: Partial<Goods>;
    sumGoodsProduction: Partial<Goods>;
    sectorResult: SectorResult;
};

export type IndustryReducerReturn = ReturnType<IndustryReducer>;
