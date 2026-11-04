import { IndustrialSectors } from "../components/Factories";
import { Goods } from "../data/Goods";
import { createStarterWarehouse } from "./createStarterWarehouse";
import { createStarterPopulation } from "../data/getPopulationBreakdown";
import { ColonyType } from "../constants";

export type OutpostConfig = {
    population: number;
    allowedSectors: (keyof IndustrialSectors)[];
    colonyType?: ColonyType;
    goods?: Partial<Goods>;
}

export function createOutpost(config: OutpostConfig) {
    const { population, allowedSectors, colonyType = "standard", goods = {} } = config;

    const sectors = {} as Record<keyof IndustrialSectors, number>;
    for(const key of Object.keys(allowedSectors)) {
        sectors[key as keyof IndustrialSectors] = 1;
    }

    const fullGoods = createStarterWarehouse(0) as Goods;
    for(const [key, value] of Object.entries(goods)) {
        fullGoods[key as keyof Goods] = value;
    }

    const populationBreakdown = createStarterPopulation(population);

    return {
        sectors,
        goods: fullGoods,
        population: populationBreakdown,
        colonyType,
        settlementType: "outpost" as const,
        allowedSectors,
    };
}
