import { Goods } from "../data/Goods";
import { Population } from "../data/Population";

export type SectorBid = {
    name: string;
    level: number;

    /** Maximum scale permitted by the sector's operating input budget. */
    budgetRatio: number;

    /** Initial requested scale; later constrained by labor/material allocation in execution. */
    actualScale: number;

    /** Base input cost before capital scaling and production scaling. */
    inputCost: number;

    /** Base labor cost before production scaling. */
    laborCost: number;

    /** Capital productivity multiplier applied to worker/material/production demands. */
    capitalMultiplier: number;

    idealWorkerDemand: Partial<Record<keyof Population, number>>;
    idealGoodsDemand: Partial<Record<keyof Goods, number>>;
    idealGoodsProduction: Partial<Record<keyof Goods, number>>;

    /** Goods that are optional (non-essential) — sector can produce without them at reduced efficiency. */
    nonEssentialGoods: Set<keyof Goods>;

    outputLevel: number;
    inputLevel: number;
};
