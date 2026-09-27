import { Entity } from "@/engine/entities/entity";
import { IndustryComponent } from "@/game/components/industryComponent";
import { ReactNode } from "react";
import { IndustryBreakdown } from "./IndustryBreakdown";
import { PopulationBreakdown } from "./PopulationBreakdown";
import { WarehouseBreakdown } from "./WarehouseBreakdown";
import { ColonySummary } from "./colonySummary";

export type DialogPage = "summary" | "population" | "warehouse" | "industry";

export function DialogInner(industry: IndustryComponent | null, page: DialogPage, entity?: Entity): ReactNode {
    if(!industry) return <></>;

    switch(page) {
        case "summary":
            return <ColonySummary industry={industry} />;
        case "population":
            return <PopulationBreakdown industry={industry} />;
        case "warehouse":
            return <WarehouseBreakdown industry={industry} />;
        case "industry":
            return <IndustryBreakdown industry={industry} entity={entity!} />;
        default:
            return <></>;
    }
}
