import { Goods } from "./Goods";
import { Population } from "./Population";

export type Factory = {
    readonly name: string;
    readonly workerRequirement: Partial<Population>;
    readonly goodsRequirements: Partial<Goods>;
    readonly goodsProduction: Partial<Goods>
};
