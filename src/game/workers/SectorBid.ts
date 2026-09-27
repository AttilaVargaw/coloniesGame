import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

export type SectorBid = {
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
};
