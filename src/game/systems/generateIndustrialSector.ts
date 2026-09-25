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
