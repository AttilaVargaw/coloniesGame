import { Goods } from "./Goods";
import { Population } from "./Population";

export type Factory = Readonly<{
    name: string;
    workerRequirement: Partial<Population>;
    goodsRequirements: Partial<Goods>;
    goodsProduction: Partial<Goods>
}>
